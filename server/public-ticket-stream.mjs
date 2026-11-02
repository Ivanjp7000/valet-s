import { isPublicTicketAuthorized, toPublicTicketStatus } from "./public-ticket-status.mjs";

export async function servePublicTicketStatusStream({
  ticketNumber,
  pin,
  identityPresent,
  req,
  res,
  readTicket,
  subscribe,
  rateLimitAllowed,
  acquireStreamSlot,
  heartbeatMs = 20_000,
  scheduleInterval = setInterval,
  cancelInterval = clearInterval,
}) {
  let initializing = true;
  let dirtyDuringInitialization = false;
  let finished = false;
  let heartbeat = null;
  let unsubscribe = () => {};
  let releaseStreamSlot = () => {};

  const cleanup = (endResponse = false) => {
    if (finished) return;
    finished = true;
    if (heartbeat !== null) cancelInterval(heartbeat);
    heartbeat = null;
    unsubscribe();
    releaseStreamSlot();
    if (endResponse && !res.writableEnded) res.end();
  };
  res.on("close", () => cleanup());
  req.on("aborted", () => cleanup());

  if (!identityPresent) {
    cleanup();
    return res.status(400).json({ message: "PIN is required" });
  }
  if (!rateLimitAllowed) {
    cleanup();
    return res.status(429).json({ message: "Too many requests. Please wait before trying again." });
  }
  if (!pin) {
    cleanup();
    return res.status(400).json({ message: "PIN is required" });
  }
  const releaseSlot = acquireStreamSlot();
  if (!releaseSlot) {
    cleanup();
    return res.status(429).json({ message: "Too many status streams are already open. Please retry shortly." });
  }
  releaseStreamSlot = releaseSlot;

  const writeTicket = (ticket) => {
    if (finished) return;
    if (!ticket || !isPublicTicketAuthorized(ticket, pin)) {
      res.write("event: access-revoked\ndata: {}\n\n");
      cleanup(true);
      return;
    }
    const writable = res.write(`event: ticket\ndata: ${JSON.stringify(toPublicTicketStatus(ticket))}\n\n`);
    if (!writable) {
      cleanup(true);
      return;
    }
    if (ticket.status === "completed") cleanup(true);
  };

  unsubscribe = subscribe(ticketNumber, (ticket) => {
    if (initializing) {
      dirtyDuringInitialization = true;
      return;
    }
    writeTicket(ticket);
  });

  try {
    let ticket = await readTicket(ticketNumber);
    if (finished) return;
    while (dirtyDuringInitialization) {
      dirtyDuringInitialization = false;
      ticket = await readTicket(ticketNumber);
      if (finished) return;
    }
    if (!ticket || !isPublicTicketAuthorized(ticket, pin)) {
      cleanup();
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders?.();
    res.write("retry: 30000\n\n");
    initializing = false;
    writeTicket(ticket);
    if (!finished) {
      heartbeat = scheduleInterval(() => {
        if (!res.writableEnded && !res.write("event: heartbeat\ndata: {}\n\n")) cleanup(true);
      }, heartbeatMs);
    }
  } catch {
    const responseClosed = res.destroyed || res.writableEnded;
    cleanup();
    if (responseClosed) return;
    if (!res.headersSent) res.status(500).json({ message: "Failed to fetch ticket" });
    else res.end();
  }
}
