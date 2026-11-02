import test from "node:test";
import assert from "node:assert/strict";
import {
  LOCATION_SCOPE_CHANGED_CLOSE_CODE,
  refreshUserLocationScopeSockets,
} from "./websocket-scope-refresh.mjs";

function socket(readyState = 1) {
  return {
    readyState,
    messages: [],
    closeCalls: [],
    send(message) { this.messages.push(message); },
    close(code, reason) { this.closeCalls.push({ code, reason }); },
  };
}

test("scope changes notify and reconnect only sockets owned by the changed user", () => {
  const affectedOne = socket();
  const affectedTwo = socket();
  const otherUserSameOu = socket();
  const alreadyClosed = socket(3);
  const clients = new Map([
    [affectedOne, { userId: "staff-1", ouId: "ou-1", scopedLocationIds: ["loc-old"] }],
    [affectedTwo, { userId: "staff-1", ouId: "ou-1", scopedLocationIds: ["loc-old"] }],
    [otherUserSameOu, { userId: "staff-2", ouId: "ou-1", scopedLocationIds: ["loc-new"] }],
    [alreadyClosed, { userId: "staff-1", ouId: "ou-1", scopedLocationIds: ["loc-old"] }],
  ]);

  assert.equal(refreshUserLocationScopeSockets(clients, "staff-1", 1), 2);
  for (const affected of [affectedOne, affectedTwo]) {
    assert.deepEqual(JSON.parse(affected.messages[0]), { type: "location_scope_changed" });
    assert.deepEqual(affected.closeCalls, [{ code: LOCATION_SCOPE_CHANGED_CLOSE_CODE, reason: "Location scopes changed" }]);
  }
  assert.deepEqual(otherUserSameOu.messages, []);
  assert.deepEqual(otherUserSameOu.closeCalls, []);
  assert.deepEqual(alreadyClosed.messages, []);
  assert.deepEqual(alreadyClosed.closeCalls, []);
});

test("a failed scope-change notification still closes the stale-scope socket", () => {
  const stale = socket();
  stale.send = () => { throw new Error("send failed"); };
  assert.equal(refreshUserLocationScopeSockets(new Map([[stale, { userId: "staff-1" }]]), "staff-1", 1), 1);
  assert.deepEqual(stale.closeCalls, [{ code: LOCATION_SCOPE_CHANGED_CLOSE_CODE, reason: "Location scopes changed" }]);
});
