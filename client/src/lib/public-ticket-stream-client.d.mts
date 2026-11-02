export function consumePublicTicketStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onTicket(data: string): void;
    onHeartbeat?(): void;
    onAccessRevoked?(): void;
  },
  signal?: AbortSignal,
): Promise<void>;
