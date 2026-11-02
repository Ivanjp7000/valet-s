const OPEN = 1;

export function installWebSocketHeartbeat(wss, intervalMs = 25_000, schedule = setInterval, cancel = clearInterval) {
  const alive = new WeakSet();
  wss.on("connection", (socket) => {
    alive.add(socket);
    socket.on("pong", () => alive.add(socket));
  });

  const timer = schedule(() => {
    for (const socket of wss.clients) {
      if (socket.readyState !== OPEN) continue;
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.send(JSON.stringify({ type: "heartbeat" }));
      socket.ping();
    }
  }, intervalMs);
  timer?.unref?.();

  return () => cancel(timer);
}
