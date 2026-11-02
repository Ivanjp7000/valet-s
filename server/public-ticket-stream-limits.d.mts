export interface PublicTicketStreamLimiter {
  acquire(ticketNumber: string, ip: string): (() => void) | null;
  counts(ticketNumber: string, ip: string): { ip: number; ticket: number; total: number };
}
export function createPublicTicketStreamLimiter(options?: { perIp?: number; perTicket?: number; total?: number }): PublicTicketStreamLimiter;
export const publicTicketStreamLimiter: PublicTicketStreamLimiter;
