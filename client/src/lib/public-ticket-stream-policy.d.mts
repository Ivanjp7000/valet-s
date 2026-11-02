export const PUBLIC_TICKET_STREAM_FALLBACK_POLL_MS: number;
export const PUBLIC_TICKET_STREAM_RECONCILE_MS: number;
export function resolvePublicTicketReconcileMs(configuredValue: unknown): number;
export function publicTicketQueryEnabled(options: {
  hidden: boolean;
  connecting: boolean;
  revoked: boolean;
}): boolean;
export function publicTicketLookupRevokesAccess(status?: number): boolean;
export function isPublicTicketStreamDisabledResponse(status?: number, headerValue?: string | null): boolean;
export function createPublicTicketEventGeneration(): {
  next(): number;
  invalidate(): number;
  isCurrent(candidate: number): boolean;
};
export function publicTicketFallbackPollInterval(options: {
  connected: boolean;
  hidden: boolean;
  status?: string;
}): number | false;
