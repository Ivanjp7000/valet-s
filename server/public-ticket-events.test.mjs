import test from "node:test";
import assert from "node:assert/strict";
import {
  getPublicTicketSubscriberCount,
  publishPublicTicketChange,
  subscribeToPublicTicketChanges,
} from "./public-ticket-events.mjs";

test("ticket updates reach only subscribers for that ticket and unsubscribe cleanly", () => {
  const first = [];
  const other = [];
  const stopFirst = subscribeToPublicTicketChanges("T-1", (ticket) => first.push(ticket));
  const stopOther = subscribeToPublicTicketChanges("T-2", (ticket) => other.push(ticket));
  const changed = { ticketNumber: "T-1", status: "ready" };

  assert.equal(getPublicTicketSubscriberCount("T-1"), 1);
  assert.equal(publishPublicTicketChange("T-1", changed), 1);
  assert.deepEqual(first, [changed]);
  assert.deepEqual(other, []);

  stopFirst();
  stopFirst();
  assert.equal(getPublicTicketSubscriberCount("T-1"), 0);
  assert.equal(publishPublicTicketChange("T-1", null), 0);
  assert.deepEqual(first, [changed]);
  stopOther();
});

test("a broken stream listener cannot fail a completed ticket write", () => {
  const stop = subscribeToPublicTicketChanges("T-broken", () => { throw new Error("closed response"); });
  assert.doesNotThrow(() => publishPublicTicketChange("T-broken", { status: "ready" }));
  stop();
});
