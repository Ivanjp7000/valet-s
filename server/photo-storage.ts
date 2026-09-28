import crypto from 'node:crypto';
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ATTACH_WINDOW = 30 * 60 * 1000;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const NEW_PATH = /^\/car-photos\/r2\/([a-f0-9-]{36})$/;
const SAFE_PATH = /^\/car-photos\/((?:r2\/)?[a-zA-Z0-9_-]+(?:\.(?:jpg|jpeg|png|webp))?)$/;

export class PhotoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface PhotoObject { bytes: Uint8Array; contentType: string; }
export interface PhotoMetadata { owner: string; uploadedAt: number; }
export interface PhotoStore {
  put(key: string, bytes: Buffer, contentType: string, metadata: PhotoMetadata): Promise<void>;
  head(key: string): Promise<PhotoMetadata | undefined>;
  get(key: string): Promise<PhotoObject | undefined>;
}

export function photoKey(path: unknown): string {
  if (typeof path !== 'string') throw new PhotoError(400, 'Invalid photo path');
  const match = SAFE_PATH.exec(path);
  if (!match) throw new PhotoError(400, 'Invalid photo path');
  return `car-photos/${match[1]}`;
}
function imageType(bytes: Buffer): string | undefined {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return 'image/webp';
}

// The browser uploads through the authenticated app. R2 credentials and public
// bucket access are never needed in the browser, and no bucket CORS rule is needed.
export class PhotoService {
  constructor(private store: PhotoStore, private secret: string, private now = Date.now) {
    if (secret.length < 32) throw new PhotoError(503, 'Photo storage requires a session secret of at least 32 characters');
  }
  issue(owner: string, contentType: string, size: number) {
    if (!TYPES.includes(contentType) || !Number.isInteger(size) || size < 1 || size > MAX_PHOTO_BYTES)
      throw new PhotoError(400, 'Use a JPG, PNG or WEBP image up to 10 MB');
    const id = crypto.randomUUID();
    const issuedPath = `/car-photos/r2/${id}`;
    const payload = Buffer.from(JSON.stringify({ owner, id, contentType, size, expires: this.now() + 5 * 60 * 1000 })).toString('base64url');
    const signature = crypto.createHmac('sha256',this.secret).update(payload).digest('base64url');
    return { issuedPath, uploadURL: `/api/car-photos/content/${id}?token=${payload}.${signature}` };
  }
  async upload(owner: string, id: string, token: unknown, bytes: Buffer, contentType: string) {
    if (typeof token !== 'string' || token.length > 2048) throw new PhotoError(403,'Upload authorization expired or invalid');
    const [payload, signature, extra] = token.split('.');
    const expected = crypto.createHmac('sha256',this.secret).update(payload ?? '').digest('base64url');
    if (extra || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))
      throw new PhotoError(403,'Upload authorization expired or invalid');
    let claims: any;
    try { claims = JSON.parse(Buffer.from(payload,'base64url').toString()); } catch { throw new PhotoError(403,'Invalid upload authorization'); }
    if (!claims || claims.owner !== owner || claims.id !== id || !Number.isFinite(claims.expires) || claims.expires <= this.now())
      throw new PhotoError(403,'Upload authorization expired or invalid');
    const path = `/car-photos/r2/${id}`;
    if (!NEW_PATH.test(path)) throw new PhotoError(400,'Invalid photo path');
    if (!Buffer.isBuffer(bytes) || bytes.length !== claims.size || bytes.length > MAX_PHOTO_BYTES || contentType !== claims.contentType || imageType(bytes) !== contentType)
      throw new PhotoError(400,'Image type or size does not match the upload');
    // Conditional put prevents replay from replacing a photo already attached to a ticket.
    await this.store.put(photoKey(path),bytes,contentType,{ owner, uploadedAt: this.now() });
  }
  async canAttach(path: unknown, owner: string): Promise<boolean> {
    if (typeof path !== 'string' || !NEW_PATH.test(path)) return false;
    const meta = await this.store.head(photoKey(path));
    return !!meta && meta.owner === owner && meta.uploadedAt <= this.now() && meta.uploadedAt + ATTACH_WINDOW > this.now();
  }
  async read(path: unknown) {
    const object = await this.store.get(photoKey(path));
    if (!object) throw new PhotoError(404,'Photo not found');
    if (object.bytes.length > MAX_PHOTO_BYTES || imageType(Buffer.from(object.bytes)) !== object.contentType)
      throw new PhotoError(415,'Unsupported image');
    return object;
  }
}

function isMissing(error: any) { return error?.$metadata?.httpStatusCode === 404 || error?.name === 'NoSuchKey'; }
export function createR2PhotoService(env: NodeJS.ProcessEnv = process.env): PhotoService | undefined {
  const { R2_ACCOUNT_ID: account, R2_BUCKET_NAME: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, SESSION_SECRET: secret } = env;
  if (!account || !bucket || !accessKeyId || !secretAccessKey || !secret) return undefined;
  if (!/^[a-f0-9]{32}$/i.test(account)) throw new PhotoError(503,'Invalid R2 account configuration');
  const client = new S3Client({ region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  return new PhotoService({
    async put(key, bytes, contentType, metadata) {
      try { await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType, IfNoneMatch: '*', Metadata: { owner: metadata.owner, uploadedat: String(metadata.uploadedAt) } })); }
      catch(e: any) { if(e?.$metadata?.httpStatusCode === 412) throw new PhotoError(409,'This upload has already completed'); throw e; }
    },
    async head(key) {
      try { const obj = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); return { owner: obj.Metadata?.owner ?? '', uploadedAt: Number(obj.Metadata?.uploadedat) }; }
      catch(e) { if(isMissing(e)) return undefined; throw e; }
    },
    async get(key) {
      try {
        const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!obj.Body) return undefined;
        if (!obj.ContentLength || obj.ContentLength > MAX_PHOTO_BYTES) { (obj.Body as any).destroy?.(); throw new PhotoError(415,'Unsupported image size'); }
        return { bytes: await obj.Body.transformToByteArray(), contentType: obj.ContentType ?? '' };
      } catch(e) { if(isMissing(e)) return undefined; throw e; }
    },
  },secret);
}
