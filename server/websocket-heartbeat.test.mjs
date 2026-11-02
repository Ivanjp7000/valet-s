import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { installWebSocketHeartbeat } from "./websocket-heartbeat.mjs";

class FakeSocket extends EventEmitter {
  readyState = 1;
  pings = 0;
  messages = [];
  terminated = false;
  ping() { this.pings += 1; }
  send(message) { this.messages.push(message); }
  terminate() { this.terminated = true; this.readyState = 3; }
}

test("heartbeat detects a half-open socket without database polling", () => {
  const wss = new EventEmitter();
  wss.clients = new Set();
  let tick;
  const cleanup = installWebSocketHeartbeat(wss, 25_000, (callback) => { tick = callback; return {}; }, () => {});
  const socket = new FakeSocket();
  wss.clients.add(socket);
  wss.emit("connection", socket);

  tick();
  assert.equal(socket.pings, 1);
  assert.deepEqual(JSON.parse(socket.messages[0]), { type: "heartbeat" });
  socket.emit("pong");
  tick();
  assert.equal(socket.pings, 2);
  tick();
  assert.equal(socket.terminated, true);
  cleanup();
});
