import test from "node:test";
import assert from "node:assert/strict";
import { isPublicTicketAuthorized, toPublicTicketStatus } from "./public-ticket-status.mjs";

test("public status projection excludes guest credentials and unrelated private fields", () => {
  const ticket = {
    ticketNumber: "T-1",
    status: "ready",
    guestPin: "a1b2",
    guestPhone: "private",
    internalNotes: "private",
    visitorType: "hotel_guest",
    createdAt: new Date(0),
    stageStartedAt: new Date(1),
  };
  assert.equal(isPublicTicketAuthorized(ticket, " A1B2 "), true);
  assert.equal(isPublicTicketAuthorized(ticket, "wrong"), false);
  const projected = toPublicTicketStatus(ticket);
  assert.equal(projected.status, "ready");
  assert.equal("guestPin" in projected, false);
  assert.equal("guestPhone" in projected, false);
  assert.equal("internalNotes" in projected, false);
});
