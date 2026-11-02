const STATUS_TRACKER_EVENTS = new Set([
  "ticket_status_updated",
  "ticket_updated",
  "ticket_details_updated",
  "ticket_deleted",
  "ticket_archived",
  "retrieval_requested",
  "retrieval_cancelled",
  "retrieval_accepted",
]);

export function shouldRefreshStaffTicketData(type) {
  return typeof type === "string" &&
    (type.startsWith("ticket_") || type.startsWith("retrieval_") || type === "status_updated");
}

export function shouldRefreshStatusTicket(type, data, ticketNumber) {
  return STATUS_TRACKER_EVENTS.has(type) && data?.ticketNumber === ticketNumber;
}

export function shouldRefreshGuestServicesCount(type) {
  return typeof type === "string" && (
    type.startsWith("gs_message") || type === "gs_reply" || type === "gs_acknowledged"
  );
}
