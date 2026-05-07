import nodemailer from "nodemailer";
import { format } from "date-fns";

// Simple Gmail SMTP — set GMAIL_USER and GMAIL_APP_PASSWORD as environment secrets
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendScheduledRetrievalReminder(opts: {
  to: string;
  guestName: string;
  ticketNumber: string;
  scheduledAt: Date;
}): Promise<{ sent: boolean; reason?: string }> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[email] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email.");
    return { sent: false, reason: "Email not configured" };
  }

  const dateStr = format(opts.scheduledAt, "EEEE, MMMM d, yyyy");
  const timeStr = format(opts.scheduledAt, "h:mm a");
  const from = `"St. Regis Osaka Valet" <${process.env.GMAIL_USER}>`;

  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #e5e0d5; border-radius: 8px; overflow: hidden;">
      <div style="background: #1a2744; padding: 32px 36px; text-align: center;">
        <p style="color: #c9a84c; letter-spacing: 3px; font-size: 11px; text-transform: uppercase; margin: 0 0 8px;">St. Regis Osaka</p>
        <h1 style="color: #fff; font-size: 22px; font-weight: 400; margin: 0;">Valet Retrieval Confirmation</h1>
      </div>
      <div style="padding: 36px;">
        <p style="color: #555; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">Dear ${opts.guestName},</p>
        <p style="color: #555; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
          Your vehicle retrieval has been scheduled. Our valet team will have your car ready at the designated time.
        </p>
        <div style="background: #f9f7f3; border-left: 3px solid #c9a84c; border-radius: 4px; padding: 20px 24px; margin: 0 0 28px;">
          <p style="margin: 0 0 8px; color: #999; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">Scheduled Retrieval</p>
          <p style="margin: 0; color: #1a2744; font-size: 20px; font-weight: 600;">${dateStr}</p>
          <p style="margin: 4px 0 0; color: #c9a84c; font-size: 16px;">${timeStr}</p>
          <p style="margin: 12px 0 0; color: #777; font-size: 13px;">Ticket #${opts.ticketNumber}</p>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.7; margin: 0;">
          Please proceed to the valet entrance at your scheduled time. If your plans change, simply scan your ticket again and select a new time.
        </p>
      </div>
      <div style="background: #f4f2ee; padding: 20px 36px; text-align: center;">
        <p style="color: #aaa; font-size: 12px; margin: 0;">St. Regis Osaka &nbsp;·&nbsp; Valet Services</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: `Your vehicle retrieval is scheduled — ${dateStr} at ${timeStr}`,
      html,
    });
    console.log("[email] Reminder sent to", opts.to);
    return { sent: true };
  } catch (err: any) {
    console.error("[email] Send failed:", err?.message);
    return { sent: false, reason: err?.message };
  }
}
