export function isPublicTicketAuthorized(ticket, pin) {
  return Boolean(ticket?.guestPin && pin && String(pin).trim().toUpperCase() === ticket.guestPin.toUpperCase());
}

export function toPublicTicketStatus(ticket) {
  return {
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    visitorType: ticket.visitorType,
    visitorSubType: ticket.visitorSubType,
    createdAt: ticket.createdAt,
    stageStartedAt: ticket.stageStartedAt,
    guestName: ticket.guestName,
    carMake: ticket.carMake,
    carModel: ticket.carModel,
    carColor: ticket.carColor,
    scheduledRetrievalAt: ticket.scheduledRetrievalAt,
  };
}
