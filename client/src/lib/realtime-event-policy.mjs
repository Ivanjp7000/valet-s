export function shouldRefreshStaffTicketData(type) {
  return typeof type === "string" &&
    (type.startsWith("ticket_") || type.startsWith("retrieval_") || type === "status_updated");
}

export function shouldFetchRealtimeUpdate(visibilityState) {
  return visibilityState === "visible";
}

export function createRealtimeInvalidationQueue(queryClient, getVisibilityState, schedule = setTimeout, cancel = clearTimeout) {
  const pending = new Map();
  let timer = null;
  const flush = () => {
    timer = null;
    const keys = [...pending.values()];
    pending.clear();
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  };

  return {
    invalidate(queryKey) {
      if (!shouldFetchRealtimeUpdate(getVisibilityState())) {
        void queryClient.invalidateQueries({ queryKey, refetchType: "none" });
        return;
      }
      pending.set(JSON.stringify(queryKey), queryKey);
      if (timer === null) timer = schedule(flush, 100);
    },
    dispose() {
      if (timer !== null) cancel(timer);
      timer = null;
      pending.clear();
    },
  };
}

export function shouldRefreshGuestServicesCount(type) {
  return typeof type === "string" && (
    type.startsWith("gs_message") || type === "gs_reply" || type === "gs_acknowledged" || type === "gs_event_created"
  );
}
