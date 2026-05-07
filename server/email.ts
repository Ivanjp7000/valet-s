import { Resend } from 'resend';
import { format } from 'date-fns';

// Resend integration — connector: resend
let connectionSettings: any;

async function getResendCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) throw new Error('X-Replit-Token not found');

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken,
      },
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings?.settings?.api_key) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail: connectionSettings.settings.from_email || 'onboarding@resend.dev',
  };
}

// WARNING: Never cache — tokens expire. Call fresh each time.
async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getResendCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

export async function sendScheduledRetrievalReminder(opts: {
  to: string;
  guestName: string;
  ticketNumber: string;
  scheduledAt: Date;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const dateStr = format(opts.scheduledAt, 'EEEE, MMMM d, yyyy');
    const timeStr = format(opts.scheduledAt, 'h:mm a');

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

    const result = await client.emails.send({
      from: fromEmail,
      to: opts.to,
      subject: `Your vehicle retrieval is scheduled — ${dateStr} at ${timeStr}`,
      html,
    });

    if (result.error) {
      console.error('[email] Resend error:', result.error);
      return { sent: false, reason: result.error.message };
    }

    console.log('[email] Reminder sent to', opts.to, 'id:', result.data?.id);
    return { sent: true };
  } catch (err: any) {
    console.error('[email] Failed to send reminder:', err?.message || err);
    return { sent: false, reason: err?.message || 'Unknown error' };
  }
}
