import type { ValetTicket } from "@shared/schema";

export function subscribeToPublicTicketChanges(
  ticketNumber: string,
  listener: (ticket: ValetTicket | null) => void,
): () => void;
export function publishPublicTicketChange(ticketNumber: string, ticket: ValetTicket | null): number;
export function getPublicTicketSubscriberCount(ticketNumber: string): number;
