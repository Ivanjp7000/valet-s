import test from "node:test";
import assert from "node:assert/strict";
import { getPublicTicketSubscriberCount, publishPublicTicketChange, subscribeToPublicTicketChanges } from "./public-ticket-events.mjs";
import { servePublicTicketStatusStream } from "./public-ticket-stream.mjs";

function makeTicket(overrides = {}) {
  return {
    ticketNumber: "T-stream-test",
    guestPin: "A1B2",
    status: "active",
    visitorType: "hotel_guest",
    visitorSubType: null,
    createdAt: new Date(0),
    stageStartedAt: new Date(1),
    guestName: "Guest",
    carMake: "Sedan",
    carModel: "Model",
    carColor: "Blue",
    scheduledRetrievalAt: null,
    ...overrides,
  };
}

function harness({ readTicket, writeResult = true } = {}) {
  const output = [];
  const reqHandlers = new Map();
  const resHandlers = new Map();
  const response = {
    statusCode: null,
    headers: null,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    on(event, fn) { resHandlers.set(event, fn); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.headersSent = true; return this; },
    writeHead(code, headers) { this.statusCode = code; this.headers = headers; this.headersSent = true; },
    flushHeaders() {},
    write(data) { output.push(data); return writeResult; },
    end() { this.writableEnded = true; },
    emitClose() { resHandlers.get("close")?.(); },
  };
  const request = { on(event, fn) { reqHandlers.set(event, fn); } };
  let reads = 0;
  let releases = 0;
  let timerCallback = null;
  const options = {
    ticketNumber: "T-stream-test",
    pin: "A1B2",
    identityPresent: true,
    req: request,
    res: response,
    readTicket: async (number) => { reads += 1; return readTicket ? readTicket(number, reads) : makeTicket(); },
    subscribe: subscribeToPublicTicketChanges,
    rateLimitAllowed: true,
    acquireStreamSlot: () => () => { releases += 1; },
    scheduleInterval: (callback) => { timerCallback = callback; return 1; },
    cancelInterval: () => { timerCallback = null; },
  };
  return {
    options, output, response,
    get reads() { return reads; },
    get releases() { return releases; },
    get timerCallback() { return timerCallback; },
  };
}

test("SSE subscribes before its initial read and reconciles a concurrent ticket write", async () => {
  let resolveInitial;
  let current = makeTicket({ status: "active" });
  const h = harness({ readTicket: (_number, reads) => reads === 1
    ? new Promise((resolve) => { resolveInitial = resolve; })
    : Promise.resolve(current) });
  const served = servePublicTicketStatusStream(h.options);
  assert.equal(getPublicTicketSubscriberCount("T-stream-test"), 1);
  current = makeTicket({ status: "ready" });
  publishPublicTicketChange("T-stream-test", current);
  resolveInitial(makeTicket({ status: "active" }));
  await served;
  assert.equal(h.reads, 2);
  const initial = h.output.find((chunk) => chunk.startsWith("event: ticket"));
  assert.ok(initial.includes('"status":"ready"'));
  assert.equal(initial.includes("guestPin"), false);

  const next = makeTicket({ status: "completed" });
  publishPublicTicketChange("T-stream-test", next);
  assert.ok(h.output.at(-1).includes('"status":"completed"'));
  assert.equal(h.response.writableEnded, true);
  assert.equal(getPublicTicketSubscriberCount("T-stream-test"), 0);
  assert.equal(h.releases, 1);
});

test("PIN rotation or ticket deletion revokes and closes the existing stream without ticket data", async () => {
  for (const changed of [makeTicket({ guestPin: "NEWPIN" }), null]) {
    const h = harness();
    await servePublicTicketStatusStream(h.options);
    publishPublicTicketChange("T-stream-test", changed);
    assert.ok(h.output.at(-1).startsWith("event: access-revoked"));
    assert.equal(h.output.at(-1).includes("status"), false);
    assert.equal(h.response.writableEnded, true);
    assert.equal(getPublicTicketSubscriberCount("T-stream-test"), 0);
    assert.equal(h.releases, 1);
  }
});

test("completed tickets close immediately and do not start a heartbeat timer", async () => {
  const h = harness({ readTicket: async () => makeTicket({ status: "completed" }) });
  await servePublicTicketStatusStream(h.options);
  assert.ok(h.output.some((chunk) => chunk.includes('"status":"completed"')));
  assert.equal(h.response.writableEnded, true);
  assert.equal(h.timerCallback, null);
  assert.equal(getPublicTicketSubscriberCount("T-stream-test"), 0);
  assert.equal(h.releases, 1);
});

test("heartbeats are application-only and response close releases listeners and capacity", async () => {
  const h = harness();
  await servePublicTicketStatusStream(h.options);
  h.timerCallback();
  assert.ok(h.output.some((chunk) => chunk.startsWith("event: heartbeat")));
  h.response.emitClose();
  assert.equal(getPublicTicketSubscriberCount("T-stream-test"), 0);
  assert.equal(h.releases, 1);
});

test("missing identity, bad PIN, and rate limiting do not create a stream", async () => {
  const noIdentity = harness();
  await servePublicTicketStatusStream({ ...noIdentity.options, identityPresent: false });
  assert.equal(noIdentity.reads, 0);
  assert.equal(noIdentity.response.statusCode, 400);

  const badPin = harness();
  await servePublicTicketStatusStream({ ...badPin.options, pin: "wrong" });
  assert.equal(badPin.reads, 1);
  assert.equal(badPin.response.statusCode, 404);
  assert.equal(getPublicTicketSubscriberCount("T-stream-test"), 0);
  assert.equal(badPin.releases, 1);

  const rateLimited = harness();
  await servePublicTicketStatusStream({ ...rateLimited.options, rateLimitAllowed: false });
  assert.equal(rateLimited.reads, 0);
  assert.equal(rateLimited.response.statusCode, 429);
  assert.equal(rateLimited.releases, 0);
});

test("a slow response is closed instead of buffering unbounded ticket updates", async () => {
  const h = harness({ writeResult: false });
  await servePublicTicketStatusStream(h.options);
  assert.equal(h.response.writableEnded, true);
  assert.equal(getPublicTicketSubscriberCount("T-stream-test"), 0);
  assert.equal(h.releases, 1);
});
