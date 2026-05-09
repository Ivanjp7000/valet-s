import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getSession } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertValetTicketSchema, updateValetTicketStatusSchema, insertFaqSchema, insertOUSchema, insertPhysicalLocationSchema, insertUserSchema, type User } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import { Resend } from "resend";

// In-memory OTP store: userId → { code, expiresAt }
const otpStore = new Map<string, { code: string; expiresAt: number }>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Resend integration — credential proxy (never cached; tokens expire)
async function getResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;
  if (!xReplitToken) throw new Error('X-Replit-Token not found for repl/depl');
  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    { headers: { 'Accept': 'application/json', 'X-Replit-Token': xReplitToken } }
  ).then(r => r.json()).then((d: any) => d.items?.[0]);
  if (!connectionSettings?.settings?.api_key) throw new Error('Resend not connected');
  return {
    client: new Resend(connectionSettings.settings.api_key),
    fromEmail: connectionSettings.settings.from_email || 'noreply@resend.dev',
  };
}

async function sendOtpEmail(toEmail: string, code: string): Promise<void> {
  const { client, fromEmail } = await getResendClient();
  await client.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: "Your Valet System Login Code",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1e3a5f;margin-bottom:8px">Valet Management System</h2>
        <p style="color:#374151;margin-bottom:24px">Your one-time login code is:</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;letter-spacing:12px;font-size:32px;font-weight:700;color:#1e3a5f">${code}</div>
        <p style="color:#6b7280;font-size:13px;margin-top:24px">This code expires in 5 minutes. Do not share it with anyone.</p>
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
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username);
      
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // If 2FA is enabled, send OTP and pause — don't create session yet
      if (user.twoFactorEnabled && user.email) {
        const code = generateOtp();
        otpStore.set(user.id, { code, expiresAt: Date.now() + 5 * 60 * 1000 });
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

      // Require name as a second factor on every read — eliminates validity oracle
      if (!nameParam) {
        return res.status(400).json({ message: "Name is required" });
      }

      // Rate limit per-ticket (not per-IP) so rotating source addresses cannot bypass it
      const socketIp = req.socket?.remoteAddress || 'unknown';
      if (!checkRateLimit(`ticket-lookup:${ticketNumber}`, 15, 15 * 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please wait before trying again." });
      }
      // Secondary IP-based limit using the direct socket address (not x-forwarded-for)
      if (!checkRateLimit(`ticket-lookup-ip:${socketIp}`, 60, 60 * 1000)) {
        return res.status(429).json({ message: "Too many requests. Please wait before trying again." });
      }

      const ticket = await storage.getValetTicket(ticketNumber);

      // Return the same 404 whether the ticket doesn't exist or the name doesn't match
      // — prevents enumeration oracle
      if (!ticket || !namesMatch(nameParam, ticket.guestName)) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json({
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        visitorType: ticket.visitorType,
        visitorSubType: ticket.visitorSubType,
        createdAt: ticket.createdAt,
        stageStartedAt: ticket.stageStartedAt,
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
      const { guestName } = req.body;

      if (!guestName || typeof guestName !== 'string' || !guestName.trim()) {
        return res.status(400).json({ message: "Name verification is required" });
      }

      const ticket = await storage.getValetTicket(ticketNumber);

      // Return the same 404 for both not-found and name-mismatch — eliminates oracle
      if (!ticket || !namesMatch(guestName, ticket.guestName)) {
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
      const { scheduledAt, guestName } = req.body;

      if (!guestName || typeof guestName !== 'string' || !guestName.trim()) {
        return res.status(400).json({ message: "Name verification is required" });
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
      // Return the same 404 for both not-found and name-mismatch — eliminates oracle
      if (!ticket || !namesMatch(guestName, ticket.guestName)) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      if (!['active', 'pending'].includes(ticket.status)) {
        return res.status(400).json({ message: "Ticket is not available for scheduling" });
      }

      await storage.updateValetTicket(ticketNumber, {
        scheduledRetrievalAt: scheduledDate,
      });

      res.json({ success: true });
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

      broadcastToOU(updated!.ouId, {
        type: 'retrieval_accepted',
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

      const ticket = await storage.createValetTicket({
        ticketNumber,
        visitorType,
        visitorSubType: visitorSubType || null,
        guestName,
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
        mustChangePassword,
      });
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
      const { status, guestName, roomNumber, licensePlate, carMake, carModel, carColor, parkingLocation, parkingSector, staffNotes } = req.body;

      const existing = await storage.getValetTicket(ticketNumber);
      if (!existing) return res.status(404).json({ message: "Ticket not found" });
      if (!await isTicketInScope(existing, req.currentUser)) {
        return res.status(403).json({ message: "Access denied" });
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
      });

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
        ws.close(1008, 'Unauthorized');
        return;
      }

      const user = await storage.getUser(userId);
      if (!user) {
        ws.close(1008, 'Unauthorized');
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

  // Broadcast to clients in the same OU (super admins receive all broadcasts)
  function broadcastToOU(ouId: string | null | undefined, message: any) {
    const messageStr = JSON.stringify(message);
    clients.forEach((info, client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      if (info.role === 'superadmin') {
        client.send(messageStr);
      } else if (ouId && info.ouId === ouId) {
        client.send(messageStr);
      }
    });
  }

  return httpServer;
}
