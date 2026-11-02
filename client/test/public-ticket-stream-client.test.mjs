import test from "node:test";
import assert from "node:assert/strict";
import { ReadableStream } from "node:stream/web";
import { consumePublicTicketStream } from "../src/lib/public-ticket-stream-client.mjs";

function streamChunks(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

test("fetch SSE parser handles chunk boundaries, heartbeats, and ticket payloads", async () => {
  const tickets = [];
  let heartbeats = 0;
  await consumePublicTicketStream(streamChunks([
    "retry: 30000\r\n\r\nevent: heart",
    "beat\ndata: {}\n\n:event ping\n\nevent: ticket\ndata: {\"status\":",
    "\"ready\"}\n\n",
  ]), {
    onTicket: (data) => tickets.push(JSON.parse(data)),
    onHeartbeat: () => { heartbeats += 1; },
  });
  assert.deepEqual(tickets, [{ status: "ready" }]);
  assert.equal(heartbeats, 2);
});

test("fetch SSE parser dispatches credential revocation without exposing payload", async () => {
  let revoked = 0;
  await consumePublicTicketStream(streamChunks(["event: access-revoked\ndata: {}\n\n"]), {
    onTicket: () => assert.fail("revocation must not be delivered as a ticket"),
    onAccessRevoked: () => { revoked += 1; },
  });
  assert.equal(revoked, 1);
});

test("fetch SSE parser rejects oversized line and event payloads", async () => {
  await assert.rejects(
    consumePublicTicketStream(streamChunks([`data: ${"x".repeat(64 * 1024)}\n`]), {
      onTicket: () => {},
    }),
    /size limit/,
  );
  await assert.rejects(
    consumePublicTicketStream(streamChunks([`event: ticket\ndata: ${"x".repeat(64 * 1024)}\n\n`]), {
      onTicket: () => {},
    }),
    /size limit/,
  );
});
