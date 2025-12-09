import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertValetTicketSchema, updateValetTicketStatusSchema, insertFaqSchema, insertOUSchema, insertPhysicalLocationSchema, insertUserSchema } from "@shared/schema";
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
  app.post('/api/tickets', async (req, res) => {
    try {
      const { ticketNumber } = insertValetTicketSchema.parse(req.body);
      
      // Check if ticket already exists
      const existingTicket = await storage.getValetTicket(ticketNumber);
      if (existingTicket) {
        return res.status(400).json({ message: "Ticket already exists" });
      }

      const ticket = await storage.createValetTicket({ ticketNumber });
      
      // Broadcast to all connected WebSocket clients
      broadcastToAll({
        type: 'ticket_created',
        data: ticket
      });

      res.json(ticket);
    } catch (error) {
      console.error("Error creating ticket:", error);
      res.status(400).json({ message: "Invalid ticket data" });
    }
  });

  app.get('/api/tickets/:ticketNumber', async (req, res) => {
    try {
      const { ticketNumber } = req.params;
      const ticket = await storage.getValetTicket(ticketNumber);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ message: "Failed to fetch ticket" });
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

  // Helper to get user's scoped location IDs (for Standard Admins with location restrictions)
  const getUserScopedLocationIds = async (user: any): Promise<string[] | undefined> => {
    if (user.role !== 'standard_admin') return undefined;
    const scopes = await storage.getUserLocationScopes(user.id);
    if (scopes.length === 0) return undefined; // No restrictions, see full OU
    return scopes.map(s => s.locationId);
  };

  // Protected routes (Staff/Admin only) - requires standard_admin or higher
  app.get('/api/staff/tickets', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
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

  app.get('/api/staff/stats', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
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
  app.get('/api/ous', isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const ous = await storage.getAllOUs();
      res.json(ous);
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
  app.get('/api/locations', isAuthenticated, requireStandardAdmin, async (req: any, res) => {
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
        // Privilege Admin sees only standard admins in their OU
        const users = await storage.getUsersByOU(user.ouId!);
        const filteredUsers = users.filter(u => u.role === 'standard_admin');
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
        // Privilege Admin can only create standard_admin users
        if (role && role !== 'standard_admin') {
          return res.status(403).json({ message: "You can only create standard admin accounts" });
        }
        // Must assign to their OU
        if (ouId && ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "You can only create users in your OU" });
        }
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        role: role || 'standard_admin',
        ouId: ouId || currentUser.ouId,
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
      
      // Privilege Admin can only modify standard_admin in their OU
      if (currentUser.role === 'privilege_admin') {
        if (targetUser.role !== 'standard_admin' || targetUser.ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "You can only modify standard admins in your OU" });
        }
      }
      
      const { password, role, ouId, locationId, ...safeUpdateData } = req.body;
      
      // Privilege Admin cannot change role or OU assignment
      if (currentUser.role === 'privilege_admin') {
        if (role && role !== 'standard_admin') {
          return res.status(403).json({ message: "You cannot change user roles" });
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
      
      // Privilege Admin can only delete standard_admin in their OU
      if (currentUser.role === 'privilege_admin') {
        if (targetUser.role !== 'standard_admin' || targetUser.ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "You can only delete standard admins in your OU" });
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
      
      // Privilege Admin can only view scopes for standard_admin in their OU
      if (currentUser.role === 'privilege_admin') {
        if (targetUser.role !== 'standard_admin' || targetUser.ouId !== currentUser.ouId) {
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

  // Add location scope to a user (Privilege Admin assigns Standard Admin to specific locations)
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
      
      // Privilege Admin can only assign scopes to standard_admin in their OU
      if (currentUser.role === 'privilege_admin') {
        if (targetUser.role !== 'standard_admin' || targetUser.ouId !== currentUser.ouId) {
          return res.status(403).json({ message: "You can only assign location scopes to standard admins in your OU" });
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
      
      // Privilege Admin can only remove scopes from standard_admin in their OU
      if (currentUser.role === 'privilege_admin') {
        if (targetUser.role !== 'standard_admin' || targetUser.ouId !== currentUser.ouId) {
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
        // Privilege Admin: Get standard admins in their OU with scopes
        const result = await storage.getUsersWithLocationScopes(currentUser.ouId);
        const filteredResult = result
          .filter(r => r.user.role === 'standard_admin')
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
      // Privilege Admin can only create standard_admin users in their OU
      let finalOuId = ouId;
      let finalRole = role || "standard_admin";
      
      if (user.role !== 'superadmin') {
        finalOuId = user.ouId; // Force to their OU
        finalRole = 'standard_admin'; // Can only create standard admins
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

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected to WebSocket');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
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
