export const LOCATION_SCOPE_CHANGED_CLOSE_CODE = 4001;

const LOCATION_SCOPE_CHANGED_MESSAGE = JSON.stringify({ type: "location_scope_changed" });

/**
 * Notify and reconnect only the affected user's sockets after their DB scope is
 * changed. Reconnection re-reads scope from storage before ticket broadcasts.
 */
export function refreshUserLocationScopeSockets(clients, userId, openState) {
  let closed = 0;
  for (const [socket, info] of clients) {
    if (info.userId !== String(userId) || socket.readyState !== openState) continue;
    try {
      socket.send(LOCATION_SCOPE_CHANGED_MESSAGE);
    } catch {
      // Always close the old-scope socket even if the notification send fails.
    }
    try {
      socket.close(LOCATION_SCOPE_CHANGED_CLOSE_CODE, "Location scopes changed");
    } catch {
      // The socket may already be closing; it must not remain in the live set.
    }
    closed += 1;
  }
  return closed;
}
