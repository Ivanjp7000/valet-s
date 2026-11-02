export function servePublicTicketStatusStream(options: {
  ticketNumber: string;
  pin: string;
  identityPresent: boolean;
  req: { on(event: string, listener: () => void): unknown };
  res: {
    on(event: string, listener: () => void): unknown;
    status(code: number): any;
    json(body: unknown): unknown;
    end(): unknown;
    writeHead(code: number, headers: Record<string, string>): unknown;
    flushHeaders?: () => void;
    write(data: string): boolean;
    writableEnded: boolean;
    headersSent: boolean;
    destroyed?: boolean;
  };
  readTicket(ticketNumber: string): Promise<any>;
  subscribe(ticketNumber: string, listener: (ticket: any | null) => void): () => void;
  rateLimitAllowed: boolean;
  acquireStreamSlot(): (() => void) | null;
  heartbeatMs?: number;
  scheduleInterval?: typeof setInterval;
  cancelInterval?: typeof clearInterval;
}): Promise<unknown>;
