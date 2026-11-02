export function buildPublicTicketStreamRequest(ticketNumber: string, pin: string | undefined, origin: string): {
  url: string;
  init: {
    method: "GET";
    credentials: "include";
    headers: { Accept: "text/event-stream"; "X-Ticket-PIN"?: string };
  };
};
