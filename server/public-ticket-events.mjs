// This bus is process-local. All Valet ticket writes in this server publish
// after the database commit. Keep the service single-replica unless this is
// replaced with a shared event transport; otherwise writes on another replica
// would not reach a stream connected here.
const listenersByTicket = new Map();

export function subscribeToPublicTicketChanges(ticketNumber, listener) {
  let listeners = listenersByTicket.get(ticketNumber);
  if (!listeners) {
    listeners = new Set();
    listenersByTicket.set(ticketNumber, listeners);
  }
  listeners.add(listener);
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    listeners.delete(listener);
    if (listeners.size === 0) listenersByTicket.delete(ticketNumber);
  };
}

export function publishPublicTicketChange(ticketNumber, ticketOrNull) {
  const listeners = listenersByTicket.get(ticketNumber);
  if (!listeners) return 0;
  for (const listener of [...listeners]) {
    try {
      listener(ticketOrNull);
    } catch {
      // A disconnected stream must never turn a completed database write into
      // a failed API request. Its response close handler removes the listener.
    }
  }
  return listeners.size;
}

export function getPublicTicketSubscriberCount(ticketNumber) {
  return listenersByTicket.get(ticketNumber)?.size ?? 0;
}
