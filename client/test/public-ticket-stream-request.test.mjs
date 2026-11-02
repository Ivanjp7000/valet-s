import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicTicketStreamRequest } from "../src/lib/public-ticket-stream-request.mjs";

test("stream requests keep guest PIN out of URL, query, and referrer-bearing path", () => {
  const request = buildPublicTicketStreamRequest("A-12345", "AB12", "https://valet.example");
  const url = new URL(request.url);
  assert.equal(url.pathname, "/api/tickets/A-12345/stream");
  assert.equal(url.search, "");
  assert.equal(url.toString().includes("AB12"), false);
  assert.equal(request.init.headers["X-Ticket-PIN"], "AB12");
});
