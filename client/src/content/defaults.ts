// Content defaults for valet-s.com
// Edit these values via the live editor at /view
// All pages read from ContentProvider context; changes reflect instantly

export interface LandingContent {
  header: {
    tagline: string;
    title: string;
    subtitle: string;
  };
  input: {
    heading: string;
    submit: string;
    searching: string;
    startHere: string;
    pinLabel: string;
    pinPlaceholder: string;
    pinHint: string;
  };
  confirmation: {
    pageTitle: string;
    pageSubtitle: string;
    ticketFound: string;
    confirmIdentity: string;
    retrieveNow: string;
    scheduleTime: string;
    cancel: string;
  };
  schedule: {
    heading: string;
    subheading: string;
    dateLabel: string;
    dateHint: string;
    timeLabel: string;
    emailLabel: string;
    emailOptional: string;
    emailPlaceholder: string;
    emailHint: string;
    confirm: string;
    confirming: string;
    back: string;
  };
  scheduled: {
    header: string;
    ticketPrefix: string;
    confirmedTitle: string;
    confirmedSub: string;
    dateLabel: string;
    changeHint: string;
  };
  faq: {
    sectionTitle: string;
    viewAll: string;
  };
  ticketInfo: {
    ticket: string;
    guest: string;
    vehicle: string;
    visit: string;
    arrived: string;
  };
  errors: {
    invalidTicket: string;
    invalidTicketDesc: string;
    tooManyAttempts: string;
    tooManyAttemptsDesc: string;
    lookupError: string;
    lookupErrorDesc: string;
    noDate: string;
    scheduleFailed: string;
    scheduleFailedDesc: string;
    connectionError: string;
    connectionErrorDesc: string;
    requestFailed: string;
    requestFailedDesc: string;
  };
}

export const defaultLanding: LandingContent = {
  header: {
    tagline: "Exclusive",
    title: "Valet Service",
    subtitle: "Retrieve your vehicle",
  },
  input: {
    heading: "Enter Your Ticket Number",
    submit: "Submit",
    searching: "Looking up…",
    startHere: "Start here",
    pinLabel: "PIN (from label)",
    pinPlaceholder: "e.g. AC36",
    pinHint: "4-character code printed on your label",
  },
  confirmation: {
    pageTitle: "Valet Service",
    pageSubtitle: "Vehicle Retrieval",
    ticketFound: "Ticket Found",
    confirmIdentity: "Please confirm your identity to proceed.",
    retrieveNow: "Retrieve My Car Now",
    scheduleTime: "Schedule a Retrieval Time",
    cancel: "Cancel",
  },
  schedule: {
    heading: "Schedule Retrieval",
    subheading: "Choose a Date & Time",
    dateLabel: "Date",
    dateHint: "Up to 7 days in advance",
    timeLabel: "Time",
    emailLabel: "Email Reminder",
    emailOptional: "(optional)",
    emailPlaceholder: "your@email.com",
    emailHint: "You'll receive a confirmation now, and another when your car is ready.",
    confirm: "Confirm Schedule",
    confirming: "Confirming…",
    back: "Back",
  },
  scheduled: {
    header: "Retrieval Scheduled",
    ticketPrefix: "Ticket #",
    confirmedTitle: "Your retrieval is confirmed",
    confirmedSub: "Our team will have your vehicle ready at the scheduled time.",
    dateLabel: "Date",
    changeHint: "To change your time, scan your ticket again and select a new schedule.",
  },
  faq: {
    sectionTitle: "Quick Help",
    viewAll: "View all FAQs →",
  },
  ticketInfo: {
    ticket: "Ticket",
    guest: "Guest",
    vehicle: "Vehicle",
    visit: "Visit",
    arrived: "Arrived",
  },
  errors: {
    invalidTicket: "Invalid Ticket",
    invalidTicketDesc: "Please enter your 5-character ticket number",
    tooManyAttempts: "Too Many Attempts",
    tooManyAttemptsDesc: "Please wait a moment before trying again.",
    lookupError: "Error",
    lookupErrorDesc: "Failed to look up ticket. Please try again.",
    noDate: "Please select a date and time",
    scheduleFailed: "Scheduling Failed",
    scheduleFailedDesc: "Please try again.",
    connectionError: "Connection Error",
    connectionErrorDesc: "Please try again.",
    requestFailed: "Request Failed",
    requestFailedDesc: "Could not add to queue. Please ask a staff member.",
  },
};

export interface ContentConfig {
  landing: LandingContent;
}

export const defaultContent: ContentConfig = {
  landing: defaultLanding,
};
