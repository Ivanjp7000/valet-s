// Reminders never update ticket status or manufacture retrieval timings.
export function createScheduledReminderPoller<T extends {ticketNumber: string; scheduledRetrievalAt: Date | string | null}, L>(deps: {
  listeners: () => L[];
  upcoming: () => Promise<T[]>;
  mayReceive: (listener: L, ticket: T) => boolean;
  send: (listener: L, ticket: T, scheduledAt: string) => void;
}) {
  const alerted = new Map<L, Map<string, string>>();
  let running = false;
  return async () => {
    if (running) return;
    const listeners = deps.listeners();
    for (const listener of alerted.keys()) if (!listeners.includes(listener)) alerted.delete(listener);
    if (!listeners.length) return;
    running = true;
    try {
      const tickets = await deps.upcoming();
      const current = new Set(tickets.map(t => t.ticketNumber));
      for (const listener of deps.listeners()) {
        let seen = alerted.get(listener);
        if (!seen) { seen = new Map(); alerted.set(listener, seen); }
        for (const id of seen.keys()) if (!current.has(id)) seen.delete(id);
        for (const ticket of tickets) {
          if (!deps.mayReceive(listener, ticket)) continue;
          const date = new Date(ticket.scheduledRetrievalAt ?? '');
          if (!Number.isFinite(date.getTime())) continue;
          const scheduledAt = date.toISOString();
          if (seen.get(ticket.ticketNumber) === scheduledAt) continue;
          deps.send(listener, ticket, scheduledAt);
          seen.set(ticket.ticketNumber, scheduledAt);
        }
      }
    } finally { running = false; }
  };
}
