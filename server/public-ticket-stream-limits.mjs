export function createPublicTicketStreamLimiter({ perIp = 100, perTicket = 50, total = 1_000 } = {}) {
  const byIp = new Map();
  const byTicket = new Map();
  let activeTotal = 0;
  const change = (map, key, delta) => {
    const next = (map.get(key) ?? 0) + delta;
    if (next <= 0) map.delete(key);
    else map.set(key, next);
  };
  return {
    acquire(ticketNumber, ip) {
      if (activeTotal >= total || (byIp.get(ip) ?? 0) >= perIp || (byTicket.get(ticketNumber) ?? 0) >= perTicket) return null;
      change(byIp, ip, 1);
      change(byTicket, ticketNumber, 1);
      activeTotal += 1;
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        change(byIp, ip, -1);
        change(byTicket, ticketNumber, -1);
        activeTotal -= 1;
      };
    },
    counts(ticketNumber, ip) {
      return { ip: byIp.get(ip) ?? 0, ticket: byTicket.get(ticketNumber) ?? 0, total: activeTotal };
    },
  };
}

export const publicTicketStreamLimiter = createPublicTicketStreamLimiter();
