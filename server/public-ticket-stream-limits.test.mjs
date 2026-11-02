import test from "node:test";
import assert from "node:assert/strict";
import { createPublicTicketStreamLimiter } from "./public-ticket-stream-limits.mjs";

test("stream limits are scoped by IP and ticket and release slots once", () => {
  const limiter = createPublicTicketStreamLimiter({ perIp: 1, perTicket: 2, total: 2 });
  const release = limiter.acquire("T-1", "ip-1");
  assert.equal(typeof release, "function");
  assert.equal(limiter.acquire("T-2", "ip-1"), null);
  assert.equal(typeof limiter.acquire("T-1", "ip-2"), "function");
  release();
  release();
  assert.deepEqual(limiter.counts("T-1", "ip-1"), { ip: 0, ticket: 1, total: 1 });
  assert.equal(typeof limiter.acquire("T-2", "ip-1"), "function");
  assert.equal(limiter.acquire("T-3", "ip-3"), null);
});
