import assert from 'node:assert/strict';
import express from 'express';
import {randomBytes} from 'node:crypto';
import {setupAuth, isAuthenticated} from './auth';
process.env.NODE_ENV = 'production';
process.env.ENABLE_DB_SESSION_STORE = 'false';
process.env.SESSION_SECRET = randomBytes(32).toString('hex');
const app = express();
await setupAuth(app);
app.get('/api/locations', isAuthenticated, (_req, res) => res.json([]));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
try {
  const address = server.address() as {port: number};
  const base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(base + '/api/login', {redirect: 'manual'});
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/staff');
  assert.equal((await fetch(base + '/api/locations')).status, 401);
  console.log('PASS: legacy login redirects to UI; locations remain authenticated');
} finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
