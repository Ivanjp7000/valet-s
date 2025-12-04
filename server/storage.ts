import {
  users,
  organizationalUnits,
  physicalLocations,
  valetTickets,
  faqs,
  systemSettings,
  type User,
  type UpsertUser,
  type OrganizationalUnit,
  type InsertOU,
  type PhysicalLocation,
  type InsertPhysicalLocation,
  type ValetTicket,
  type InsertValetTicket,
  type Faq,
  type InsertFaq,
  type SystemSetting,
  type InsertSystemSetting,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUsersByOU(ouId: string): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  createUser(user: Omit<UpsertUser, 'id'>): Promise<User>;
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  
  // Organizational Unit operations
  createOU(ou: InsertOU): Promise<OrganizationalUnit>;
  getOU(id: string): Promise<OrganizationalUnit | undefined>;
  getAllOUs(): Promise<OrganizationalUnit[]>;
  updateOU(id: string, data: Partial<InsertOU>): Promise<OrganizationalUnit | undefined>;
  deleteOU(id: string): Promise<void>;
  
  // Physical Location operations
  createLocation(location: InsertPhysicalLocation): Promise<PhysicalLocation>;
  getLocation(id: string): Promise<PhysicalLocation | undefined>;
  getLocationsByOU(ouId: string): Promise<PhysicalLocation[]>;
  getAllLocations(): Promise<PhysicalLocation[]>;
  updateLocation(id: string, data: Partial<InsertPhysicalLocation>): Promise<PhysicalLocation | undefined>;
  deleteLocation(id: string): Promise<void>;
  
  // Valet ticket operations
  createValetTicket(ticket: InsertValetTicket): Promise<ValetTicket>;
  getValetTicket(ticketNumber: string): Promise<ValetTicket | undefined>;
  updateValetTicketStatus(ticketNumber: string, status: string): Promise<ValetTicket | undefined>;
  updateValetTicketDetails(ticketNumber: string, details: Partial<InsertValetTicket>): Promise<ValetTicket | undefined>;
  getActiveTickets(): Promise<ValetTicket[]>;
  getTicketsByLocation(locationId: string): Promise<ValetTicket[]>;
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

  async getTicketsByLocation(locationId: string): Promise<ValetTicket[]> {
    return await db
      .select()
      .from(valetTickets)
      .where(eq(valetTickets.locationId, locationId))
      .orderBy(desc(valetTickets.createdAt));
  }

  // Extended user operations
  async getUsersByOU(ouId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.ouId, ouId))
      .orderBy(asc(users.firstName));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, role))
      .orderBy(asc(users.firstName));
  }

  async updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.update(users).set({ isActive: false }).where(eq(users.id, id));
  }

  // Organizational Unit operations
  async createOU(ou: InsertOU): Promise<OrganizationalUnit> {
    const [newOU] = await db.insert(organizationalUnits).values(ou).returning();
    return newOU;
  }

  async getOU(id: string): Promise<OrganizationalUnit | undefined> {
    const [ou] = await db
      .select()
      .from(organizationalUnits)
      .where(eq(organizationalUnits.id, id));
    return ou;
  }

  async getAllOUs(): Promise<OrganizationalUnit[]> {
    return await db
      .select()
      .from(organizationalUnits)
      .where(eq(organizationalUnits.isActive, true))
      .orderBy(asc(organizationalUnits.name));
  }

  async updateOU(id: string, data: Partial<InsertOU>): Promise<OrganizationalUnit | undefined> {
    const [ou] = await db
      .update(organizationalUnits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizationalUnits.id, id))
      .returning();
    return ou;
  }

  async deleteOU(id: string): Promise<void> {
    await db.update(organizationalUnits).set({ isActive: false }).where(eq(organizationalUnits.id, id));
  }

  // Physical Location operations
  async createLocation(location: InsertPhysicalLocation): Promise<PhysicalLocation> {
    const [newLocation] = await db.insert(physicalLocations).values(location).returning();
    return newLocation;
  }

  async getLocation(id: string): Promise<PhysicalLocation | undefined> {
    const [location] = await db
      .select()
      .from(physicalLocations)
      .where(eq(physicalLocations.id, id));
    return location;
  }

  async getLocationsByOU(ouId: string): Promise<PhysicalLocation[]> {
    return await db
      .select()
      .from(physicalLocations)
      .where(and(eq(physicalLocations.ouId, ouId), eq(physicalLocations.isActive, true)))
      .orderBy(asc(physicalLocations.name));
  }

  async getAllLocations(): Promise<PhysicalLocation[]> {
    return await db
      .select()
      .from(physicalLocations)
      .where(eq(physicalLocations.isActive, true))
      .orderBy(asc(physicalLocations.name));
  }

  async updateLocation(id: string, data: Partial<InsertPhysicalLocation>): Promise<PhysicalLocation | undefined> {
    const [location] = await db
      .update(physicalLocations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(physicalLocations.id, id))
      .returning();
    return location;
  }

  async deleteLocation(id: string): Promise<void> {
    await db.update(physicalLocations).set({ isActive: false }).where(eq(physicalLocations.id, id));
  }
}

export const storage = new DatabaseStorage();
