import express, { type Express, type RequestHandler } from 'express';
import { createR2PhotoService, MAX_PHOTO_BYTES, PhotoError, photoKey, type PhotoService } from './photo-storage';

type Dependencies = {
  auth: RequestHandler; write: RequestHandler; read: RequestHandler;
  ticketForPhoto: (path: string) => Promise<any>;
  inScope: (ticket: any, user: any) => Promise<boolean>;
  service?: () => PhotoService | undefined;
};

export function registerPhotoRoutes(app: Express, deps: Dependencies) {
  let cached: PhotoService | undefined;
  const service = () => {
    const instance = deps.service ? deps.service() : (cached ??= createR2PhotoService());
    if (!instance) throw new PhotoError(503,'Photo storage is not configured yet');
    return instance;
  };
  const wrap = (fn: (req: any,res: any) => Promise<void>): RequestHandler => (req,res,next) => {
    fn(req,res).catch(error => {
      if (res.headersSent) return next(error);
      res.status(error instanceof PhotoError ? error.status : 502).json({ message: error instanceof PhotoError ? error.message : 'Photo storage is unavailable. Please try again.' });
    });
  };
  const recent = new Map<string, number[]>();
  app.post('/api/car-photos/upload',deps.auth,deps.write,wrap(async(req,res) => {
    const now = Date.now();
    for(const [id,entries] of recent) if(!entries.some(t=>t>now-300_000)) recent.delete(id);
    const owner = req.currentUser.id;
    const entries = (recent.get(owner) ?? []).filter(t=>t>now-300_000);
    if(entries.length>=30) throw new PhotoError(429,'Too many photo uploads. Please wait a few minutes.');
    const result = service().issue(owner,req.body?.contentType,req.body?.size);
    recent.set(owner,[...entries,now]);
    res.setHeader('Cache-Control','no-store');
    res.json(result);
  }));
  app.put('/api/car-photos/content/:id',deps.auth,deps.write,express.raw({type:['image/jpeg','image/png','image/webp'],limit:MAX_PHOTO_BYTES}),wrap(async(req,res) => {
    await service().upload(req.currentUser.id,req.params.id,req.query.token,req.body,req.get('content-type') ?? '');
    res.status(204).end();
  }));
  const read = wrap(async(req,res) => {
    const path = req.path.startsWith('/api/backup/') ? req.query.path : `/car-photos/${req.params.photoPath}`;
    photoKey(path);
    const ticket = await deps.ticketForPhoto(path);
    // Uploaded-but-unattached previews belong only to the uploading staff member.
    const allowed = ticket ? await deps.inScope(ticket,req.currentUser) : await service().canAttach(path,req.currentUser.id);
    if(!allowed) throw new PhotoError(404,'Photo not found');
    const photo = await service().read(path);
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    res.type(photo.contentType).send(Buffer.from(photo.bytes));
  });
  app.get('/car-photos/:photoPath(*)',deps.auth,deps.read,read);
  app.get('/api/backup/photo',deps.auth,deps.write,read);
  return async(path: unknown,userId: string) => service().canAttach(path,userId);
}
