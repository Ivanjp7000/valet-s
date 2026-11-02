import test from "node:test";
import assert from "node:assert/strict";
import { createPublicTicketEventGeneration, createSingleFlightRefresh, isPublicTicketStreamDisabledResponse, PUBLIC_TICKET_STREAM_FALLBACK_POLL_MS, PUBLIC_TICKET_STREAM_RECONCILE_MS, publicTicketFallbackPollInterval, publicTicketLookupRevokesAccess, publicTicketQueryEnabled, publicTicketVisibilityAction, resolvePublicTicketReconcileMs } from "../src/lib/public-ticket-stream-policy.mjs";

test("public tracker reconciles slowly when connected and pauses polling while hidden or terminal", () => {
  assert.equal(publicTicketFallbackPollInterval({ connected: true, hidden: false, status: "active" }), PUBLIC_TICKET_STREAM_RECONCILE_MS);
  assert.equal(publicTicketFallbackPollInterval({ connected: false, hidden: true, status: "active" }), false);
  assert.equal(publicTicketFallbackPollInterval({ connected: false, hidden: false, status: "completed" }), false);
  assert.equal(publicTicketFallbackPollInterval({ connected: false, hidden: false, status: "active" }), PUBLIC_TICKET_STREAM_FALLBACK_POLL_MS);
  assert.equal(PUBLIC_TICKET_STREAM_FALLBACK_POLL_MS, 30_000);
  assert.equal(PUBLIC_TICKET_STREAM_RECONCILE_MS, 630_000);
  assert.equal(resolvePublicTicketReconcileMs(300_000), 360_000);
  assert.equal(resolvePublicTicketReconcileMs(720_000), 720_000);
  assert.equal(resolvePublicTicketReconcileMs("invalid"), 630_000);
});

test("query counts stay below Neon idle threshold with healthy stream and resume fallback after hidden return", () => {
  const intervalReads = (intervalMs, durationMs) => Math.floor(durationMs / intervalMs);
  const tenMinutes = 10 * 60_000;

  // One initial SSE snapshot, no reconciliation before 10m30s.
  assert.equal(1 + intervalReads(PUBLIC_TICKET_STREAM_RECONCILE_MS, tenMinutes), 1);
  // Hidden time adds no reads; visibility return opens one fresh snapshot.
  assert.equal(publicTicketFallbackPollInterval({ connected: true, hidden: true, status: "active" }), false);
  assert.equal(1 + intervalReads(PUBLIC_TICKET_STREAM_RECONCILE_MS, tenMinutes), 1);
  // Manual check adds exactly one read; disconnected fallback is 20 periodic reads / 10m.
  assert.equal(1 + intervalReads(PUBLIC_TICKET_STREAM_RECONCILE_MS, tenMinutes) + 1, 2);
  assert.equal(intervalReads(PUBLIC_TICKET_STREAM_FALLBACK_POLL_MS, tenMinutes), 20);
});

test("visibility return re-enables queries after a disconnected hidden interval", () => {
  assert.equal(publicTicketQueryEnabled({ hidden: true, connecting: false, revoked: false }), false);
  assert.equal(publicTicketQueryEnabled({ hidden: false, connecting: true, revoked: false }), false);
  // Once the new stream snapshot arrives, query reconciliation resumes.
  assert.equal(publicTicketQueryEnabled({ hidden: false, connecting: false, revoked: false }), true);
  assert.equal(publicTicketFallbackPollInterval({ connected: true, hidden: false, status: "active" }), PUBLIC_TICKET_STREAM_RECONCILE_MS);
});

test("authoritative reconciliation revokes cached access on missing or rotated tickets", () => {
  assert.equal(publicTicketLookupRevokesAccess(400), true);
  assert.equal(publicTicketLookupRevokesAccess(404), true);
  assert.equal(publicTicketLookupRevokesAccess(429), false);
  assert.equal(publicTicketLookupRevokesAccess(500), false);
});

test("unknown or multi-replica stream response selects the polling fallback", () => {
  assert.equal(isPublicTicketStreamDisabledResponse(503, "true"), true);
  assert.equal(isPublicTicketStreamDisabledResponse(503, null), false);
  assert.equal(isPublicTicketStreamDisabledResponse(404, "true"), false);
  assert.equal(publicTicketFallbackPollInterval({ connected: false, hidden: false, status: "active" }), 30_000);
});

test("hidden return with disabled stream performs one immediate fallback lookup without focus", async () => {
  let calls = 0;
  let finish;
  const refresh = createSingleFlightRefresh(() => {
    calls += 1;
    return new Promise(resolve => { finish = resolve; });
  });

  assert.equal(publicTicketVisibilityAction({ hidden: true, streamUnavailable: true }), "pause");
  assert.equal(publicTicketVisibilityAction({ hidden: false, streamUnavailable: true }), "refresh");
  const visibleRefresh = refresh();
  const simultaneousFocusAndManualRefresh = refresh();
  assert.strictEqual(simultaneousFocusAndManualRefresh, visibleRefresh);
  await Promise.resolve();
  assert.equal(calls, 1);
  finish();
  await visibleRefresh;

  assert.equal(publicTicketVisibilityAction({ hidden: false, streamUnavailable: false }), "connect");
});

test("ticket events queued before credential revocation cannot repopulate removed cache", () => {
  const generation = createPublicTicketEventGeneration();
  const queuedEvent = generation.next();

  generation.invalidate(); // PIN rotation/deletion or component teardown

  assert.equal(generation.isCurrent(queuedEvent), false);
  assert.equal(generation.isCurrent(generation.next()), true);
});
