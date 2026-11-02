export const LOCATION_SCOPE_CHANGED_CLOSE_CODE = 4001;

const LOCATION_SCOPE_CHANGED_MESSAGE = JSON.stringify({ type: "location_scope_changed" });
const scopeGenerations = new Map();

export function getUserLocationScopeGeneration(userId) {
  return scopeGenerations.get(String(userId)) ?? 0;
}

export function isUserLocationScopeSnapshotCurrent(userId, observedGeneration) {
  return getUserLocationScopeGeneration(userId) === observedGeneration;
}

/**
 * Notify and reconnect only the affected user's sockets after their DB scope is
 * changed. Reconnection re-reads scope from storage before ticket broadcasts.
 */
export function refreshUserLocationScopeSockets(clients, userId, openState) {
  const normalizedUserId = String(userId);
  scopeGenerations.set(normalizedUserId, getUserLocationScopeGeneration(normalizedUserId) + 1);
  let closed = 0;
  for (const [socket, info] of clients) {
    if (info.userId !== normalizedUserId) continue;
    // Remove first so a failed close cannot leave old-scope authorization in
    // the broadcast map. The socket is no longer eligible to receive payloads.
    clients.delete(socket);
    if (socket.readyState !== openState) continue;
    try {
      socket.send(LOCATION_SCOPE_CHANGED_MESSAGE);
    } catch {
      // Always close the old-scope socket even if the notification send fails.
    }
    try {
      socket.close(LOCATION_SCOPE_CHANGED_CLOSE_CODE, "Location scopes changed");
    } catch {
      // A socket that refuses graceful close must not keep stale privileges.
      try { socket.terminate?.(); } catch {}
    }
    closed += 1;
  }
  return closed;
}
