import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldRefreshGuestServicesCount,
  shouldRefreshStaffTicketData,
  shouldRefreshStatusTicket,
} from "../src/lib/realtime-event-policy.mjs";

test("ticket mutations and retrieval queue events refresh staff list and counts", () => {
  for (const type of [
    "ticket_created", "ticket_updated", "ticket_deleted", "ticket_archived",
    "ticket_details_updated", "ticket_status_updated", "ticket_scheduled",
    "retrieval_requested", "retrieval_cancelled", "retrieval_accepted", "status_updated",
  ]) assert.equal(shouldRefreshStaffTicketData(type), true, type);
  assert.equal(shouldRefreshStaffTicketData("gs_message"), false);
});

test("status tracker refreshes only matching ticket events", () => {
  assert.equal(shouldRefreshStatusTicket("retrieval_requested", { ticketNumber: "A1" }, "A1"), true);
  assert.equal(shouldRefreshStatusTicket("ticket_deleted", { ticketNumber: "A1" }, "A1"), true);
  assert.equal(shouldRefreshStatusTicket("ticket_status_updated", { ticketNumber: "A2" }, "A1"), false);
  assert.equal(shouldRefreshStatusTicket("schedule_alert", { ticketNumber: "A1" }, "A1"), false);
});

test("all guest-message mutations refresh the inbox count", () => {
  for (const type of ["gs_message", "gs_message_updated", "gs_message_deleted", "gs_reply", "gs_acknowledged"])
    assert.equal(shouldRefreshGuestServicesCount(type), true, type);
  assert.equal(shouldRefreshGuestServicesCount("gs_event_created"), false);
});
