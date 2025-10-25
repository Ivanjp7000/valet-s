import {
  users,
  valetTickets,
  faqs,
  systemSettings,
  type User,
  type UpsertUser,
  type ValetTicket,
  type InsertValetTicket,
  type Faq,
  type InsertFaq,
  type SystemSetting,
  type InsertSystemSetting,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  createUser(user: Omit<UpsertUser, 'id'>): Promise<User>;
  
  // Valet ticket operations
  createValetTicket(ticket: InsertValetTicket): Promise<ValetTicket>;
  getValetTicket(ticketNumber: string): Promise<ValetTicket | undefined>;
  updateValetTicketStatus(ticketNumber: string, status: string): Promise<ValetTicket | undefined>;
  updateValetTicketDetails(ticketNumber: string, details: Partial<InsertValetTicket>): Promise<ValetTicket | undefined>;
  getActiveTickets(): Promise<ValetTicket[]>;
  getCompletedTicketsToday(): Promise<ValetTicket[]>;
  getAllTickets(): Promise<ValetTicket[]>;
  
  // FAQ operations
  getFaqs(): Promise<Faq[]>;
  createFaq(faq: InsertFaq): Promise<Faq>;
  updateFaq(id: string, faq: Partial<InsertFaq>): Promise<Faq | undefined>;
  deleteFaq(id: string): Promise<void>;
  
  // System settings operations
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  getAllSystemSettings(): Promise<SystemSetting[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Valet ticket operations
  async createValetTicket(ticket: InsertValetTicket): Promise<ValetTicket> {
    const [newTicket] = await db.insert(valetTickets).values(ticket).returning();
    return newTicket;
  }

  async getValetTicket(ticketNumber: string): Promise<ValetTicket | undefined> {
    const [ticket] = await db
      .select()
      .from(valetTickets)
      .where(eq(valetTickets.ticketNumber, ticketNumber));
    return ticket;
  }

  async updateValetTicketStatus(ticketNumber: string, status: string): Promise<ValetTicket | undefined> {
    const [ticket] = await db
      .update(valetTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(valetTickets.ticketNumber, ticketNumber))
      .returning();
    return ticket;
  }

  async updateValetTicketDetails(ticketNumber: string, details: Partial<InsertValetTicket>): Promise<ValetTicket | undefined> {
    const [ticket] = await db
      .update(valetTickets)
      .set({ ...details, updatedAt: new Date() })
      .where(eq(valetTickets.ticketNumber, ticketNumber))
      .returning();
    return ticket;
  }

  async getActiveTickets(): Promise<ValetTicket[]> {
    return await db
      .select()
      .from(valetTickets)
      .where(eq(valetTickets.status, 'retrieving'))
      .orderBy(asc(valetTickets.createdAt));
  }

  async getCompletedTicketsToday(): Promise<ValetTicket[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return await db
      .select()
      .from(valetTickets)
      .where(eq(valetTickets.status, 'completed'))
      .orderBy(desc(valetTickets.updatedAt));
  }

  // FAQ operations
  async getFaqs(): Promise<Faq[]> {
    return await db
      .select()
      .from(faqs)
      .where(eq(faqs.isActive, true))
      .orderBy(asc(faqs.displayOrder));
  }

  async createFaq(faq: InsertFaq): Promise<Faq> {
    const [newFaq] = await db.insert(faqs).values(faq).returning();
    return newFaq;
  }

  async updateFaq(id: string, faq: Partial<InsertFaq>): Promise<Faq | undefined> {
    const [updatedFaq] = await db
      .update(faqs)
      .set({ ...faq, updatedAt: new Date() })
      .where(eq(faqs.id, id))
      .returning();
    return updatedFaq;
  }

  async deleteFaq(id: string): Promise<void> {
    await db.update(faqs).set({ isActive: false }).where(eq(faqs.id, id));
  }

  // System settings operations
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key));
    return setting;
  }

  async upsertSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const [newSetting] = await db
      .insert(systemSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: setting.value,
          updatedAt: new Date(),
        },
      })
      .returning();
    return newSetting;
  }

  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }

  // Additional methods for admin functionality
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.firstName));
  }

  async createUser(userData: Omit<UpsertUser, 'id'>): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getAllTickets(): Promise<ValetTicket[]> {
    return await db.select().from(valetTickets).orderBy(desc(valetTickets.createdAt));
  }
}

export const storage = new DatabaseStorage();
