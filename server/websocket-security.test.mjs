import test from "node:test";
import assert from "node:assert/strict";
import { clearLogoutSessionCookies, isAllowedWebSocketOrigin } from "./websocket-security.mjs";

test("production WebSocket origin is restricted to the request host", () => {
  assert.equal(isAllowedWebSocketOrigin("https://valet.example", "valet.example", true), true);
  assert.equal(isAllowedWebSocketOrigin(undefined, "valet.example", true), true);
  assert.equal(isAllowedWebSocketOrigin("https://evil.example", "valet.example", true), false);
  assert.equal(isAllowedWebSocketOrigin("http://valet.example", "valet.example", true), false);
  assert.equal(isAllowedWebSocketOrigin("https://evil.example", "valet.example", false), true);
});

test("production logout clears both ordinary and partitioned session cookies", () => {
  const cleared = [];
  clearLogoutSessionCookies({ clearCookie: (...args) => cleared.push(args) }, true);
  assert.deepEqual(cleared, [
    ["connect.sid", { httpOnly: true, secure: true, sameSite: "lax", path: "/" }],
    ["connect.sid", { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/" }],
  ]);
});
