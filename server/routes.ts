import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import crypto from "crypto";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getSession } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertValetTicketSchema, updateValetTicketStatusSchema, insertFaqSchema, insertOUSchema, insertPhysicalLocationSchema, insertUserSchema, type User, insertOULicenseSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";

// In-memory OTP store: userId → { code, expiresAt }
const otpStore = new Map<string, { code: string; expiresAt: number }>();

// ── Email: car-ready reminder ─────────────────────────────────────────────────
async function sendCarReadyEmail(to: string, guestName: string, ticketNumber: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not set — skipping reminder email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'Valet Service <noreply@valet-s.com>',
      to: [to],
      subject: '🚗 Your Car is Ready for Pickup — Ticket #' + ticketNumber,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto"><h2 style="color:#1a2744">Your Vehicle is Ready!</h2><p>Dear ${guestName},</p><p>Your vehicle <strong>(Ticket #${ticketNumber})</strong> is ready and waiting for you at the valet entrance.</p><p>Please proceed to the pickup area at your earliest convenience.</p><hr/><p style="color:#888;font-size:12px">This message was sent automatically by the valet management system.</p></div>`,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }
  console.log(`[Email] Car-ready reminder sent to ${to} for ticket ${ticketNumber}`);
}

// ── Session Audit Helpers ─────────────────────────────────────────────────────

// Simple user-agent parser (no external package needed)
function parseUserAgent(ua: string): { deviceType: string; os: string; browser: string } {
  if (!ua) return { deviceType: 'Unknown', os: 'Unknown', browser: 'Unknown' };
  const isTablet = /iPad|Tablet|tablet/i.test(ua);
  const isMobile = !isTablet && /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const deviceType = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';

  let os = 'Unknown';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT 6\.3/.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6\.1/.test(ua)) os = 'Windows 7';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X ([\d_]+)/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    os = m ? 'macOS ' + m[1].replace(/_/g, '.') : 'macOS';
  } else if (/Android ([\d.]+)/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    os = m ? 'Android ' + m[1] : 'Android';
  } else if (/CPU iPhone OS ([\d_]+)|CPU OS ([\d_]+)/.test(ua)) {
    const m = ua.match(/CPU (?:iPhone )?OS ([\d_]+)/);
    os = m ? 'iOS ' + m[1].replace(/_/g, '.') : 'iOS';
  } else if (/Linux/.test(ua)) os = 'Linux';
  else if (/CrOS/.test(ua)) os = 'Chrome OS';

  let browser = 'Unknown';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera\//.test(ua)) browser = 'Opera';
  else if (/Chrome\/([\d]+)/.test(ua)) { const m = ua.match(/Chrome\/([\d]+)/); browser = m ? `Chrome ${m[1]}` : 'Chrome'; }
  else if (/Firefox\/([\d]+)/.test(ua)) { const m = ua.match(/Firefox\/([\d]+)/); browser = m ? `Firefox ${m[1]}` : 'Firefox'; }
  else if (/Safari\//.test(ua)) browser = 'Safari';

  return { deviceType, os, browser };
}

// Geo lookup cache: ip → { country, city }
const geoCache = new Map<string, { country: string; city: string }>();
async function lookupGeo(ip: string): Promise<{ country: string; city: string }> {
  const localPrefixes = ['127.', '::1', '192.168.', '10.', '172.', '::ffff:127.'];
  if (!ip || localPrefixes.some(p => ip.startsWith(p))) return { country: 'Local', city: 'Dev' };
  if (geoCache.has(ip)) return geoCache.get(ip)!;
  try {
    const resp = await fetch(`http://ip-api.com/json/${ip}?fields=country,city`, { signal: AbortSignal.timeout(3000) });
    const data: any = await resp.json();
    const result = { country: data.country || 'Unknown', city: data.city || '' };
    geoCache.set(ip, result);
    return result;
  } catch {
    return { country: 'Unknown', city: '' };
  }
}

// Track session — fire-and-forget, never blocks a request
async function trackSession(req: any): Promise<void> {
  try {
    const userId = req.user?.claims?.sub || req.session?.user?.claims?.sub;
    if (!userId || !req.sessionID) return;
    const user = await (await import('./storage')).storage.getUser(userId);
    if (!user) return;
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const ip = rawIp.replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    const { deviceType, os, browser } = parseUserAgent(ua);
    const geo = await lookupGeo(ip);
    await (await import('./storage')).storage.upsertSessionAudit({
      sessionId: req.sessionID,
      userId: user.id,
      username: user.username || user.email || user.id,
      displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
      role: user.role,
      ouId: user.ouId || undefined,
      ipAddress: ip || undefined,
      country: geo.country,
      city: geo.city,
      deviceType,
      os,
      browser,
    });
  } catch { /* silent */ }
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Gmail SMTP transporter
function getMailTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD is not set');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

async function sendOtpEmail(toEmail: string, code: string): Promise<void> {
  const transporter = getMailTransporter();
  const fromEmail = process.env.GMAIL_USER!;
  console.log(`[OTP email] Sending to=${toEmail} from=${fromEmail}`);
  const info = await transporter.sendMail({
    from: `"St. Regis Osaka Valet" <${fromEmail}>`,
    to: toEmail,
    subject: "Your Valet System Login Code",
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;border:1px solid #e5e0d5;border-radius:8px;overflow:hidden">
        <div style="background:#1a2744;padding:28px 36px;text-align:center">
          <p style="color:#c9a84c;letter-spacing:3px;font-size:11px;text-transform:uppercase;margin:0 0 6px">St. Regis Osaka</p>
          <h1 style="color:#fff;font-size:20px;font-weight:400;margin:0">Valet Management System</h1>
        </div>
        <div style="padding:36px">
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 20px">Your one-time login code is:</p>
          <div style="background:#f9f7f3;border-left:3px solid #c9a84c;border-radius:4px;padding:24px;text-align:center;letter-spacing:12px;font-size:36px;font-weight:700;color:#1a2744">${code}</div>
          <p style="color:#888;font-size:13px;margin-top:20px;line-height:1.6">This code expires in <strong>30 minutes</strong> and can only be used once. Do not share it with anyone.</p>
        </div>
        <div style="background:#f4f2ee;padding:16px 36px;text-align:center">
          <p style="color:#aaa;font-size:12px;margin:0">St. Regis Osaka &nbsp;·&nbsp; Valet Services</p>
        </div>
      </div>
    `,
  });
  console.log(`[OTP email] Sent OK messageId=${info.messageId}`);
}

async function sendVerificationEmail(toEmail: string, verifyUrl: string, fullName: string): Promise<void> {
  const transporter = getMailTransporter();
  const fromEmail = process.env.GMAIL_USER!;
  await transporter.sendMail({
    from: `"St. Regis Osaka Valet" <${fromEmail}>`,
    to: toEmail,
    subject: "Verify your email — St. Regis Osaka Valet System",
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;border:1px solid #e5e0d5;border-radius:8px;overflow:hidden">
        <div style="background:#1a2744;padding:28px 36px;text-align:center">
          <p style="color:#c9a84c;letter-spacing:3px;font-size:11px;text-transform:uppercase;margin:0 0 6px">St. Regis Osaka</p>
          <h1 style="color:#fff;font-size:20px;font-weight:400;margin:0">Verify Your Email Address</h1>
        </div>
        <div style="padding:36px">
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 16px">Dear ${fullName},</p>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 28px">Thank you for registering. Please click the button below to verify your email address and activate your account request.</p>
          <div style="text-align:center;margin-bottom:28px">
            <a href="${verifyUrl}" style="background:#1a2744;color:#fff;text-decoration:none;padding:14px 32px;border-radius:4px;font-size:15px;display:inline-block">Verify Email Address</a>
          </div>
          <p style="color:#888;font-size:13px;line-height:1.6">This link expires in 24 hours. If you did not request an account, you can safely ignore this email.</p>
          <p style="color:#aaa;font-size:12px;margin-top:16px;word-break:break-all">Or copy this link: ${verifyUrl}</p>
        </div>
        <div style="background:#f4f2ee;padding:16px 36px;text-align:center">
          <p style="color:#aaa;font-size:12px;margin:0">St. Regis Osaka &nbsp;·&nbsp; Valet Services</p>
        </div>
      </div>
    `,
  });
}

async function sendWelcomeEmail(toEmail: string, fullName: string): Promise<void> {
  const transporter = getMailTransporter();
  const fromEmail = process.env.GMAIL_USER!;
  const loginUrl = process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000';
  await transporter.sendMail({
    from: `"St. Regis Osaka Valet" <${fromEmail}>`,
    to: toEmail,
    subject: "Your account is ready — St. Regis Osaka Valet System",
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;border:1px solid #e5e0d5;border-radius:8px;overflow:hidden">
        <div style="background:#1a2744;padding:28px 36px;text-align:center">
          <p style="color:#c9a84c;letter-spacing:3px;font-size:11px;text-transform:uppercase;margin:0 0 6px">St. Regis Osaka</p>
          <h1 style="color:#fff;font-size:20px;font-weight:400;margin:0">Welcome to the Valet System</h1>
        </div>
        <div style="padding:36px">
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 16px">Dear ${fullName},</p>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 16px">Your account has been created. Here is how to log in:</p>
          <ol style="color:#555;font-size:15px;line-height:1.9;margin:0 0 28px;padding-left:20px">
            <li>Go to the login page and enter your email address: <strong>${toEmail}</strong></li>
            <li>A 6-digit verification code will be sent to this inbox</li>
            <li>Enter the code to access the system</li>
          </ol>
          <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 28px">No password is required — you will receive a new code every time you log in.</p>
          <div style="text-align:center;margin-bottom:28px">
            <a href="${loginUrl}" style="background:#1a2744;color:#fff;text-decoration:none;padding:14px 32px;border-radius:4px;font-size:15px;display:inline-block">Go to Login</a>
          </div>
        </div>
        <div style="background:#f4f2ee;padding:16px 36px;text-align:center">
          <p style="color:#aaa;font-size:12px;margin:0">St. Regis Osaka &nbsp;·&nbsp; Valet Services</p>
        </div>
      </div>
    `,
  });
}

async function sendApprovalEmail(toEmail: string, fullName: string): Promise<void> {
  const transporter = getMailTransporter();
  const fromEmail = process.env.GMAIL_USER!;
  await transporter.sendMail({
    from: `"St. Regis Osaka Valet" <${fromEmail}>`,
    to: toEmail,
    subject: "Your account has been approved — St. Regis Osaka Valet System",
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;border:1px solid #e5e0d5;border-radius:8px;overflow:hidden">
        <div style="background:#1a2744;padding:28px 36px;text-align:center">
          <p style="color:#c9a84c;letter-spacing:3px;font-size:11px;text-transform:uppercase;margin:0 0 6px">St. Regis Osaka</p>
          <h1 style="color:#fff;font-size:20px;font-weight:400;margin:0">Account Approved</h1>
        </div>
        <div style="padding:36px">
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 16px">Dear ${fullName},</p>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 28px">Your account has been approved. You can now log in using your email address. A one-time verification code will be sent to your email each time you log in.</p>
          <div style="text-align:center;margin-bottom:28px">
            <a href="${process.env.REPLIT_DOMAINS ? 'https://' + process.env.REPLIT_DOMAINS.split(',')[0] : ''}" style="background:#1a2744;color:#fff;text-decoration:none;padding:14px 32px;border-radius:4px;font-size:15px;display:inline-block">Log In Now</a>
          </div>
        </div>
        <div style="background:#f4f2ee;padding:16px 36px;text-align:center">
          <p style="color:#aaa;font-size:12px;margin:0">St. Regis Osaka &nbsp;·&nbsp; Valet Services</p>
        </div>
      </div>
    `,
  });
}

function sanitizeUser<T extends { password?: string | null }>(user: T): Omit<T, 'password'> & { hasPassword: boolean } {
  const { password, ...rest } = user;
  return { ...rest, hasPassword: !!password };
}

// In-memory rate limiter for public ticket endpoints
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count++;
  return true;
}

function namesMatch(input: string, stored: string): boolean {
  return input.trim().toLowerCase() === stored.trim().toLowerCase();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.post('/api/auth/local', async (req: any, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: "Username or email is required" });
      }

      // Look up by username first, then by email (for self-registered accounts)
      let user = await storage.getUserByUsername(username);
      if (!user && username.includes('@')) {
        user = await storage.getUserByEmail(username);
      }

      // Auto-provision new @stregis.com accounts on first login via /sro
      if (!user && username.includes('@') && username.toLowerCase().endsWith('@stregis.com')) {
        const ST_REGIS_OSAKA_OU_ID = 'dd16ee22-1d40-4db2-8cde-6a726673451a';
        const emailLower = username.trim().toLowerCase();
        const nameParts = emailLower.split('@')[0].replace(/[._-]/g, ' ').split(' ');
        const firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
        const lastName = nameParts.slice(1).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        user = await storage.createUser({
          username: emailLower,
          email: emailLower,
          firstName: firstName || emailLower,
          lastName: lastName || '',
          role: 'standard_user',
          twoFactorEnabled: true,
          isActive: true,
          accountStatus: 'active',
          ouId: ST_REGIS_OSAKA_OU_ID,
        } as any);
        // Notify all superadmins via WebSocket
        broadcastToOU(ST_REGIS_OSAKA_OU_ID, {
          type: 'new_stregis_account',
          data: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, createdAt: (user as any).createdAt },
        });
        console.log(`[SRO] Auto-provisioned new account: ${emailLower}`);
      }

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check account status for self-registered accounts
      if (user.accountStatus === 'pending_email_verification') {
        return res.status(403).json({ message: "Please verify your email address first. Check your inbox for the verification link." });
      }
      if (user.accountStatus === 'pending_approval') {
        return res.status(403).json({ message: "Your account is pending approval by an administrator. You will receive an email once it is activated." });
      }

      // Passwordless accounts (self-registered via email) skip password check
      const isPasswordlessAccount = !user.password;
      if (!isPasswordlessAccount) {
        if (!password) {
          return res.status(400).json({ message: "Username and password required" });
        }
        const isValidPassword = await bcrypt.compare(password, user.password!);
        if (!isValidPassword) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
      }

      // 2FA: required for self-registered accounts and any account with 2FA enabled
      if ((user.twoFactorEnabled || isPasswordlessAccount) && user.email) {
        const code = generateOtp();
        otpStore.set(user.id, { code, expiresAt: Date.now() + 30 * 60 * 1000 }); // 30 minutes
        try {
          await sendOtpEmail(user.email, code);
        } catch (emailErr) {
          console.error("Failed to send OTP email:", emailErr);
          return res.status(500).json({ message: "Failed to send verification code. Please try again." });
        }
        return res.json({ requiresTwoFactor: true, userId: user.id, email: user.email });
      }

      // No 2FA — create session immediately
      req.session.user = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl
        }
      };

      res.json({ 
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          mustChangePassword: user.mustChangePassword
        }
      });
    } catch (error) {
      console.error("Error during local authentication:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  // Verify OTP and complete login
  app.post('/api/auth/verify-otp', async (req: any, res) => {
    try {
      const { userId, code } = req.body;
      if (!userId || !code) return res.status(400).json({ message: "userId and code required" });

      const stored = otpStore.get(userId);
      if (!stored || Date.now() > stored.expiresAt) {
        otpStore.delete(userId);
        return res.status(401).json({ message: "Code expired. Please log in again." });
      }
      if (stored.code !== code) {
        return res.status(401).json({ message: "Invalid code. Please try again." });
      }

      otpStore.delete(userId);
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      req.session.user = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl
        }
      };

      res.json({ success: true });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  // Self-registration — Step 1: submit name + email
  app.post('/api/auth/register', async (req: any, res) => {
    try {
      const { fullName, email, captchaAnswer, captchaExpected } = req.body;
      if (!fullName || !email) return res.status(400).json({ message: "Full name and email are required" });
      const emailLower = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailLower)) return res.status(400).json({ message: "Please enter a valid email address" });
      if (captchaAnswer === undefined || captchaExpected === undefined) return res.status(400).json({ message: "Please complete the verification" });
      if (String(captchaAnswer).trim() !== String(captchaExpected).trim()) return res.status(400).json({ message: "Incorrect answer — please try again" });

      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';
      const isStRegis = emailLower.endsWith('@stregis.com');
      const ST_REGIS_OSAKA_OU_ID = 'dd16ee22-1d40-4db2-8cde-6a726673451a';
      const domain = (process.env.REPLIT_DOMAINS || '').split(',')[0]?.trim();
      const baseUrl = domain ? `https://${domain}` : 'http://localhost:5000';

      // Single lookup — getUserByUsername finds ALL records regardless of isActive
      const existingUser = await storage.getUserByUsername(emailLower);

      if (existingUser) {
        if (!existingUser.isActive) {
          // Soft-deleted — reactivate and restart the registration flow
        } else if (existingUser.accountStatus === 'active') {
          return res.status(409).json({ message: "An account with this email already exists. Please log in." });
        } else if (existingUser.accountStatus === 'pending_approval') {
          return res.status(409).json({ message: "Your account is already registered and awaiting admin approval. You will be notified by email once approved." });
        } else if (existingUser.accountStatus === 'pending_email_verification') {
          // Resend a fresh verification link
          const newToken = crypto.randomBytes(32).toString('hex');
          const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await storage.updateUser(existingUser.id, {
            firstName, lastName,
            emailVerificationToken: newToken,
            emailVerificationExpiresAt: newExpiry,
          } as any);
          const verifyUrl = `${baseUrl}/verify-email?token=${newToken}`;
          try { await sendVerificationEmail(emailLower, verifyUrl, fullName.trim()); } catch {}
          const msg = isStRegis
            ? "Almost there! A new verification link has been sent — please check your inbox."
            : "A new verification link has been sent. Once verified, your account will be reviewed within 48 business hours.";
          return res.json({ success: true, message: msg, isStRegis });
        }
      }

      // Generate token for new or reactivated record
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

      if (existingUser && !existingUser.isActive) {
        // Reuse soft-deleted record — avoids unique constraint violation on username/email
        await storage.updateUser(existingUser.id, {
          firstName, lastName,
          isActive: true,
          accountStatus: 'pending_email_verification',
          emailVerificationToken: verificationToken,
          emailVerificationExpiresAt: expiresAt,
          ouId: null as any,
          password: null as any,
          role: 'standard_user',
        } as any);
      } else {
        // Brand new user — no OU, no admin role; admin assigns both during approval
        await storage.createUser({
          username: emailLower,
          email: emailLower,
          firstName,
          lastName,
          role: 'standard_user',
          twoFactorEnabled: true,
          isActive: true,
          accountStatus: 'pending_email_verification',
          emailVerificationToken: verificationToken,
          emailVerificationExpiresAt: expiresAt,
        } as any);
      }

      try {
        await sendVerificationEmail(emailLower, verifyUrl, fullName.trim());
      } catch (emailErr) {
        console.error("[register] Failed to send verification email:", emailErr);
      }

      const message = isStRegis
        ? "Almost there! Please check your inbox and click the verification link to activate your account."
        : "Request received! Please check your inbox and click the verification link. Once verified, your account will be reviewed and activated within 48 business hours.";

      res.json({ success: true, message, isStRegis });
    } catch (err: any) {
      console.error("[register] Error:", err);
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });

  // Self-registration — Step 2: verify email via token link
  app.get('/api/auth/verify-email', async (req: any, res) => {
    try {
      const { token } = req.query;
      if (!token) return res.redirect('/verify-email?status=invalid');

      const user = await storage.getUserByVerificationToken(token as string);
      if (!user) return res.redirect('/verify-email?status=invalid');
      if (!user.emailVerificationExpiresAt || new Date() > user.emailVerificationExpiresAt) {
        return res.redirect('/verify-email?status=expired');
      }

      const isStRegis = (user.email || '').toLowerCase().endsWith('@stregis.com');
      const ST_REGIS_OSAKA_OU_ID = 'dd16ee22-1d40-4db2-8cde-6a726673451a';
      const newStatus = isStRegis ? 'active' : 'pending_approval';

      // Only assign to St. Regis Osaka OU if @stregis.com — others wait for manual approval with no OU
      await storage.updateUser(user.id, {
        accountStatus: newStatus,
        emailVerificationToken: null as any,
        emailVerificationExpiresAt: null as any,
        ...(isStRegis ? { ouId: ST_REGIS_OSAKA_OU_ID } : {}),
      } as any);

      if (isStRegis) {
        return res.redirect('/verify-email?status=approved');
      }
      return res.redirect('/verify-email?status=pending');
    } catch (err) {
      console.error("[verify-email] Error:", err);
      return res.redirect('/verify-email?status=error');
    }
  });

  // Password change endpoint
  app.post('/api/auth/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.claims.sub;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If user has a password, verify current password
      if (user.password) {
        if (!currentPassword) {
          return res.status(400).json({ message: "Current password is required" });
        }
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ message: "Current password is incorrect" });
        }
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { 
        password: hashedPassword, 
        mustChangePassword: false 
      });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user ? sanitizeUser(user) : user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Public routes (Customer facing)
  app.get('/api/tickets/:ticketNumber', async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const nameParam = typeof req.query.name === 'string' ? req.query.name.trim() : '';
      const pinParam = typeof req.query.pin === 'string' ? req.query.pin.trim().toUpperCase() : '';

      // Require name OR pin as a second factor — eliminates validity oracle
      if (!nameParam && !pinParam) {
        return res.status(400).json({ message: "Name or PIN is required" });
      }

      // Rate limit per-ticket — generous limit to allow continuous status polling
      // (3-second polling = 20/min = 300/15min; 600 gives 30min of headroom)
      const socketIp = req.socket?.remoteAddress || 'unknown';
      if (!checkRateLimit(`ticket-lookup:${ticketNumber}`, 600, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please wait before trying again." });
      }
      // Secondary IP-based limit (hotel WiFi may have many guests polling simultaneously)
      if (!checkRateLimit(`ticket-lookup-ip:${socketIp}`, 300, 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please wait before trying again." });
      }

      const ticket = await storage.getValetTicket(ticketNumber);

      // Verify identity:
      // - If PIN supplied AND ticket has a stored PIN → PIN must match (name is irrelevant)
      // - If PIN supplied but ticket has no stored PIN → fall back to name match
      // - If no PIN supplied → require name match
      let verified = false;
      if (!ticket) {
        verified = false;
      } else if (pinParam && ticket.guestPin) {
        verified = pinParam === ticket.guestPin.toUpperCase();
      } else {
        verified = !!nameParam && namesMatch(nameParam, ticket.guestName);
      }

      // Return the same 404 whether the ticket doesn't exist or verification fails
      // — prevents enumeration oracle
      if (!ticket || !verified) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json({
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
      });
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  // Public: customer requests car retrieval — queues it and alerts all staff in the OU
  app.post('/api/tickets/:ticketNumber/request-retrieval', async (req: any, res) => {
    try {
      const { ticketNumber: tn } = req.params;
      const socketIp = req.socket?.remoteAddress || 'unknown';
      if (!checkRateLimit(`ticket-write:${tn}`, 5, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }
      if (!checkRateLimit(`ticket-write-ip:${socketIp}`, 30, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }

      const { ticketNumber } = req.params;
      const { guestName, guestPin: bodyPin } = req.body;
      const pinParam = typeof bodyPin === 'string' ? bodyPin.trim().toUpperCase() : '';

      if (!guestName?.trim() && !pinParam) {
        return res.status(400).json({ message: "Name or PIN verification is required" });
      }

      const ticket = await storage.getValetTicket(ticketNumber);

      // Verify identity (same authoritative-PIN logic as the GET lookup):
      // - PIN supplied AND ticket has stored PIN → PIN must match (name is irrelevant)
      // - PIN supplied but ticket has no stored PIN → fall back to name match
      // - No PIN supplied → require name match
      let retrievalVerified = false;
      if (!ticket) {
        retrievalVerified = false;
      } else if (pinParam && ticket.guestPin) {
        retrievalVerified = pinParam === ticket.guestPin.toUpperCase();
      } else {
        retrievalVerified = !!guestName?.trim() && namesMatch(guestName, ticket.guestName);
      }
      if (!ticket || !retrievalVerified) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      if (ticket.status !== 'active') {
        return res.status(400).json({ message: "Ticket is not in active status" });
      }

      const updated = await storage.updateValetTicketStatus(ticketNumber, 'retrieval_requested');

      broadcastToOU(updated!.ouId, {
        type: 'retrieval_requested',
        data: {
          ticketNumber: updated!.ticketNumber,
          guestName: updated!.guestName,
          carMake: updated!.carMake,
          carModel: updated!.carModel,
          carColor: updated!.carColor,
          licensePlate: updated!.licensePlate,
          visitorType: updated!.visitorType,
          visitorSubType: updated!.visitorSubType,
          ouId: updated!.ouId,
          locationId: updated!.locationId,
          parkingLocation: updated!.parkingLocation,
          parkingSector: updated!.parkingSector,
        },
      });

      res.json({ message: "Added to retrieval queue" });
    } catch (error) {
      console.error("Error requesting retrieval:", error);
      res.status(500).json({ message: "Failed to request retrieval" });
    }
  });

  // Public: customer cancels their own retrieval request — moves ticket back to 'active'
  app.post('/api/tickets/:ticketNumber/cancel-retrieval', async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const { guestName, guestPin: bodyPin } = req.body;
      const pinParam = typeof bodyPin === 'string' ? bodyPin.trim().toUpperCase() : '';
      if (!guestName?.trim() && !pinParam) {
        return res.status(400).json({ message: 'Name or PIN required' });
      }
      const ticket = await storage.getValetTicket(ticketNumber);
      let cancelVerified = false;
      if (!ticket) {
        cancelVerified = false;
      } else if (pinParam && ticket.guestPin) {
        cancelVerified = pinParam === ticket.guestPin.toUpperCase();
      } else {
        cancelVerified = !!guestName?.trim() && namesMatch(guestName, ticket.guestName);
      }
      if (!ticket || !cancelVerified) {
        return res.status(404).json({ message: 'Ticket not found' });
      }
      if (ticket.status !== 'retrieval_requested') {
        return res.status(400).json({ message: 'No pending retrieval request to cancel' });
      }
      const updated = await storage.updateValetTicketStatus(ticketNumber, 'active');
      // Clear the scheduled retrieval time when a guest cancels their request
      await storage.updateValetTicket(ticketNumber, { scheduledRetrievalAt: null });
      broadcastToOU(updated!.ouId, {
        type: 'retrieval_cancelled',
        data: { ticketNumber },
      });
      broadcastToOU(updated!.ouId, {
        type: 'ticket_scheduled',
        data: { ticketNumber, scheduledRetrievalAt: null },
      });
      res.json({ message: 'Retrieval request cancelled' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Schedule a future retrieval
  app.post('/api/tickets/:ticketNumber/schedule-retrieval', async (req: any, res) => {
    try {
      const { ticketNumber: tn } = req.params;
      const socketIp = req.socket?.remoteAddress || 'unknown';
      if (!checkRateLimit(`ticket-write:${tn}`, 5, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }
      if (!checkRateLimit(`ticket-write-ip:${socketIp}`, 30, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }

      const { ticketNumber } = req.params;
      const { scheduledAt, guestName, guestPin: bodyPin, reminderEmail } = req.body;
      const pinParam = typeof bodyPin === 'string' ? bodyPin.trim().toUpperCase() : '';

      if (!pinParam && (!guestName || typeof guestName !== 'string' || !guestName.trim())) {
        return res.status(400).json({ message: "Name or PIN verification is required" });
      }

      if (!scheduledAt) {
        return res.status(400).json({ message: "scheduledAt is required" });
      }

      const scheduledDate = new Date(scheduledAt);
      const now = new Date();
      const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: "Invalid date" });
      }
      if (scheduledDate <= now) {
        return res.status(400).json({ message: "Scheduled time must be in the future" });
      }
      if (scheduledDate > maxDate) {
        return res.status(400).json({ message: "Cannot schedule more than 7 days in advance" });
      }

      const ticket = await storage.getValetTicket(ticketNumber);
      let verified = false;
      if (!ticket) {
        verified = false;
      } else if (pinParam && ticket.guestPin) {
        verified = pinParam === ticket.guestPin.toUpperCase();
      } else {
        verified = !!guestName?.trim() && namesMatch(guestName, ticket.guestName);
      }
      // Return the same 404 for both not-found and verification-failure — eliminates oracle
      if (!ticket || !verified) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      if (!['active', 'pending'].includes(ticket.status)) {
        return res.status(400).json({ message: "Ticket is not available for scheduling" });
      }

      const updates: Record<string, any> = { scheduledRetrievalAt: scheduledDate };
      if (reminderEmail && typeof reminderEmail === 'string' && reminderEmail.includes('@')) {
        updates.reminderEmail = reminderEmail.trim().toLowerCase();
      }
      const updated = await storage.updateValetTicket(ticketNumber, updates);

      // Notify staff in real time
      broadcastToOU(ticket.ouId, {
        type: 'ticket_scheduled',
        data: {
          ticketNumber: ticket.ticketNumber,
          guestName: ticket.guestName,
          scheduledRetrievalAt: scheduledDate.toISOString(),
          ouId: ticket.ouId,
        },
      });
      // Also push a status update so the customer tracker refreshes
      broadcastToOU(ticket.ouId, {
        type: 'ticket_status_updated',
        data: updated ?? ticket,
      });

      res.json({ success: true, scheduledRetrievalAt: scheduledDate.toISOString() });
    } catch (error) {
      console.error("Error scheduling retrieval:", error);
      res.status(500).json({ message: "Failed to schedule retrieval" });
    }
  });

  app.get('/api/faqs', async (req, res) => {
    try {
      const faqs = await storage.getFaqs();
      res.json(faqs);
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      res.status(500).json({ message: "Failed to fetch FAQs" });
    }
  });

  // Role-based middleware
  const requireSuperAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub || req.session?.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ message: "Super admin access required" });
    }
    req.currentUser = user;
    next();
  };

  const requirePrivilegeAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub || req.session?.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const user = await storage.getUser(userId);
    if (!user || !['superadmin', 'privilege_admin'].includes(user.role)) {
      return res.status(403).json({ message: "Privilege admin access required" });
    }
    req.currentUser = user;
    next();
  };

  const requireStandardAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub || req.session?.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const user = await storage.getUser(userId);
    if (!user || !['superadmin', 'privilege_admin', 'standard_admin'].includes(user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    req.currentUser = user;
    next();
  };

  // Authenticated staff: schedule a retrieval time for a ticket
  app.post('/api/staff/tickets/:ticketNumber/schedule-retrieval', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const { scheduledAt } = req.body;

      if (!scheduledAt) {
        return res.status(400).json({ message: "scheduledAt is required" });
      }

      const scheduledDate = new Date(scheduledAt);
      const now = new Date();
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: "Invalid date" });
      }
      if (scheduledDate <= now) {
        return res.status(400).json({ message: "Scheduled time must be in the future" });
      }

      const ticket = await storage.getValetTicket(ticketNumber);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(ticket, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (!['active', 'pending'].includes(ticket.status)) {
        return res.status(400).json({ message: "Ticket is not available for scheduling" });
      }

      const updated = await storage.updateValetTicket(ticketNumber, { scheduledRetrievalAt: scheduledDate });

      broadcastToOU(ticket.ouId, {
        type: 'ticket_scheduled',
        data: {
          ticketNumber: ticket.ticketNumber,
          guestName: ticket.guestName,
          scheduledRetrievalAt: scheduledDate.toISOString(),
          ouId: ticket.ouId,
        },
      });
      broadcastToOU(ticket.ouId, {
        type: 'ticket_status_updated',
        data: updated ?? ticket,
      });

      res.json({ success: true, scheduledRetrievalAt: scheduledDate.toISOString() });
    } catch (error) {
      console.error("Error scheduling retrieval (staff):", error);
      res.status(500).json({ message: "Failed to schedule retrieval" });
    }
  });

  // Authenticated staff: clear scheduled retrieval time
  app.delete('/api/staff/tickets/:ticketNumber/schedule-retrieval', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;

      const ticket = await storage.getValetTicket(ticketNumber);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(ticket, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updated = await storage.updateValetTicket(ticketNumber, { scheduledRetrievalAt: null });

      broadcastToOU(ticket.ouId, {
        type: 'ticket_scheduled',
        data: { ticketNumber: ticket.ticketNumber, scheduledRetrievalAt: null, ouId: ticket.ouId },
      });
      broadcastToOU(ticket.ouId, {
        type: 'ticket_status_updated',
        data: updated ?? ticket,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing schedule (staff):", error);
      res.status(500).json({ message: "Failed to clear schedule" });
    }
  });

  // Read-only access - allows Standard Users to VIEW data but not modify
  const requireReadAccess = async (req: any, res: any, next: any) => {
    const userId = req.user?.claims?.sub || req.session?.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const user = await storage.getUser(userId);
    if (!user || !['superadmin', 'privilege_admin', 'standard_admin', 'standard_user'].includes(user.role)) {
      return res.status(403).json({ message: "Access required" });
    }
    req.currentUser = user;
    next();
  };

  // Helper to get user's scoped location IDs (for Standard Admins/Users with location restrictions)
  const getUserScopedLocationIds = async (user: any): Promise<string[] | undefined> => {
    if (!['standard_admin', 'standard_user'].includes(user.role)) return undefined;
    const scopes = await storage.getUserLocationScopes(user.id);
    if (scopes.length === 0) return undefined; // No restrictions, see full OU
    return scopes.map(s => s.locationId);
  };

  // Helper to verify the current user may access/mutate a specific ticket
  // Returns true when authorized, false when the request must be rejected with 403
  const isTicketInScope = async (ticket: any, user: any): Promise<boolean> => {
    if (user.role === 'superadmin') return true;
    if (ticket.ouId !== user.ouId) return false;
    const scopedLocationIds = await getUserScopedLocationIds(user);
    if (scopedLocationIds) {
      // Scoped users must have an explicit location match — null-location tickets are outside their scope
      if (!ticket.locationId || !scopedLocationIds.includes(ticket.locationId)) {
        return false;
      }
    }
    return true;
  };

  // Staff: accept a retrieval request — moves ticket to 'retrieving' and starts the timer
  app.post('/api/tickets/:ticketNumber/accept-retrieval', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const ticket = await storage.getValetTicket(ticketNumber);

      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(ticket, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (ticket.status !== 'retrieval_requested') {
        return res.status(400).json({ message: "Ticket is not awaiting retrieval" });
      }

      const updated = await storage.updateValetTicketStatus(ticketNumber, 'retrieving');

      // Notify staff (retrieval_accepted removes popup)
      broadcastToOU(updated!.ouId, {
        type: 'retrieval_accepted',
        data: updated,
      });
      // Also send ticket_status_updated so the customer's phone WS gets an instant push
      broadcastToOU(updated!.ouId, {
        type: 'ticket_status_updated',
        data: updated,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error accepting retrieval:", error);
      res.status(500).json({ message: "Failed to accept retrieval" });
    }
  });

  // Protected routes (Staff/Admin only) - read access for all staff including standard_user
  app.get('/api/staff/tickets', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser;
      const scopedLocationIds = await getUserScopedLocationIds(user);
      const activeTickets = await storage.getScopedActiveTickets(user, scopedLocationIds);
      res.json(activeTickets);
    } catch (error) {
      console.error("Error fetching active tickets:", error);
      res.status(500).json({ message: "Failed to fetch active tickets" });
    }
  });

  // Create new valet ticket with full details
  app.post('/api/staff/tickets', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const { 
        visitorType, visitorSubType, guestName,
        carMake, carModel, carColor, licensePlate, platePhotoUrl, carPhoto,
        locationId, parkingSector, parkingLocation, 
        createdByUserId, createdByName
      } = req.body;

      const PSEUDO_TICKET = 'X7777';
      let ticketNumber: string = req.body.ticketNumber;

      // Validate required fields
      if (!ticketNumber || (ticketNumber !== PSEUDO_TICKET && !/^\d{5}$/.test(ticketNumber))) {
        return res.status(400).json({ message: "Invalid ticket number. Must be 5 digits." });
      }
      if (!visitorType || !guestName || !carMake || !carModel || !carColor) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // For pseudo tickets generate a unique placeholder number (P + 4 digits)
      if (ticketNumber === PSEUDO_TICKET) {
        let unique = false;
        let attempts = 0;
        while (!unique && attempts < 20) {
          const candidate = 'P' + String(Math.floor(1000 + Math.random() * 9000));
          const existing = await storage.getValetTicket(candidate);
          if (!existing) {
            ticketNumber = candidate;
            unique = true;
          }
          attempts++;
        }
        if (!unique) {
          return res.status(500).json({ message: "Could not generate a unique ticket number. Please try again." });
        }
      } else {
        const existingTicket = await storage.getValetTicket(ticketNumber);
        if (existingTicket) {
          return res.status(400).json({ message: "Ticket number " + ticketNumber + " is already in use. Please check the ticket and try again." });
        }
      }

      // Derive ouId from location or from current user
      let ouId: string | null = null;

      // Location-scoped users must always supply a locationId
      if (['standard_admin', 'standard_user'].includes(currentUser.role)) {
        const scopedLocationIds = await getUserScopedLocationIds(currentUser);
        if (scopedLocationIds) {
          if (!locationId) {
            return res.status(403).json({ message: "Access denied: a location is required for your account" });
          }
          if (!scopedLocationIds.includes(locationId)) {
            return res.status(403).json({ message: "Access denied: you are not assigned to this location" });
          }
        }
      }

      if (locationId) {
        const location = await storage.getLocation(locationId);
        if (!location) {
          return res.status(400).json({ message: "Invalid location" });
        }
        // Non-superadmin users may only create tickets in their own OU
        if (currentUser.role !== 'superadmin' && location.ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "Access denied: location is outside your organization" });
        }
        ouId = location.ouId;
      }
      // Fallback to user's OU if no location or location has no OU
      if (!ouId && currentUser.ouId) {
        ouId = currentUser.ouId;
      }
      
      // Ensure ouId is set for proper scoping
      if (!ouId) {
        return res.status(400).json({ message: "Cannot determine organization. Please select a location or ensure your account is assigned to an organization." });
      }

      // Auto-determine roster category from visitorType
      const autoRosterCategory = (visitorType === 'restaurant' || visitorType === 'event' || visitorType === 'others') ? 'events' : 'arriving';

      const { guestPin } = req.body;

      const ticket = await storage.createValetTicket({
        ticketNumber,
        visitorType,
        visitorSubType: visitorSubType || null,
        guestName,
        guestPin: guestPin || null,
        carMake,
        carModel,
        carColor,
        licensePlate: licensePlate || null,
        platePhotoUrl: platePhotoUrl || null,
        carPhoto: carPhoto || null,
        locationId: locationId || null,
        ouId: ouId,
        parkingSector: parkingSector || null,
        parkingLocation: parkingLocation || null,
        createdByUserId: createdByUserId || null,
        createdByName: createdByName || null,
        status: 'active',
        inRoster: true,
        rosterCategory: autoRosterCategory,
      });

      // Broadcast to all connected WebSocket clients in the same OU
      broadcastToOU(ticket.ouId, {
        type: 'ticket_created',
        data: ticket
      });

      res.json(ticket);
    } catch (error) {
      console.error("Error creating valet ticket:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  app.patch('/api/staff/tickets/:ticketNumber/status', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const { status } = updateValetTicketStatusSchema.parse(req.body);

      const existing = await storage.getValetTicket(ticketNumber);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(existing, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      let ticket = await storage.updateValetTicketStatus(ticketNumber, status);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Auto-update rosterCategory when ticket is completed (departed, no coming back)
      if (status === 'completed') {
        const depCategory = (existing.visitorType === 'restaurant' || existing.visitorType === 'event' || existing.visitorType === 'others') ? 'events' : 'departing';
        ticket = await storage.updateValetTicket(ticketNumber, { rosterCategory: depCategory, inRoster: true }) ?? ticket;
      }

      // When car is ready, send reminder email if guest provided one
      if (status === 'ready' && existing.reminderEmail) {
        sendCarReadyEmail(existing.reminderEmail, existing.guestName ?? 'Guest', existing.ticketNumber).catch((e: any) => {
          console.error('[Email] Failed to send car-ready reminder:', e.message);
        });
      }

      // Broadcast status update to clients in the same OU
      broadcastToOU(ticket!.ouId, {
        type: 'ticket_status_updated',
        data: ticket
      });

      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket status:", error);
      res.status(400).json({ message: "Invalid status update" });
    }
  });

  // Guest returns with car after "Coming Back" - records time out and moves back to active
  app.post('/api/staff/tickets/:ticketNumber/guest-returned', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;

      const existing = await storage.getValetTicket(ticketNumber);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(existing, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const ticket = await storage.markGuestReturned(ticketNumber);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found or guest had not departed" });
      }

      // Broadcast status update to clients in the same OU
      broadcastToOU(ticket!.ouId, {
        type: 'ticket_status_updated',
        data: ticket
      });

      res.json(ticket);
    } catch (error) {
      console.error("Error marking guest returned:", error);
      res.status(400).json({ message: "Failed to mark guest as returned" });
    }
  });

  // Get guest trip history for a ticket
  app.get('/api/staff/tickets/:ticketNumber/trips', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const ticket = await storage.getValetTicket(ticketNumber);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(ticket, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const trips = await storage.getTicketGuestTrips(ticket.id);
      res.json(trips);
    } catch (error) {
      console.error("Error fetching guest trips:", error);
      res.status(500).json({ message: "Failed to fetch guest trips" });
    }
  });

  // Edit a specific guest trip
  app.patch('/api/staff/trips/:tripId', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { tripId } = req.params;
      const { departedAt, returnedAt } = req.body;
      if (!departedAt) return res.status(400).json({ message: "departedAt is required" });

      const tripRecord = await storage.getGuestTripById(tripId);
      if (!tripRecord) return res.status(404).json({ message: "Trip not found" });
      const ticketForAuth = await storage.getValetTicketById(tripRecord.ticketId);
      if (!ticketForAuth || !await isTicketInScope(ticketForAuth, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const trip = await storage.updateGuestTrip(
        tripId,
        new Date(departedAt),
        returnedAt ? new Date(returnedAt) : null
      );
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      res.json(trip);
    } catch (error) {
      console.error("Error updating guest trip:", error);
      res.status(500).json({ message: "Failed to update trip" });
    }
  });

  // Delete a specific guest trip
  app.delete('/api/staff/trips/:tripId', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { tripId } = req.params;

      const tripRecord = await storage.getGuestTripById(tripId);
      if (!tripRecord) return res.status(404).json({ message: "Trip not found" });
      const ticketForAuth = await storage.getValetTicketById(tripRecord.ticketId);
      if (!ticketForAuth || !await isTicketInScope(ticketForAuth, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const deleted = await storage.deleteGuestTrip(tripId);
      if (!deleted) return res.status(404).json({ message: "Trip not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting guest trip:", error);
      res.status(500).json({ message: "Failed to delete trip" });
    }
  });

  app.get('/api/staff/stats', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser;
      const scopedLocationIds = await getUserScopedLocationIds(user);
      const allTickets = await storage.getScopedTickets(user, scopedLocationIds);
      
      // Filter for different status counts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const completedToday = allTickets.filter(t =>
        t.status === 'completed' &&
        t.updatedAt && new Date(t.updatedAt) >= today
      );

      // Calculate real average retrieval duration (retrieving → ready) from today's completed tickets
      const withSLA = completedToday.filter(t => t.retrievalDurationSeconds && t.retrievalDurationSeconds > 0);
      let avgTime = '—';
      if (withSLA.length > 0) {
        const avgSec = withSLA.reduce((sum, t) => sum + (t.retrievalDurationSeconds ?? 0), 0) / withSLA.length;
        const mins = Math.floor(avgSec / 60);
        const secs = Math.round(avgSec % 60);
        avgTime = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
      }

      const stats = {
        pending: allTickets.filter(t => t.status === 'active' || t.status === 'retrieving').length,
        transit: allTickets.filter(t => t.status === 'transit').length,
        ready: allTickets.filter(t => t.status === 'ready').length,
        completed: completedToday.length,
        avgTime,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Reset password endpoint (Super Admin only)
  app.post('/api/admin/users/:userId/reset-password', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { newPassword, forceChange } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(userId, { 
        password: hashedPassword, 
        mustChangePassword: forceChange !== false // Default to true
      });

      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // ===== PENDING REGISTRATIONS (Super Admin Only) =====
  // New auto-approved @stregis.com accounts (last 30 days), excluding acknowledged ones
  app.get('/api/admin/new-stregis-accounts', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const allUsers = await storage.getAllUsers();
      const ackedSetting = await storage.getSystemSetting('acknowledged_stregis_ids');
      const ackedIds: string[] = ackedSetting ? JSON.parse(ackedSetting.value) : [];
      const newAccounts = allUsers.filter((u: any) =>
        u.email?.toLowerCase().endsWith('@stregis.com') &&
        u.accountStatus === 'active' &&
        u.createdAt && new Date(u.createdAt) >= since &&
        !u.password &&
        !ackedIds.includes(u.id)
      ).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(newAccounts.map((u: any) => ({
        id: u.id, firstName: u.firstName, lastName: u.lastName,
        email: u.email, createdAt: u.createdAt, role: u.role,
      })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch new accounts" });
    }
  });

  // Acknowledge a new @stregis.com account (removes it from the notification list)
  app.post('/api/admin/new-stregis-accounts/:id/acknowledge', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const ackedSetting = await storage.getSystemSetting('acknowledged_stregis_ids');
      const ackedIds: string[] = ackedSetting ? JSON.parse(ackedSetting.value) : [];
      if (!ackedIds.includes(id)) ackedIds.push(id);
      await storage.upsertSystemSetting({ key: 'acknowledged_stregis_ids', value: JSON.stringify(ackedIds) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to acknowledge account" });
    }
  });

  app.get('/api/admin/pending-registrations', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const pending = await storage.getPendingRegistrations();
      res.json(pending.map((u: any) => ({
        id: u.id, firstName: u.firstName, lastName: u.lastName,
        email: u.email, createdAt: u.createdAt,
      })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pending registrations" });
    }
  });

  app.post('/api/admin/pending-registrations/:id/approve', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { ouId, role } = req.body;
      if (!ouId) return res.status(400).json({ message: "You must assign an Organization (OU) before approving." });
      if (!role || !['privilege_admin', 'standard_admin', 'standard_user'].includes(role)) {
        return res.status(400).json({ message: "You must assign a valid role before approving." });
      }
      const user = await storage.getUser(id);
      const status = (user as any).accountStatus;
      if (!user || (status !== 'pending_approval' && status !== 'pending_email_verification')) return res.status(404).json({ message: "Not found" });
      await storage.updateUser(id, { accountStatus: 'active', ouId, role } as any);
      if (user.email) {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
        try {
          await sendApprovalEmail(user.email, fullName || 'there');
          console.log(`[approve] Email sent to ${user.email}`);
        } catch (e: any) {
          console.error("[approve] Email failed:", e?.message || e);
        }
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to approve registration" });
    }
  });

  app.post('/api/admin/pending-registrations/:id/reject', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "Not found" });
      await storage.updateUser(id, { isActive: false } as any);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to reject registration" });
    }
  });

  // ===== ORGANIZATIONAL UNIT ROUTES (Super Admin Only) =====
  app.get('/api/ous', isAuthenticated, async (req, res) => {
    try {
      const sessionUser = req.user as any;
      const userId = sessionUser?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get full user from database to access role and ouId
      const authUser = await storage.getUser(userId);
      if (!authUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Super Admin sees all OUs
      if (authUser.role === 'superadmin') {
        const ous = await storage.getAllOUs();
        return res.json(ous);
      }
      // Privilege Admin and others see only their own OU
      if (authUser.ouId) {
        const ou = await storage.getOU(authUser.ouId);
        return res.json(ou ? [ou] : []);
      }
      res.json([]);
    } catch (error) {
      console.error("Error fetching OUs:", error);
      res.status(500).json({ message: "Failed to fetch organizational units" });
    }
  });

  app.post('/api/ous', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const ouData = insertOUSchema.parse(req.body);
      const ou = await storage.createOU(ouData);
      res.json(ou);
    } catch (error) {
      console.error("Error creating OU:", error);
      res.status(400).json({ message: "Invalid OU data" });
    }
  });

  app.patch('/api/ous/:id', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const ouData = insertOUSchema.partial().parse(req.body);
      const ou = await storage.updateOU(id, ouData);
      if (!ou) return res.status(404).json({ message: "OU not found" });
      res.json(ou);
    } catch (error) {
      console.error("Error updating OU:", error);
      res.status(400).json({ message: "Invalid OU data" });
    }
  });

  app.delete('/api/ous/:id', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteOU(id);
      res.json({ message: "OU deleted successfully" });
    } catch (error) {
      console.error("Error deleting OU:", error);
      res.status(500).json({ message: "Failed to delete OU" });
    }
  });

  // ===== PHYSICAL LOCATION ROUTES (Privilege Admin and above) =====
  app.get('/api/locations', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser;
      // Super Admin sees all, others see their OU's locations
      if (user.role === 'superadmin') {
        const locations = await storage.getAllLocations();
        res.json(locations);
      } else if (user.ouId) {
        const locations = await storage.getLocationsByOU(user.ouId);
        res.json(locations);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.get('/api/locations/ou/:ouId', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const { ouId } = req.params;
      const user = req.currentUser;
      
      // Privilege Admin can only see their assigned OU
      if (user.role !== 'superadmin' && user.ouId !== ouId) {
        return res.status(403).json({ message: "Access denied to this OU" });
      }
      
      const locations = await storage.getLocationsByOU(ouId);
      res.json(locations);
    } catch (error) {
      console.error("Error fetching locations by OU:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.post('/api/locations', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser;
      const locationData = insertPhysicalLocationSchema.parse(req.body);
      
      // Privilege Admin can only add locations to their OU
      if (user.role !== 'superadmin' && user.ouId !== locationData.ouId) {
        return res.status(403).json({ message: "Can only add locations to your assigned OU" });
      }
      
      const location = await storage.createLocation(locationData);
      res.json(location);
    } catch (error) {
      console.error("Error creating location:", error);
      res.status(400).json({ message: "Invalid location data" });
    }
  });

  app.patch('/api/locations/:id', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.currentUser;
      
      // Check if user has access to this location
      const existingLocation = await storage.getLocation(id);
      if (!existingLocation) return res.status(404).json({ message: "Location not found" });
      
      if (user.role !== 'superadmin' && user.ouId !== existingLocation.ouId) {
        return res.status(403).json({ message: "Access denied to this location" });
      }
      
      // Parse and sanitize the update data
      const { ouId, ...safeLocationData } = insertPhysicalLocationSchema.partial().parse(req.body);
      
      // Privilege Admin cannot move location to different OU
      if (user.role !== 'superadmin' && ouId && ouId !== existingLocation.ouId) {
        return res.status(403).json({ message: "You cannot move locations to a different organization" });
      }
      
      // Only Super Admin can change OU assignment
      const updateData = user.role === 'superadmin' && ouId 
        ? { ...safeLocationData, ouId } 
        : safeLocationData;
      
      const location = await storage.updateLocation(id, updateData);
      res.json(location);
    } catch (error) {
      console.error("Error updating location:", error);
      res.status(400).json({ message: "Invalid location data" });
    }
  });

  app.delete('/api/locations/:id', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.currentUser;
      
      const existingLocation = await storage.getLocation(id);
      if (!existingLocation) return res.status(404).json({ message: "Location not found" });
      
      if (user.role !== 'superadmin' && user.ouId !== existingLocation.ouId) {
        return res.status(403).json({ message: "Access denied to this location" });
      }
      
      await storage.deleteLocation(id);
      res.json({ message: "Location deleted successfully" });
    } catch (error) {
      console.error("Error deleting location:", error);
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  // ===== ENHANCED USER MANAGEMENT ROUTES =====
  // Get users based on role permissions
  app.get('/api/users', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser;
      
      if (user.role === 'superadmin') {
        // Super Admin sees all users
        const users = await storage.getAllUsers();
        res.json(users.map(sanitizeUser));
      } else {
        // Privilege Admin sees standard admins and standard users in their OU
        const users = await storage.getUsersByOU(user.ouId!);
        const filteredUsers = users.filter(u => ['standard_admin', 'standard_user'].includes(u.role));
        res.json(filteredUsers.map(sanitizeUser));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Create user with role-based permissions
  app.post('/api/users', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const { username, password, email, firstName, lastName, role, ouId, locationId } = req.body;
      
      // Validate role assignment permissions
      if (currentUser.role === 'privilege_admin') {
        // Privilege Admin can only create standard_admin or standard_user accounts
        if (role && !['standard_admin', 'standard_user'].includes(role)) {
          return res.status(403).json({ message: "You can only create standard admin or standard user accounts" });
        }
        // Must assign to their OU
        if (ouId && ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "You can only create users in your OU" });
        }
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Determine OU assignment based on role
      // Super Admins don't belong to any OU (ouId should be null)
      const finalRole = role || 'standard_admin';
      const finalOuId = finalRole === 'superadmin' ? null : (ouId || currentUser.ouId);
      
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        role: finalRole,
        ouId: finalOuId,
        locationId: locationId || null,
        createdBy: currentUser.id,
      });
      
      // Don't return password in response
      const { password: _, ...userWithoutPassword } = newUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Error creating user:", error);
      // Check for duplicate username constraint violation
      if (error?.code === '23505' && error?.constraint === 'users_username_key') {
        return res.status(400).json({ message: "Username already exists. Please choose a different username." });
      }
      // Check for duplicate email constraint violation
      if (error?.code === '23505' && error?.constraint === 'users_email_unique') {
        return res.status(400).json({ message: "Email already exists. Please use a different email address." });
      }
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  // Update user
  app.patch('/api/users/:id', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.currentUser;
      const targetUser = await storage.getUser(id);
      
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      
      // Privilege Admin can only modify standard_admin or standard_user in their OU
      if (currentUser.role === 'privilege_admin') {
        if (!['standard_admin', 'standard_user'].includes(targetUser.role) || targetUser.ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "You can only modify standard admins or standard users in your OU" });
        }
      }
      
      const { password, role, ouId, locationId, ...safeUpdateData } = req.body;
      
      // Privilege Admin cannot change role to higher levels or change OU assignment
      if (currentUser.role === 'privilege_admin') {
        if (role && !['standard_admin', 'standard_user'].includes(role)) {
          return res.status(403).json({ message: "You can only assign standard admin or standard user roles" });
        }
        if (ouId && ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "You cannot move users to a different OU" });
        }
      }
      
      // Super Admin can change roles, but Privilege Admin cannot escalate
      const updateData: any = { ...safeUpdateData };
      if (currentUser.role === 'superadmin') {
        if (role) updateData.role = role;
        if (ouId) updateData.ouId = ouId;
      }
      
      // Handle locationId - convert empty string to null
      if (locationId !== undefined) {
        updateData.locationId = locationId || null;
      }

      // Pre-check email uniqueness (excluding the user being updated)
      if (updateData.email) {
        const existingEmail = await storage.getUserByEmail(updateData.email);
        if (existingEmail && existingEmail.id !== id) {
          return res.status(400).json({ message: "Email already in use by another account. Please use a different email address." });
        }
      }

      // Pre-check username uniqueness (excluding the user being updated)
      if (updateData.username) {
        const existingUsername = await storage.getUserByUsername(updateData.username);
        if (existingUsername && existingUsername.id !== id) {
          return res.status(400).json({ message: "Username already taken. Please choose a different username." });
        }
      }
      
      // If password is being updated, hash it
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      
      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) return res.status(404).json({ message: "User not found" });
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error("Error updating user:", error);
      const cause = error?.cause || error;
      if (cause?.code === '23505' && cause?.constraint === 'users_email_unique') {
        return res.status(400).json({ message: "Email already in use by another account. Please use a different email address." });
      }
      if (cause?.code === '23505' && cause?.constraint === 'users_username_key') {
        return res.status(400).json({ message: "Username already taken. Please choose a different username." });
      }
      res.status(400).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete('/api/users/:id', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.currentUser;
      const targetUser = await storage.getUser(id);
      
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      
      // Privilege Admin can only delete standard_admin or standard_user in their OU
      if (currentUser.role === 'privilege_admin') {
        if (!['standard_admin', 'standard_user'].includes(targetUser.role) || targetUser.ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "You can only delete standard admins or standard users in your OU" });
        }
      }
      
      // Super Admin cannot delete themselves
      if (currentUser.id === id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Toggle hidden status for a user (Super Admin only)
  app.patch('/api/users/:id/toggle-hidden', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const targetUser = await storage.getUser(id);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      const updated = await storage.updateUser(id, { isHidden: !(targetUser as any).isHidden });
      res.json({ success: true, isHidden: (updated as any)?.isHidden });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle hidden status" });
    }
  });

  // Toggle 2FA for a user (Super Admin only)
  app.patch('/api/users/:id/toggle-2fa', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const targetUser = await storage.getUser(id);
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      const updated = await storage.updateUser(id, { twoFactorEnabled: !targetUser.twoFactorEnabled });
      if (!updated) return res.status(500).json({ message: "Failed to update user" });
      res.json(sanitizeUser(updated));
    } catch (error) {
      console.error("Error toggling 2FA:", error);
      res.status(500).json({ message: "Failed to toggle 2FA" });
    }
  });

  // ===== USER LOCATION SCOPE ROUTES (Privilege Admin and above) =====
  // Get location scopes for a user
  app.get('/api/users/:userId/location-scopes', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const currentUser = req.currentUser;
      const targetUser = await storage.getUser(userId);
      
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      
      // Privilege Admin can only view scopes for standard_admin or standard_user in their OU
      if (currentUser.role === 'privilege_admin') {
        if (!['standard_admin', 'standard_user'].includes(targetUser.role) || targetUser.ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const scopes = await storage.getUserLocationScopes(userId);
      res.json(scopes);
    } catch (error) {
      console.error("Error fetching user location scopes:", error);
      res.status(500).json({ message: "Failed to fetch location scopes" });
    }
  });

  // Add location scope to a user (Privilege Admin assigns Standard Admin/User to specific locations)
  app.post('/api/users/:userId/location-scopes', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { locationId } = req.body;
      const currentUser = req.currentUser;
      
      if (!locationId) {
        return res.status(400).json({ message: "Location ID is required" });
      }
      
      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      
      // Privilege Admin can only assign scopes to standard_admin or standard_user in their OU
      if (currentUser.role === 'privilege_admin') {
        if (!['standard_admin', 'standard_user'].includes(targetUser.role) || targetUser.ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "You can only assign location scopes to standard admins or users in your OU" });
        }
      }
      
      // Verify location exists and is in the user's OU
      const location = await storage.getLocation(locationId);
      if (!location) return res.status(404).json({ message: "Location not found" });
      
      if (location.ouId !== targetUser.ouId) {
        return res.status(400).json({ message: "Location must be in the user's OU" });
      }
      
      const scope = await storage.addUserLocationScope({ userId, locationId });
      res.json(scope);
    } catch (error) {
      console.error("Error adding user location scope:", error);
      res.status(400).json({ message: "Failed to add location scope" });
    }
  });

  // Remove location scope from a user
  app.delete('/api/users/:userId/location-scopes/:locationId', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const { userId, locationId } = req.params;
      const currentUser = req.currentUser;
      
      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      
      // Privilege Admin can only remove scopes from standard_admin or standard_user in their OU
      if (currentUser.role === 'privilege_admin') {
        if (!['standard_admin', 'standard_user'].includes(targetUser.role) || targetUser.ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      await storage.removeUserLocationScope(userId, locationId);
      res.json({ message: "Location scope removed successfully" });
    } catch (error) {
      console.error("Error removing user location scope:", error);
      res.status(500).json({ message: "Failed to remove location scope" });
    }
  });

  // Get all users with their location scopes (for admin UI)
  app.get('/api/users-with-scopes', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      
      if (currentUser.role === 'superadmin') {
        // Super Admin: Get all users with scopes
        const users = await storage.getAllUsers();
        const usersWithScopes = await Promise.all(
          users.map(async (user) => ({
            ...sanitizeUser(user),
            locationScopes: await storage.getUserLocationScopes(user.id)
          }))
        );
        res.json(usersWithScopes);
      } else if (currentUser.ouId) {
        // Privilege Admin: Get standard admins and standard users in their OU with scopes
        const result = await storage.getUsersWithLocationScopes(currentUser.ouId);
        const filteredResult = result
          .filter(r => ['standard_admin', 'standard_user'].includes(r.user.role))
          .map(r => ({ ...sanitizeUser(r.user), locationScopes: r.scopes }));
        res.json(filteredResult);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching users with scopes:", error);
      res.status(500).json({ message: "Failed to fetch users with scopes" });
    }
  });

  // ===== FAQ ROUTES (Super Admin Only) =====
  app.post('/api/admin/faqs', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const faqData = insertFaqSchema.parse(req.body);
      const faq = await storage.createFaq(faqData);
      res.json(faq);
    } catch (error) {
      console.error("Error creating FAQ:", error);
      res.status(400).json({ message: "Invalid FAQ data" });
    }
  });

  app.patch('/api/admin/faqs/:id', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const faqData = insertFaqSchema.partial().parse(req.body);
      const faq = await storage.updateFaq(id, faqData);
      
      if (!faq) {
        return res.status(404).json({ message: "FAQ not found" });
      }

      res.json(faq);
    } catch (error) {
      console.error("Error updating FAQ:", error);
      res.status(400).json({ message: "Invalid FAQ data" });
    }
  });

  app.delete('/api/admin/faqs/:id', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFaq(id);
      res.json({ message: "FAQ deleted successfully" });
    } catch (error) {
      console.error("Error deleting FAQ:", error);
      res.status(500).json({ message: "Failed to delete FAQ" });
    }
  });

  app.get('/api/admin/settings', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post('/api/admin/settings', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { key, value } = req.body;
      const setting = await storage.upsertSystemSetting({ key, value });
      res.json(setting);
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(400).json({ message: "Invalid setting data" });
    }
  });

  // Admin routes for user management (Privilege Admin and above)
  app.get("/api/admin/users", isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser;
      const scopedUsers = await storage.getScopedUsers(user);
      res.json(scopedUsers.map(sanitizeUser));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    const user = req.currentUser;
    const { email, firstName, lastName, role, ouId, locationId } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: "Email, first name, and last name are required" });
    }

    try {
      // Privilege Admin can create standard_admin or standard_user in their OU
      let finalOuId = ouId;
      let finalRole = role || "standard_admin";
      
      if (user.role !== 'superadmin') {
        finalOuId = user.ouId; // Force to their OU
        // Privilege Admin can only create standard_admin or standard_user
        if (!['standard_admin', 'standard_user'].includes(finalRole)) {
          finalRole = 'standard_admin';
        }
      }

      // Set mustChangePassword for Standard Admin and Privilege Admin users
      const mustChangePassword = finalRole !== 'superadmin';
      
      const newUser = await storage.createUser({
        email,
        firstName,
        lastName,
        role: finalRole,
        ouId: finalOuId || null,
        locationId: locationId || null,
        mustChangePassword: false,
      });

      // Send welcome email with OTP login instructions
      const fullName = `${firstName} ${lastName}`.trim();
      try {
        await sendWelcomeEmail(email, fullName);
        console.log(`[createUser] Welcome email sent to ${email}`);
      } catch (emailErr: any) {
        console.error(`[createUser] Welcome email failed for ${email}:`, emailErr?.message || emailErr);
      }

      res.json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.get("/api/admin/tickets", isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser;
      const scopedLocationIds = await getUserScopedLocationIds(user);
      const tickets = await storage.getScopedTickets(user, scopedLocationIds);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching all tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.post("/api/admin/tickets", isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    const { ticketNumber, licensePlate, parkingSector, parkingLocation, staffNotes, carPhoto } = req.body;

    if (!ticketNumber) {
      return res.status(400).json({ error: "Ticket number is required" });
    }

    try {
      const parkingLocationFormatted = parkingSector && parkingLocation ? 
        `${parkingSector}${parkingLocation}` : undefined;

      const newTicket = await storage.createValetTicket({
        ticketNumber,
        licensePlate,
        parkingLocation: parkingLocationFormatted,
        staffNotes,
        carPhoto,
      });

      // Broadcast to clients in the same OU
      broadcastToOU(newTicket.ouId, {
        type: 'ticket_created',
        data: newTicket
      });

      res.json(newTicket);
    } catch (error) {
      console.error("Error creating admin ticket:", error);
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  // Update ticket (admin)
  app.patch("/api/admin/tickets/:ticketNumber", isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const { status, guestName, licensePlate, carMake, carModel, carColor, parkingSector, parkingLocation, staffNotes } = req.body;

      const updatedTicket = await storage.updateValetTicketDetails(ticketNumber, {
        status,
        guestName,
        licensePlate,
        carMake,
        carModel,
        carColor,
        parkingSector,
        parkingLocation,
        staffNotes,
      });

      if (!updatedTicket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Broadcast update to clients in the same OU
      broadcastToOU(updatedTicket.ouId, {
        type: 'ticket_updated',
        data: updatedTicket,
      });

      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  // Delete ticket (admin)
  app.delete("/api/admin/tickets/:ticketNumber", isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;

      // Fetch before delete so we can scope the broadcast
      const ticketForBroadcast = await storage.getValetTicket(ticketNumber);
      const deleted = await storage.deleteValetTicket(ticketNumber);
      
      if (!deleted) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Broadcast deletion scoped to the ticket's OU
      broadcastToOU(ticketForBroadcast?.ouId ?? null, {
        type: 'ticket_deleted',
        data: { ticketNumber },
      });

      res.json({ success: true, message: "Ticket deleted successfully" });
    } catch (error) {
      console.error("Error deleting ticket:", error);
      res.status(500).json({ error: "Failed to delete ticket" });
    }
  });

  // Archive ticket (admin) - sets status to 'cancelled'
  app.patch("/api/admin/tickets/:ticketNumber/archive", isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      
      const archivedTicket = await storage.updateValetTicketStatus(ticketNumber, 'cancelled');
      
      if (!archivedTicket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Broadcast archive to clients in the same OU
      broadcastToOU(archivedTicket.ouId, {
        type: 'ticket_archived',
        data: archivedTicket,
      });

      res.json(archivedTicket);
    } catch (error) {
      console.error("Error archiving ticket:", error);
      res.status(500).json({ error: "Failed to archive ticket" });
    }
  });

  // Car Photo Management Routes
  app.post('/api/car-photos/upload', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getCarPhotoUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating car photo upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.get('/car-photos/:photoPath(*)', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const photoPath = `/${req.params.photoPath}`;
      const currentUser = req.currentUser;

      // Verify this photo belongs to a ticket in the caller's OU
      const owningTicket = await storage.getTicketByPhotoPath(photoPath);
      if (!owningTicket) {
        return res.status(404).json({ message: "Photo not found" });
      }
      if (currentUser.role !== 'superadmin' && owningTicket.ouId !== currentUser.ouId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const objectStorageService = new ObjectStorageService();
      const photoFile = await objectStorageService.getCarPhotoFile(photoPath);
      objectStorageService.downloadCarPhoto(photoFile, res);
    } catch (error) {
      console.error("Error serving car photo:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "Photo not found" });
      }
      return res.status(500).json({ message: "Error serving photo" });
    }
  });

  // Staff endpoint for editing ticket details (accessible by standard admin)
  app.patch('/api/staff/tickets/:ticketNumber/edit', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const { status, guestName, roomNumber, licensePlate, carMake, carModel, carColor, parkingLocation, parkingSector, staffNotes, createdAt } = req.body;

      const existing = await storage.getValetTicket(ticketNumber);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(existing, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Validate and parse optional createdAt override
      let parsedCreatedAt: Date | undefined;
      if (createdAt) {
        const d = new Date(createdAt);
        if (isNaN(d.getTime())) return res.status(400).json({ message: "Invalid createdAt date" });
        parsedCreatedAt = d;
      }

      const updatedTicket = await storage.updateValetTicketDetails(ticketNumber, {
        status,
        guestName,
        roomNumber,
        licensePlate,
        carMake,
        carModel,
        carColor,
        parkingLocation,
        parkingSector,
        staffNotes,
        ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
      } as any);

      // Broadcast update to WebSocket clients in the same OU
      broadcastToOU(updatedTicket?.ouId, {
        type: 'ticket_updated',
        data: updatedTicket,
      });

      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });

  // Toggle ticket in/out of Vehicle Roster
  app.patch('/api/staff/tickets/:ticketNumber/roster', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const { inRoster, rosterCategory } = req.body;
      const existing = await storage.getValetTicket(ticketNumber);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(existing, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updateData: any = { inRoster: !!inRoster };
      if (rosterCategory) updateData.rosterCategory = rosterCategory;
      const updated = await storage.updateValetTicket(ticketNumber, updateData);
      broadcastToOU(updated?.ouId, { type: 'ticket_updated', data: updated });
      res.json(updated);
    } catch (error) {
      console.error("Error updating roster flag:", error);
      res.status(500).json({ message: "Failed to update roster flag" });
    }
  });

  // Roster 備考 cell: update staffNotes and/or nightCheckDone
  app.patch('/api/staff/tickets/:ticketNumber/roster-notes', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const { staffNotes, nightCheckDone } = req.body;
      const existing = await storage.getValetTicket(ticketNumber);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(existing, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updateData: any = {};
      if (staffNotes !== undefined) updateData.staffNotes = staffNotes;
      if (nightCheckDone !== undefined) {
        // Store today's date string when marking done, null when unmarking
        const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
        updateData.nightCheckDone = nightCheckDone ? todayStr : null;
      }
      const updated = await storage.updateValetTicket(ticketNumber, updateData);
      broadcastToOU(updated?.ouId, { type: 'ticket_updated', data: updated });
      res.json(updated);
    } catch (error) {
      console.error("Error updating roster notes:", error);
      res.status(500).json({ message: "Failed to update roster notes" });
    }
  });

  // Enhanced Staff Routes for Car Management
  app.patch('/api/staff/tickets/:ticketNumber/car-details', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const { licensePlate, parkingLocation, parkingSector, staffNotes, carPhoto } = req.body;

      const existing = await storage.getValetTicket(ticketNumber);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(existing, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const objectStorageService = new ObjectStorageService();
      let normalizedPhotoPath = carPhoto;
      
      // Normalize car photo URL if it's an object storage URL
      if (carPhoto && carPhoto.startsWith("https://storage.googleapis.com/")) {
        normalizedPhotoPath = objectStorageService.normalizeCarPhotoPath(carPhoto);
      }

      const updatedTicket = await storage.updateValetTicketDetails(ticketNumber, {
        licensePlate,
        parkingLocation,
        parkingSector,
        staffNotes,
        carPhoto: normalizedPhotoPath,
        assignedStaff: (req as any).user?.claims?.sub,
      });

      // Broadcast update to WebSocket clients in the same OU
      broadcastToOU(updatedTicket?.ouId, {
        type: 'ticket_details_updated',
        data: updatedTicket,
      });

      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating car details:", error);
      if (error && typeof error === 'object' && 'message' in error && (error as any).message?.includes('Unauthorized')) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: "Failed to update car details" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  interface ClientInfo { ouId: string | null; role: string; }
  const clients = new Map<WebSocket, ClientInfo>();
  const sessionParser = getSession();

  wss.on('connection', (ws, request: any) => {
    // Validate session before accepting the WebSocket connection
    sessionParser(request, {} as any, async () => {
      const localUserId = request.session?.user?.claims?.sub;
      const passportUserId = request.session?.passport?.user?.claims?.sub;
      const userId = localUserId || passportUserId;

      if (!userId) {
        // Unauthenticated connection — allow as public (customer status-tracking)
        clients.set(ws, { ouId: null, role: 'public' });
        ws.on('close', () => clients.delete(ws));
        ws.on('error', () => clients.delete(ws));
        return;
      }

      const user = await storage.getUser(userId);
      if (!user) {
        clients.set(ws, { ouId: null, role: 'public' });
        ws.on('close', () => clients.delete(ws));
        ws.on('error', () => clients.delete(ws));
        return;
      }

      clients.set(ws, { ouId: user.ouId ?? null, role: user.role });
      console.log('Authenticated client connected to WebSocket');

      ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected from WebSocket');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
      });
    });
  });

  // ── Google Cloud Vision OCR endpoint ──────────────────────────────────────
  // Accepts a base64-encoded image (data URL or raw base64) and returns the
  // text detected by Google Cloud Vision TEXT_DETECTION.
  // The API key is kept server-side so it is never exposed to the browser.
  app.post('/api/ocr/plate', isAuthenticated, async (req: any, res) => {
    try {
      const apiKey = process.env.GOOGLE_VISION_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ message: 'Google Vision API key not configured' });
      }

      const { imageBase64 } = req.body as { imageBase64?: string };
      if (!imageBase64) {
        return res.status(400).json({ message: 'imageBase64 is required' });
      }

      // Strip data-URL prefix if present ("data:image/...;base64,")
      const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');

      const visionUrl =
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

      const body = {
        requests: [
          {
            image: { content: base64Data },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            imageContext: {
              languageHints: ['ja', 'en'],
            },
          },
        ],
      };

      const response = await fetch(visionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[Vision API] error:', errText);
        return res.status(502).json({ message: 'Vision API request failed', detail: errText });
      }

      const json = (await response.json()) as any;
      const annotation = json.responses?.[0]?.textAnnotations?.[0];
      const text: string = annotation?.description ?? '';

      return res.json({ text });
    } catch (err: any) {
      console.error('[Vision API] unexpected error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Backup export endpoint
  app.get('/api/backup/export', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser;
      const { range, includeTickets, includeUsers, includeLocations } = req.query;

      const now = new Date();
      let startDate: Date | null = null;
      switch (range) {
        case '1d':  startDate = new Date(now.getTime() - 1   * 24 * 60 * 60 * 1000); break;
        case '7d':  startDate = new Date(now.getTime() - 7   * 24 * 60 * 60 * 1000); break;
        case '30d': startDate = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000); break;
        case '3m':  startDate = new Date(now.getTime() - 90  * 24 * 60 * 60 * 1000); break;
        case '6m':  startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); break;
        case '1y':  startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
        default:    startDate = null;
      }

      const scopedLocationIds = await getUserScopedLocationIds(user);
      const result: Record<string, any> = {};

      if (includeTickets !== 'false') {
        const tickets = await storage.getScopedTickets(user, scopedLocationIds);
        result.tickets = startDate
          ? tickets.filter(t => t.createdAt && new Date(t.createdAt) >= startDate!)
          : tickets;
      }

      if (includeUsers === 'true') {
        const users = await storage.getScopedUsers(user);
        result.users = users.map(({ password, ...u }) => u);
      }

      if (includeLocations === 'true') {
        const locations = await storage.getScopedLocations(user);
        result.locations = locations;
      }

      res.json(result);
    } catch (error) {
      console.error("Error generating backup:", error);
      res.status(500).json({ message: "Failed to generate backup" });
    }
  });

  // Proxy endpoint: fetches a car/plate photo from object storage and streams it to the client.
  // Handles both full GCS signed URLs and normalized /car-photos/ paths stored in the DB.
  app.get('/api/backup/photo', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const raw = req.query.path as string;
      if (!raw) return res.status(400).json({ message: 'path required' });

      const objectStorageService = new ObjectStorageService();
      let normalizedPath = raw;

      // Full signed GCS URL → normalize to internal path
      if (raw.startsWith('https://storage.googleapis.com/')) {
        normalizedPath = objectStorageService.normalizeCarPhotoPath(raw);
      }

      // Strip any leftover query string (signed URL params)
      if (normalizedPath.includes('?')) {
        normalizedPath = normalizedPath.split('?')[0];
      }

      if (!normalizedPath.startsWith('/car-photos/')) {
        return res.status(404).json({ message: 'Not found' });
      }

      // Verify this photo belongs to a ticket in the caller's OU
      const currentUser = req.currentUser;
      const owningTicket = await storage.getTicketByPhotoPath(normalizedPath);
      if (!owningTicket) {
        return res.status(404).json({ message: 'Photo not found' });
      }
      if (currentUser.role !== 'superadmin' && owningTicket.ouId !== currentUser.ouId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const photoFile = await objectStorageService.getCarPhotoFile(normalizedPath);
      await objectStorageService.downloadCarPhoto(photoFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: 'Photo not found' });
      }
      console.error('Error proxying backup photo:', error);
      res.status(500).json({ message: 'Error serving photo' });
    }
  });

  // Immediately close a ticket as departed (guest left without retrieval process)
  app.post('/api/staff/tickets/:ticketNumber/depart', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const existing = await storage.getValetTicket(ticketNumber);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(existing, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      let ticket = await storage.updateValetTicketStatus(ticketNumber, 'completed');
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      const depCategory = (existing.visitorType === 'restaurant' || existing.visitorType === 'event' || existing.visitorType === 'others') ? 'events' : 'departing';
      ticket = await storage.updateValetTicket(ticketNumber, { rosterCategory: depCategory, inRoster: true, scheduledDepartureAt: null }) ?? ticket;
      broadcastToOU(ticket!.ouId, { type: 'ticket_status_updated', data: ticket });
      res.json(ticket);
    } catch (error) {
      console.error("Error departing ticket:", error);
      res.status(500).json({ message: "Failed to depart ticket" });
    }
  });

  // Schedule auto-close departure for a future time
  app.post('/api/staff/tickets/:ticketNumber/schedule-departure', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const { scheduledDepartureAt } = req.body;
      if (!scheduledDepartureAt) return res.status(400).json({ message: "scheduledDepartureAt is required" });
      const scheduledTime = new Date(scheduledDepartureAt);
      if (isNaN(scheduledTime.getTime())) return res.status(400).json({ message: "Invalid date" });
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 10);
      if (scheduledTime > maxDate) return res.status(400).json({ message: "Cannot schedule more than 10 days in advance" });
      const existing = await storage.getValetTicket(ticketNumber);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(existing, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const ticket = await storage.updateValetTicket(ticketNumber, { scheduledDepartureAt: scheduledTime });
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      broadcastToOU(ticket.ouId, { type: 'ticket_status_updated', data: ticket });
      res.json(ticket);
    } catch (error) {
      console.error("Error scheduling departure:", error);
      res.status(500).json({ message: "Failed to schedule departure" });
    }
  });

  // Cancel a scheduled departure
  app.delete('/api/staff/tickets/:ticketNumber/schedule-departure', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const existing = await storage.getValetTicket(ticketNumber);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(existing, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const ticket = await storage.updateValetTicket(ticketNumber, { scheduledDepartureAt: null });
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      broadcastToOU(ticket.ouId, { type: 'ticket_status_updated', data: ticket });
      res.json(ticket);
    } catch (error) {
      console.error("Error cancelling scheduled departure:", error);
      res.status(500).json({ message: "Failed to cancel scheduled departure" });
    }
  });

  // ── SOFTWARE LICENSE ROUTES ──────────────────────────────────────────────────
  function generateLicenseKey(version: string): string {
    const prefix = version === 'enterprise' ? 'ENT' : 'PRO';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `APL-${prefix}-${rand(4)}-${rand(4)}-${rand(4)}`;
  }

  // GET /api/licenses/my — own OU's license (all authenticated users)
  app.get('/api/licenses/my', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.user?.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: 'Unauthorized' });
      if (!user.ouId) return res.json(null);
      const license = await storage.getLicenseByOU(user.ouId);
      res.json(license ?? null);
    } catch (e) {
      res.status(500).json({ message: 'Failed to fetch license' });
    }
  });

  // GET /api/admin/licenses — all licenses (Super Admin)
  app.get('/api/admin/licenses', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const licenses = await storage.getAllLicenses();
      res.json(licenses);
    } catch (e) {
      res.status(500).json({ message: 'Failed to fetch licenses' });
    }
  });

  // POST /api/admin/licenses — issue new license (Super Admin)
  app.post('/api/admin/licenses', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { ouId, orgName, address, contactNumber, version, notes, validTo } = req.body;
      if (!ouId || !orgName || !address || !contactNumber || !version) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      const existing = await storage.getLicenseByOU(ouId);
      if (existing) return res.status(409).json({ message: 'License already exists for this OU' });
      const licenseKey = generateLicenseKey(version);
      const license = await storage.createLicense({
        ouId, orgName, address, contactNumber, version, notes: notes || null,
        validTo: validTo ? new Date(validTo) : null,
        licenseKey, spdxLicense: 'Apache-2.0', issuedBy: req.currentUser.id, isActive: true,
      });
      res.json(license);
    } catch (e) {
      res.status(500).json({ message: 'Failed to issue license' });
    }
  });

  // PATCH /api/admin/licenses/:id — modify license (Super Admin)
  app.patch('/api/admin/licenses/:id', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { orgName, address, contactNumber, version, notes, isActive, validTo } = req.body;
      const updated = await storage.updateLicense(req.params.id, { orgName, address, contactNumber, version, notes, isActive, validTo: validTo ? new Date(validTo) : null });
      if (!updated) return res.status(404).json({ message: 'License not found' });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ message: 'Failed to update license' });
    }
  });

  // PATCH /api/licenses/branding — Privilege Admin updates their OU branding
  app.patch('/api/licenses/branding', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const { logoUrl, primaryColor, accentColor } = req.body;
      const ouId = req.currentUser.role === 'superadmin' ? req.body.ouId : req.currentUser.ouId;
      if (!ouId) return res.status(400).json({ message: 'No OU assigned' });
      const license = await storage.getLicenseByOU(ouId);
      if (!license) return res.status(403).json({ message: 'No active license for this OU' });
      const ou = await storage.updateOUBranding(ouId, { logoUrl, primaryColor, accentColor });
      res.json(ou);
    } catch (e) {
      res.status(500).json({ message: 'Failed to update branding' });
    }
  });

  // Auto-close tickets whose scheduledDepartureAt has passed — runs every minute
  setInterval(async () => {
    try {
      const due = await storage.getDueScheduledDepartures();
      for (const ticket of due) {
        const now = new Date();

        // Simulate full SLA retrieval process: random 5–8 min total
        const totalSLASec = Math.floor(Math.random() * (480 - 300 + 1)) + 300; // 300–480 s
        // Split into 3 stages (retrieving, transit, preparing) with random proportions
        const r1 = Math.random(), r2 = Math.random(), r3 = Math.random();
        const sum = r1 + r2 + r3;
        const retrievingSec = Math.round((r1 / sum) * totalSLASec);
        const transitSec    = Math.round((r2 / sum) * totalSLASec);
        const preparingSec  = totalSLASec - retrievingSec - transitSec;

        const retrievalStartedAt = new Date(now.getTime() - totalSLASec * 1000);
        const transitAt          = new Date(retrievalStartedAt.getTime() + retrievingSec * 1000);
        const preparingAt        = new Date(transitAt.getTime() + transitSec * 1000);
        const retrievalReadyAt   = new Date(preparingAt.getTime() + preparingSec * 1000);

        // Mark completed (sets status, departedAt, totalStaySeconds)
        let updated = await storage.updateValetTicketStatus(ticket.ticketNumber, 'completed');
        if (!updated) continue;

        // Overlay simulated SLA fields
        const depCategory = (ticket.visitorType === 'restaurant' || ticket.visitorType === 'event' || ticket.visitorType === 'others') ? 'events' : 'departing';
        updated = await storage.updateValetTicket(ticket.ticketNumber, {
          rosterCategory: depCategory,
          inRoster: true,
          scheduledDepartureAt: null,
          retrievalStartedAt,
          retrievalReadyAt,
          retrievalDurationSeconds: totalSLASec,
        }) ?? updated;

        broadcastToOU(updated.ouId, { type: 'ticket_status_updated', data: updated });
        console.log(`[Auto-Close] Ticket ${ticket.ticketNumber} departed — simulated SLA ${Math.round(totalSLASec/60)}m (retrieving ${retrievingSec}s / transit ${transitSec}s / preparing ${preparingSec}s)`);
      }
    } catch (e) {
      console.error('[Auto-Close] Error processing scheduled departures:', e);
    }
  }, 60 * 1000);

  // ── 15-minute pre-alert for scheduled retrievals ─────────────────────────────
  // Tracks which tickets have already fired their 15-min alert this session
  const scheduleAlertedSet = new Set<string>();

  setInterval(async () => {
    try {
      const upcoming = await storage.getUpcomingScheduledRetrievals(15);
      for (const ticket of upcoming) {
        if (scheduleAlertedSet.has(ticket.ticketNumber)) continue;
        scheduleAlertedSet.add(ticket.ticketNumber);
        broadcastToOU(ticket.ouId, {
          type: 'schedule_alert',
          data: {
            ticketNumber: ticket.ticketNumber,
            guestName: ticket.guestName,
            scheduledRetrievalAt: ticket.scheduledRetrievalAt,
            ouId: ticket.ouId,
          },
        });
        console.log(`[Schedule Alert] Fired 15-min pre-alert for ticket ${ticket.ticketNumber}`);
      }
      // Clean up entries for tickets no longer in 'active' or past their scheduled time
      // to allow re-alerting if a schedule is updated
    } catch (e) {
      console.error('[Schedule Alert] Error checking upcoming retrievals:', e);
    }
  }, 30 * 1000);

  // Broadcast to clients in the same OU (super admins receive all broadcasts)
  // Public (unauthenticated / customer) connections receive ticket_status_updated
  // so the customer status-tracking page updates in real time.
  function broadcastToOU(ouId: string | null | undefined, message: any) {
    const messageStr = JSON.stringify(message);
    clients.forEach((info, client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      if (info.role === 'superadmin') {
        client.send(messageStr);
      } else if (info.role === 'public' && message.type === 'ticket_status_updated') {
        client.send(messageStr);
      } else if (ouId && info.ouId === ouId) {
        client.send(messageStr);
      }
    });
  }

  // ── Guest Name Import endpoints ──────────────────────────────────────────
  // POST /api/name-imports  (privilege_admin only — bulk insert names)
  app.post('/api/name-imports', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned to your account' });
      const { names, visitorType } = req.body;
      if (!visitorType || typeof visitorType !== 'string') return res.status(400).json({ message: 'visitorType is required' });
      if (!Array.isArray(names) || names.length === 0) return res.status(400).json({ message: 'names array is required' });
      const valid = (names as string[]).filter(n => typeof n === 'string' && n.trim().length > 0).map(n => n.trim());
      if (valid.length === 0) return res.status(400).json({ message: 'No valid names provided' });
      await storage.bulkImportGuestNames(valid.map(name => ({ name, visitorType })), user.ouId);
      res.json({ imported: valid.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Session Audit Routes (privilege_admin only) ──────────────────────────────

  // Middleware: track every authenticated request (fire-and-forget)
  app.use('/api', isAuthenticated, (req: any, _res: any, next: any) => {
    trackSession(req).catch(() => {});
    next();
  });

  // GET /api/audit/sessions — active sessions (last 30 min), scoped to caller's OU
  app.get('/api/audit/sessions', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user: any = req.currentUser;
      const ouId = user.role === 'superadmin' ? undefined : user.ouId;
      const sessions = await storage.getActiveSessionAudits(ouId);
      res.json(sessions);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/audit/sessions/archive?date=YYYY-MM-DD — historical sessions for a date
  app.get('/api/audit/sessions/archive', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user: any = req.currentUser;
      const ouId = user.role === 'superadmin' ? undefined : user.ouId;
      const date = (req.query.date as string) || '';
      if (!date) return res.json([]);
      const sessions = await storage.getArchivedSessionAudits(date, ouId);
      res.json(sessions);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/audit/dates — distinct snapshot dates (for archive picker)
  app.get('/api/audit/dates', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user: any = req.currentUser;
      const ouId = user.role === 'superadmin' ? undefined : user.ouId;
      const dates = await storage.getAuditArchiveDates(ouId);
      res.json(dates);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/name-imports/list  (privilege_admin — view all active imported names)
  app.get('/api/name-imports/list', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.json([]);
      const names = await storage.listGuestNameImports(user.ouId);
      res.json(names);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/name-imports/:id  (privilege_admin — delete a single imported name)
  app.delete('/api/name-imports/:id', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned' });
      await storage.deleteGuestNameImport(req.params.id, user.ouId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/name-imports/type/:visitorType  (privilege_admin — clear all names for a visitor type)
  app.delete('/api/name-imports/type/:visitorType', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned' });
      await storage.clearGuestNameImports(req.params.visitorType, user.ouId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/name-imports  (any authenticated staff — for autocomplete suggestions)
  app.get('/api/name-imports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.user?.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user || !user.ouId) return res.json([]);
      const prefix = (req.query.prefix as string) || '';
      const visitorType = (req.query.visitorType as string) || '';
      if (prefix.length < 1 || !visitorType) return res.json([]);
      const suggestions = await storage.getGuestNameSuggestions(prefix, visitorType, user.ouId);
      res.json(suggestions);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── GS Hub routes ────────────────────────────────────────────────────────────

  // GET /api/gs/members/me — check if current user is a GS member
  app.get('/api/gs/members/me', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.json({ isMember: false });
      const isMember = await storage.isGSMember(user.ouId, user.id);
      res.json({ isMember });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/gs/members — list GS members for the OU (privilege_admin+)
  app.get('/api/gs/members', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.json([]);
      const members = await storage.getGSMembers(user.ouId);
      res.json(members);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/gs/members/:userId — add GS member (privilege_admin only)
  app.post('/api/gs/members/:userId', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned' });
      const { userId } = req.params;
      const target = await storage.getUser(userId);
      if (!target || target.ouId !== user.ouId) return res.status(403).json({ message: 'User not in your OU' });
      const member = await storage.addGSMember(user.ouId, userId, user.id);
      broadcastToOU(user.ouId, { type: 'gs_member_added', data: member });
      res.json(member);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/gs/members/:userId — remove GS member (privilege_admin only)
  app.delete('/api/gs/members/:userId', isAuthenticated, requirePrivilegeAdmin, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned' });
      await storage.removeGSMember(user.ouId, req.params.userId);
      broadcastToOU(user.ouId, { type: 'gs_member_removed', data: { userId: req.params.userId } });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/gs/messages — all GS messages for the OU
  app.get('/api/gs/messages', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId && user.role !== 'superadmin') return res.json([]);
      const ouId = user.ouId!;
      const msgs = await storage.getGSMessages(ouId);
      res.json(msgs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/gs/messages — any authenticated staff can send
  app.post('/api/gs/messages', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned' });
      const { content } = req.body;
      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ message: 'content is required' });
      }
      const senderName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Staff';
      const msg = await storage.createGSMessage({ ouId: user.ouId, senderId: user.id, senderName, content: content.trim() });
      broadcastToOU(user.ouId, { type: 'gs_message', data: msg });
      res.json(msg);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/gs/messages/:id/reply — GS member replies
  app.post('/api/gs/messages/:id/reply', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned' });
      const isMember = await storage.isGSMember(user.ouId, user.id);
      if (!isMember && user.role !== 'privilege_admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Only GS members can reply' });
      }
      const { content } = req.body;
      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ message: 'content is required' });
      }
      const senderName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'GS';
      const reply = await storage.addGSReply(req.params.id, { senderId: user.id, senderName, content: content.trim() });
      broadcastToOU(user.ouId, { type: 'gs_reply', data: { messageId: req.params.id, reply } });
      res.json(reply);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/gs/messages/:id/convert-to-event — GS member converts message to calendar event
  app.post('/api/gs/messages/:id/convert-to-event', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned' });
      const isMember = await storage.isGSMember(user.ouId, user.id);
      if (!isMember && user.role !== 'privilege_admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Only GS members can add to calendar' });
      }
      const { title, eventDate, startTime, endTime, category, details } = req.body;
      if (!title || !eventDate) return res.status(400).json({ message: 'title and eventDate are required' });
      const createdByName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'GS';
      const event = await storage.createCalendarEvent({
        ouId: user.ouId, title, eventDate, startTime, endTime, category, details,
        createdBy: user.id, createdByName, sourceMessageId: req.params.id,
      });
      await storage.markGSMessageScheduled(req.params.id, event.id);
      broadcastToOU(user.ouId, { type: 'gs_event_created', data: { event, messageId: req.params.id } });
      res.json(event);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/gs/messages/:id/acknowledge — original sender confirms they saw the calendar entry
  app.post('/api/gs/messages/:id/acknowledge', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      const msg = await storage.acknowledgeGSMessage(req.params.id);
      if (msg && user.ouId) broadcastToOU(user.ouId, { type: 'gs_acknowledged', data: msg });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/gs/messages/:id — privilege_admin or superadmin edits a message
  app.patch('/api/gs/messages/:id', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (user.role !== 'privilege_admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      const { content } = req.body;
      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ message: 'Content is required' });
      }
      const msg = await storage.updateGSMessage(req.params.id, content.trim());
      if (!msg) return res.status(404).json({ message: 'Message not found' });
      if (user.ouId) broadcastToOU(user.ouId, { type: 'gs_message_updated', data: msg });
      res.json(msg);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/gs/messages/:id — privilege_admin or superadmin deletes a message
  app.delete('/api/gs/messages/:id', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (user.role !== 'privilege_admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      await storage.deleteGSMessage(req.params.id);
      if (user.ouId) broadcastToOU(user.ouId, { type: 'gs_message_deleted', data: { id: req.params.id } });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Calendar routes ───────────────────────────────────────────────────────────

  // GET /api/calendar/events — all calendar events for the OU
  app.get('/api/calendar/events', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId && user.role !== 'superadmin') return res.json([]);
      const events = await storage.getCalendarEvents(user.ouId!);
      res.json(events);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/calendar/events — GS member creates event directly
  app.post('/api/calendar/events', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned' });
      const isMember = await storage.isGSMember(user.ouId, user.id);
      if (!isMember && user.role !== 'privilege_admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Only GS members can create events' });
      }
      const { title, eventDate, startTime, endTime, category, details } = req.body;
      if (!title || !eventDate) return res.status(400).json({ message: 'title and eventDate are required' });
      const createdByName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'GS';
      const event = await storage.createCalendarEvent({
        ouId: user.ouId, title, eventDate, startTime, endTime, category, details,
        createdBy: user.id, createdByName,
      });
      broadcastToOU(user.ouId, { type: 'gs_event_created', data: { event } });
      res.json(event);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // PATCH /api/calendar/events/:id — GS member updates event
  app.patch('/api/calendar/events/:id', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned' });
      const isMember = await storage.isGSMember(user.ouId, user.id);
      if (!isMember && user.role !== 'privilege_admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Only GS members can edit events' });
      }
      const { title, eventDate, startTime, endTime, category, details } = req.body;
      const event = await storage.updateCalendarEvent(req.params.id, { title, eventDate, startTime, endTime, category, details });
      if (event) broadcastToOU(user.ouId, { type: 'gs_event_updated', data: event });
      res.json(event);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // DELETE /api/calendar/events/:id — GS member deletes event
  app.delete('/api/calendar/events/:id', isAuthenticated, requireReadAccess, async (req: any, res) => {
    try {
      const user = req.currentUser as User;
      if (!user.ouId) return res.status(400).json({ message: 'No OU assigned' });
      const isMember = await storage.isGSMember(user.ouId, user.id);
      if (!isMember && user.role !== 'privilege_admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Only GS members can delete events' });
      }
      await storage.deleteCalendarEvent(req.params.id);
      broadcastToOU(user.ouId, { type: 'gs_event_deleted', data: { id: req.params.id } });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  return httpServer;
}
