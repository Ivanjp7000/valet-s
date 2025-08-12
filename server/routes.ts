import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertValetTicketSchema, updateValetTicketStatusSchema, insertFaqSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
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

  // Protected routes (Staff/Admin only)
  app.get('/api/staff/tickets', isAuthenticated, async (req, res) => {
    try {
      const activeTickets = await storage.getActiveTickets();
      res.json(activeTickets);
    } catch (error) {
      console.error("Error fetching active tickets:", error);
      res.status(500).json({ message: "Failed to fetch active tickets" });
    }
  });

  app.patch('/api/staff/tickets/:ticketNumber/status', isAuthenticated, async (req, res) => {
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

  app.get('/api/staff/stats', isAuthenticated, async (req, res) => {
    try {
      const activeTickets = await storage.getActiveTickets();
      const completedToday = await storage.getCompletedTicketsToday();
      
      const stats = {
        pending: activeTickets.filter(t => t.status === 'retrieving').length,
        transit: activeTickets.filter(t => t.status === 'transit').length,
        ready: activeTickets.filter(t => t.status === 'ready').length,
        completed: completedToday.length,
        avgTime: '4.2m' // This could be calculated from actual data
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Super Admin routes
  const requireSuperAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ message: "Super admin access required" });
    }
    
    next();
  };

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

  // Car Photo Management Routes
  app.post('/api/car-photos/upload', isAuthenticated, async (req, res) => {
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

  // Enhanced Staff Routes for Car Management
  app.patch('/api/staff/tickets/:ticketNumber/car-details', isAuthenticated, async (req, res) => {
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
        assignedStaff: req.user?.claims?.sub,
      });

      // Broadcast update to WebSocket clients
      broadcastToAll({
        type: 'ticket_details_updated',
        data: updatedTicket,
      });

      res.json(updatedTicket);
    } catch (error) {
      console.error("Error updating car details:", error);
      if (isUnauthorizedError(error)) {
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
