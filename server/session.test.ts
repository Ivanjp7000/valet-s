import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {WebSocket, WebSocketServer} from 'ws';

process.env.NODE_ENV='production';
process.env.ENABLE_DB_SESSION_STORE='false';
process.env.SESSION_SECRET='isolated-session-integration-test-secret';
const {setupAuth,getSession}=await import('./auth');
const app=express();
await setupAuth(app);
app.post('/login',(req:any,res)=>{req.session.user={claims:{sub:'test-staff'}};res.json({ok:true});});
const server=createServer(app);
const wss=new WebSocketServer({server});
const parser=getSession();
wss.on('connection',(ws,req:any)=>parser(req,{} as any,()=>{
  const id=req.session?.user?.claims?.sub;
  if(!id) ws.close(1008,'Authentication required'); else ws.send(id);
}));
server.listen(0,'127.0.0.1');await once(server,'listening');
const port=(server.address() as any).port;
try {
  const login=await fetch(`http://127.0.0.1:${port}/login`,{method:'POST',headers:{'X-Forwarded-Proto':'https'}});
  const cookie=login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  assert.match(login.headers.get('set-cookie')!, /SameSite=None/i);
  assert.match(login.headers.get('set-cookie')!, /Partitioned/i);
  assert.match(login.headers.get('set-cookie')!, /Secure/i);
  assert.match(login.headers.get('set-cookie')!, /HttpOnly/i);
  assert.match(login.headers.get('content-security-policy')!, /frame-ancestors 'self' https:\/\/studio-production-cb90.up.railway.app/);
  for (const headers of [
    {'Origin':'https://attacker.example'},
    {'Origin':'null'},
    {'Sec-Fetch-Site':'cross-site'},
  ]) assert.equal((await fetch(`http://127.0.0.1:${port}/login`,{method:'POST',headers})).status,403);
  assert.equal((await fetch(`http://127.0.0.1:${port}/login`,{method:'POST',headers:{Origin:`https://127.0.0.1:${port}`,'X-Forwarded-Proto':'https'}})).status,200);
  const staff=new WebSocket(`ws://127.0.0.1:${port}`,{headers:{cookie}});
  const [message]=await once(staff,'message');assert.equal(message.toString(),'test-staff');staff.close();await once(staff,'close');
  const anon=new WebSocket(`ws://127.0.0.1:${port}`);
  const [code]=await once(anon,'close');assert.equal(code,1008);
  console.log('Session integration passed: HTTP login authorizes WebSocket; anonymous socket rejected.');
} finally {wss.close();server.close();}
