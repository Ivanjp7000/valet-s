import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getSession } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertValetTicketSchema, updateValetTicketStatusSchema, insertFaqSchema, insertOUSchema, insertPhysicalLocationSchema, insertUserSchema, type User } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";

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

      // Create a session for the user
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
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Public routes (Customer facing)
  app.get('/api/tickets/:ticketNumber', async (req, res) => {
    try {
      const { ticketNumber } = req.params;
      const ticket = await storage.getValetTicket(ticketNumber);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json({
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        guestName: ticket.guestName,
        visitorType: ticket.visitorType,
        visitorSubType: ticket.visitorSubType,
        roomNumber: ticket.roomNumber,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      });
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  // Public: customer requests car retrieval — queues it and alerts all staff in the OU
  app.post('/api/tickets/:ticketNumber/request-retrieval', async (req, res) => {
    try {
      const { ticketNumber } = req.params;
      const ticket = await storage.getValetTicket(ticketNumber);

      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.status !== 'active') {
        return res.status(400).json({ message: "Ticket is not in active status" });
      }

      const updated = await storage.updateValetTicketStatus(ticketNumber, 'retrieval_requested');

      broadcastToAll({
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

  // Staff: accept a retrieval request — moves ticket to 'retrieving' and starts the timer
  app.post('/api/tickets/:ticketNumber/accept-retrieval', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const ticket = await storage.getValetTicket(ticketNumber);

      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.status !== 'retrieval_requested') {
        return res.status(400).json({ message: "Ticket is not awaiting retrieval" });
      }

      const updated = await storage.updateValetTicketStatus(ticketNumber, 'retrieving');

      broadcastToAll({
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
        ticketNumber, visitorType, visitorSubType, guestName,
        carMake, carModel, carColor, licensePlate, platePhotoUrl,
        locationId, parkingSector, parkingLocation, 
        createdByUserId, createdByName
      } = req.body;

      // Validate required fields
      if (!ticketNumber || !/^\d{5}$/.test(ticketNumber)) {
        return res.status(400).json({ message: "Invalid ticket number. Must be 5 digits." });
      }
      if (!visitorType || !guestName || !carMake || !carModel || !carColor) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if ticket already exists
      const existingTicket = await storage.getValetTicket(ticketNumber);
      if (existingTicket) {
        return res.status(400).json({ message: "Ticket number already exists" });
      }

      // Derive ouId from location or from current user
      let ouId: string | null = null;
      if (locationId) {
        const location = await storage.getLocation(locationId);
        if (location) {
          ouId = location.ouId;
        }
      }
      // Fallback to user's OU if no location or location has no OU
      if (!ouId && currentUser.ouId) {
        ouId = currentUser.ouId;
      }
      
      // Ensure ouId is set for proper scoping
      if (!ouId) {
        return res.status(400).json({ message: "Cannot determine organization. Please select a location or ensure your account is assigned to an organization." });
      }

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
        locationId: locationId || null,
        ouId: ouId,
        parkingSector: parkingSector || null,
        parkingLocation: parkingLocation || null,
        createdByUserId: createdByUserId || null,
        createdByName: createdByName || null,
        status: 'active',
      });

      // Broadcast to all connected WebSocket clients
      broadcastToAll({
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
      
      const ticket = await storage.updateValetTicketStatus(ticketNumber, status);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Broadcast status update to all connected clients
      broadcastToAll({
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
      
      const ticket = await storage.markGuestReturned(ticketNumber);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found or guest had not departed" });
      }

      // Broadcast status update to all connected clients
      broadcastToAll({
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
      
      const stats = {
        pending: allTickets.filter(t => t.status === 'active' || t.status === 'retrieving').length,
        transit: allTickets.filter(t => t.status === 'transit').length,
        ready: allTickets.filter(t => t.status === 'ready').length,
        completed: allTickets.filter(t => 
          t.status === 'completed' && 
          t.updatedAt && new Date(t.updatedAt) >= today
        ).length,
        avgTime: '4.2m'
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
        res.json(users);
      } else {
        // Privilege Admin sees standard admins and standard users in their OU
        const users = await storage.getUsersByOU(user.ouId!);
        const filteredUsers = users.filter(u => ['standard_admin', 'standard_user'].includes(u.role));
        res.json(filteredUsers);
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
      
      // If password is being updated, hash it
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      
      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) return res.status(404).json({ message: "User not found" });
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
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
            ...user,
            locationScopes: await storage.getUserLocationScopes(user.id)
          }))
        );
        res.json(usersWithScopes);
      } else if (currentUser.ouId) {
        // Privilege Admin: Get standard admins and standard users in their OU with scopes
        const result = await storage.getUsersWithLocationScopes(currentUser.ouId);
        const filteredResult = result
          .filter(r => ['standard_admin', 'standard_user'].includes(r.user.role))
          .map(r => ({ ...r.user, locationScopes: r.scopes }));
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
      res.json(scopedUsers);
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

      // Broadcast to all connected WebSocket clients
      broadcastToAll({
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

      // Broadcast update
      broadcastToAll({
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
      
      const deleted = await storage.deleteValetTicket(ticketNumber);
      
      if (!deleted) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Broadcast deletion
      broadcastToAll({
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

      // Broadcast archive
      broadcastToAll({
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

  app.get('/car-photos/:photoPath(*)', async (req, res) => {
    try {
      const photoPath = `/${req.params.photoPath}`;
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

      // Broadcast update to WebSocket clients
      broadcastToAll({
        type: 'ticket_updated',
        data: updatedTicket,
      });

      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });

  // Enhanced Staff Routes for Car Management
  app.patch('/api/staff/tickets/:ticketNumber/car-details', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
    try {
      const { ticketNumber } = req.params;
      const { licensePlate, parkingLocation, parkingSector, staffNotes, carPhoto } = req.body;
      
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

      // Broadcast update to WebSocket clients
      broadcastToAll({
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
  const clients = new Set<WebSocket>();
  const sessionParser = getSession();

  wss.on('connection', (ws, request: any) => {
    // Validate session before accepting the WebSocket connection
    sessionParser(request, {} as any, () => {
      const localUserId = request.session?.user?.claims?.sub;
      const passportUserId = request.session?.passport?.user?.claims?.sub;

      if (!localUserId && !passportUserId) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      clients.add(ws);
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

  // Function to broadcast to all connected clients
  function broadcastToAll(message: any) {
    const messageStr = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  return httpServer;
}
