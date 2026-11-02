import type { ValetTicket } from "@shared/schema";

export function isPublicTicketAuthorized(ticket: Pick<ValetTicket, "guestPin"> | null | undefined, pin: string): boolean;
export type PublicTicketStatus = Pick<ValetTicket,
  | "ticketNumber"
  | "status"
  | "visitorType"
  | "visitorSubType"
  | "createdAt"
  | "stageStartedAt"
  | "guestName"
  | "carMake"
  | "carModel"
  | "carColor"
  | "scheduledRetrievalAt"
>;
export function toPublicTicketStatus(ticket: ValetTicket): PublicTicketStatus;
