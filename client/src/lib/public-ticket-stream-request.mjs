export function buildPublicTicketStreamRequest(ticketNumber, pin, origin) {
  const url = new URL(`/api/tickets/${encodeURIComponent(ticketNumber)}/stream`, origin);
  return {
    url: url.toString(),
    init: {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "text/event-stream",
        ...(pin ? { "X-Ticket-PIN": pin } : {}),
      },
    },
  };
}
