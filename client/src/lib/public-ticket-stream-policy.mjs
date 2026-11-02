export const PUBLIC_TICKET_STREAM_FALLBACK_POLL_MS = 30_000;
const DEFAULT_RECONCILE_MS = 10 * 60_000 + 30_000;
const MIN_RECONCILE_MS = 6 * 60_000;
export function resolvePublicTicketReconcileMs(configuredValue) {
  const configuredReconcileMs = Number(configuredValue);
  return Number.isFinite(configuredReconcileMs) && configuredReconcileMs > 0
    ? Math.max(MIN_RECONCILE_MS, configuredReconcileMs)
    : DEFAULT_RECONCILE_MS;
}

export const PUBLIC_TICKET_STREAM_RECONCILE_MS = resolvePublicTicketReconcileMs(import.meta.env?.VITE_TICKET_STATUS_RECONCILE_MS);

export function publicTicketQueryEnabled({ hidden, connecting, revoked }) {
  return !hidden && !connecting && !revoked;
}

export function publicTicketLookupRevokesAccess(status) {
  return status === 400 || status === 404;
}

export function isPublicTicketStreamDisabledResponse(status, headerValue) {
  return status === 503 && headerValue === "true";
}

export function createPublicTicketEventGeneration() {
  let generation = 0;
  return {
    next() { generation += 1; return generation; },
    invalidate() { generation += 1; return generation; },
    isCurrent(candidate) { return candidate === generation; },
  };
}

export function publicTicketFallbackPollInterval({ connected, hidden, status }) {
  if (hidden || status === "completed") return false;
  if (connected) return PUBLIC_TICKET_STREAM_RECONCILE_MS;
  return PUBLIC_TICKET_STREAM_FALLBACK_POLL_MS;
}
