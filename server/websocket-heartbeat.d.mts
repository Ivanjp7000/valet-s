export function installWebSocketHeartbeat(
  wss: { on(event: "connection", listener: (socket: any) => void): unknown; clients: Set<any> },
  intervalMs?: number,
  schedule?: (callback: () => void, intervalMs: number) => { unref?: () => void } | ReturnType<typeof setInterval>,
  cancel?: (timer: any) => void,
): () => void;
