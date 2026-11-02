import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldRefreshGuestServicesCount,
  shouldRefreshStaffTicketData,
  shouldFetchRealtimeUpdate,
  createRealtimeInvalidationQueue,
} from "../src/lib/realtime-event-policy.mjs";

test("hidden tabs mark realtime data stale without fetching until visible", () => {
  assert.equal(shouldFetchRealtimeUpdate("hidden"), false);
  assert.equal(shouldFetchRealtimeUpdate("visible"), true);
});

test("hidden bursts defer reads and foreground bursts reconcile each query once", () => {
  let visibility = "hidden";
  let timerCallback;
  const calls = [];
  const client = { invalidateQueries: (filters) => calls.push(filters) };
  const queue = createRealtimeInvalidationQueue(client, () => visibility, (callback) => { timerCallback = callback; return 1; }, () => {});

  queue.invalidate(["tickets"]);
  queue.invalidate(["tickets"]);
  queue.invalidate(["stats"]);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.refetchType === "none"));

  visibility = "visible";
  queue.invalidate(["tickets"]);
  queue.invalidate(["tickets"]);
  queue.invalidate(["stats"]);
  assert.equal(calls.length, 3);
  timerCallback();
  assert.deepEqual(calls.slice(3).map((call) => call.queryKey), [["tickets"], ["stats"]]);
  queue.dispose();
});

test("ticket mutations and retrieval queue events refresh staff list and counts", () => {
  for (const type of [
    "ticket_created", "ticket_updated", "ticket_deleted", "ticket_archived",
    "ticket_details_updated", "ticket_status_updated", "ticket_scheduled",
    "retrieval_requested", "retrieval_cancelled", "retrieval_accepted", "status_updated",
  ]) assert.equal(shouldRefreshStaffTicketData(type), true, type);
  assert.equal(shouldRefreshStaffTicketData("gs_message"), false);
});

test("all guest-message mutations refresh the inbox count", () => {
  for (const type of ["gs_message", "gs_message_updated", "gs_message_deleted", "gs_reply", "gs_acknowledged", "gs_event_created"])
    assert.equal(shouldRefreshGuestServicesCount(type), true, type);
  assert.equal(shouldRefreshGuestServicesCount("gs_event_updated"), false);
});
