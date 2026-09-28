import assert from 'node:assert/strict';
import express from 'express';
import { PhotoService, PhotoError, photoKey, MAX_PHOTO_BYTES, type PhotoStore } from './photo-storage';
import { registerPhotoRoutes } from './photo-routes';

const objects = new Map<string,any>();
const store: PhotoStore = {
  async put(key,bytes,contentType,meta) { if(objects.has(key)) throw new PhotoError(409,'Already uploaded'); objects.set(key,{bytes,contentType,...meta}); },
  async head(key) { return objects.get(key); },
  async get(key) { return objects.get(key); },
};
let now=1_800_000_000_000;
const secret='test-only-secret-not-for-deployment'.repeat(2);
const service=new PhotoService(store,secret,()=>now);
const jpeg=Buffer.from([255,216,255,224,0,1,2,3]);
const issued=service.issue('alice','image/jpeg',jpeg.length);
const url=new URL(issued.uploadURL,'http://localhost');
const id=url.pathname.split('/').pop()!;
const token=url.searchParams.get('token')!;
assert.equal(await service.canAttach(issued.issuedPath,'alice'),false);
await assert.rejects(()=>service.upload('bob',id,token,jpeg,'image/jpeg'),{status:403});
await assert.rejects(()=>service.upload('alice',id,token+'x',jpeg,'image/jpeg'),{status:403});
await assert.rejects(()=>service.upload('alice',id,token,Buffer.from('notjpeg!'),'image/jpeg'),{status:400});
await assert.rejects(()=>service.upload('alice',id,token,jpeg,'image/png'),{status:400});
await service.upload('alice',id,token,jpeg,'image/jpeg');
await assert.rejects(()=>service.upload('alice',id,token,jpeg,'image/jpeg'),{status:409});
assert.equal(await service.canAttach(issued.issuedPath,'alice'),true);
assert.equal(await service.canAttach(issued.issuedPath,'bob'),false);
assert.equal(await new PhotoService(store,secret,()=>now).canAttach(issued.issuedPath,'alice'),true);
for(const path of ['https://evil.test/a','/car-photos/../secret','/car-photos/%2e%2e/key','/car-photos/foo.svg','/car-photos/r2/a?x=1']) assert.throws(()=>photoKey(path),{status:400});
assert.throws(()=>service.issue('alice','image/svg+xml',10),{status:400});
assert.throws(()=>service.issue('alice','image/jpeg',MAX_PHOTO_BYTES+1),{status:400});
now+=31*60_000;
assert.equal(await service.canAttach(issued.issuedPath,'alice'),false);
await assert.rejects(()=>service.upload('alice',id,token,jpeg,'image/jpeg'),{status:403});
assert.deepEqual((await service.read(issued.issuedPath)).bytes,jpeg);

// Exercise HTTP authorization and object access with an isolated server and store.
const app=express();app.use(express.json());
const auth:any=(req:any,res:any,next:any)=>{ if(!req.get('x-test-user')) return res.sendStatus(401); req.currentUser={id:req.get('x-test-user'),role:req.get('x-test-role')};next(); };
const write:any=(req:any,res:any,next:any)=>req.currentUser.role==='admin'?next():res.sendStatus(403);
const tickets=new Map<string,any>([[issued.issuedPath,{owner:'alice'}]]);
registerPhotoRoutes(app,{auth,write,read:(_req,_res,next)=>next(),ticketForPhoto:async path=>tickets.get(path),inScope:async(t,u)=>t.owner===u.id,service:()=>service});
const server=app.listen(0,'127.0.0.1');
await new Promise<void>(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${(server.address() as any).port}`;
const headers={'x-test-user':'alice','x-test-role':'admin'};
try {
  assert.equal((await fetch(base+issued.issuedPath)).status,401);
  assert.equal((await fetch(base+issued.issuedPath,{headers:{...headers,'x-test-user':'bob'}})).status,404);
  const read=await fetch(base+issued.issuedPath,{headers});
  assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(Buffer.from(await read.arrayBuffer()),jpeg);
  assert.equal((await fetch(base+'/api/backup/photo?path='+encodeURIComponent('https://evil.test/a'),{headers})).status,400);
  assert.equal((await fetch(base+'/api/backup/photo?path='+encodeURIComponent(issued.issuedPath),{headers:{...headers,'x-test-role':'viewer'}})).status,403);
  const prepared=await fetch(base+'/api/car-photos/upload',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({contentType:'image/jpeg',size:jpeg.length})});
  assert.equal(prepared.status,200);
  const pending=await prepared.json();
  assert.equal((await fetch(base+pending.uploadURL,{method:'PUT',headers:{...headers,'content-type':'image/jpeg'},body:jpeg})).status,204);
  assert.equal((await fetch(base+pending.issuedPath,{headers})).status,200);
  assert.equal((await fetch(base+pending.issuedPath,{headers:{...headers,'x-test-user':'bob'}})).status,404);
} finally { await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())); }
console.log('Photo tests passed: owner binding, tampering, expiry, replay, upload validation, restart persistence, scoped viewing and backup access.');
