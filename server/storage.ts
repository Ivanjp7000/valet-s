import {
  users,
  organizationalUnits,
  physicalLocations,
  userLocationScopes,
  valetTickets,
  ticketGuestTrips,
  faqs,
  systemSettings,
  type User,
  type UpsertUser,
  type OrganizationalUnit,
  type InsertOU,
  type PhysicalLocation,
  type InsertPhysicalLocation,
  type UserLocationScope,
  type InsertUserLocationScope,
  type ValetTicket,
  type InsertValetTicket,
  type TicketGuestTrip,
  type Faq,
  type InsertFaq,
  type SystemSetting,
  type InsertSystemSetting,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, asc, and, or, inArray, isNull } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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
  deleteValetTicket(ticketNumber: string): Promise<boolean>;
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
  
  // User Location Scope operations (for Privilege Admins to confine Standard Admins)
  getUserLocationScopes(userId: string): Promise<UserLocationScope[]>;
  addUserLocationScope(scope: InsertUserLocationScope): Promise<UserLocationScope>;
  removeUserLocationScope(userId: string, locationId: string): Promise<void>;
  getUsersWithLocationScopes(ouId: string): Promise<{user: User, scopes: UserLocationScope[]}[]>;
  
  // Scoped data access methods (for role-based filtering)
  getScopedTickets(user: User, scopedLocationIds?: string[]): Promise<ValetTicket[]>;
  getScopedActiveTickets(user: User, scopedLocationIds?: string[]): Promise<ValetTicket[]>;
  getScopedUsers(user: User): Promise<User[]>;
  getScopedLocations(user: User): Promise<PhysicalLocation[]>;
  getTicketsByOU(ouId: string): Promise<ValetTicket[]>;
  getTicketsByLocations(locationIds: string[]): Promise<ValetTicket[]>;
  
  // Guest trip log operations
  getTicketGuestTrips(ticketId: string): Promise<TicketGuestTrip[]>;
  updateGuestTrip(tripId: string, departedAt: Date, returnedAt: Date | null): Promise<TicketGuestTrip | undefined>;
  deleteGuestTrip(tripId: string): Promise<boolean>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(and(eq(users.email, email), eq(users.isActive, true)));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if user exists and is inactive (soft deleted)
    const existingUser = await this.getUser(userData.id!);
    if (existingUser && existingUser.isActive === false) {
      // User was deleted, don't re-create them - just return existing inactive user
      return existingUser;
    }

    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
          // Don't update: role, isActive, ouId, locationId (preserve admin-assigned values)
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
    const now = new Date();
    const updateData: Record<string, any> = { status, updatedAt: now };
    
    // Set stage timing fields based on status transition
    if (status === 'retrieving') {
      updateData.retrievalStartedAt = now;
      updateData.stageStartedAt = now;
      updateData.currentStage = 1;
    } else if (status === 'transit') {
      updateData.stageStartedAt = now;
      updateData.currentStage = 2;
    } else if (status === 'preparing') {
      updateData.stageStartedAt = now;
      updateData.currentStage = 3;
    } else if (status === 'ready') {
      updateData.stageStartedAt = now;
      updateData.currentStage = 4;
      updateData.retrievalReadyAt = now;
      // Calculate SLA duration: from when retrieval started → now
      const existingForSLA = await this.getValetTicket(ticketNumber);
      if (existingForSLA?.retrievalStartedAt) {
        updateData.retrievalDurationSeconds = Math.floor(
          (now.getTime() - new Date(existingForSLA.retrievalStartedAt).getTime()) / 1000
        );
      }
    } else if (status === 'completed') {
      updateData.currentStage = 4;
      updateData.departedAt = now;
      // Calculate total stay time from ticket creation
      const existingTicket = await this.getValetTicket(ticketNumber);
      if (existingTicket?.createdAt) {
        const createdAt = new Date(existingTicket.createdAt);
        updateData.totalStaySeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
      }
    } else if (status === 'out_with_guest') {
      // Guest is taking the car out ("Coming Back" was clicked)
      updateData.guestDepartedAt = now;
      updateData.currentStage = 5;
    }
    
    const [ticket] = await db
      .update(valetTickets)
      .set(updateData)
      .where(eq(valetTickets.ticketNumber, ticketNumber))
      .returning();

    // If transitioning to out_with_guest, log a new trip entry
    if (status === 'out_with_guest' && ticket) {
      await db.insert(ticketGuestTrips).values({
        ticketId: ticket.id,
        departedAt: now,
      });
    }

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

  // Mark guest as returned with car - calculates time out and moves to active status
  async markGuestReturned(ticketNumber: string): Promise<ValetTicket | undefined> {
    // First get the ticket to calculate time out
    const ticket = await this.getValetTicket(ticketNumber);
    if (!ticket || !ticket.guestDepartedAt) {
      return undefined;
    }

    const now = new Date();
    const departedAt = new Date(ticket.guestDepartedAt);
    const totalTimeOutSeconds = Math.floor((now.getTime() - departedAt.getTime()) / 1000);

    const [updatedTicket] = await db
      .update(valetTickets)
      .set({
        status: 'active',
        guestReturnedAt: now,
        totalTimeOut: totalTimeOutSeconds,
        currentStage: 0, // Reset to active state
        updatedAt: now,
      })
      .where(eq(valetTickets.ticketNumber, ticketNumber))
      .returning();

    // Close the open trip entry for this ticket
    if (updatedTicket) {
      const openTrips = await db
        .select()
        .from(ticketGuestTrips)
        .where(and(
          eq(ticketGuestTrips.ticketId, ticket.id),
          isNull(ticketGuestTrips.returnedAt)
        ))
        .orderBy(desc(ticketGuestTrips.departedAt))
        .limit(1);

      if (openTrips.length > 0) {
        const trip = openTrips[0];
        const tripDuration = Math.floor((now.getTime() - new Date(trip.departedAt).getTime()) / 1000);
        await db
          .update(ticketGuestTrips)
          .set({ returnedAt: now, durationSeconds: tripDuration })
          .where(eq(ticketGuestTrips.id, trip.id));
      }
    }

    return updatedTicket;
  }

  async getTicketGuestTrips(ticketId: string): Promise<TicketGuestTrip[]> {
    return db
      .select()
      .from(ticketGuestTrips)
      .where(eq(ticketGuestTrips.ticketId, ticketId))
      .orderBy(desc(ticketGuestTrips.departedAt));
  }

  async updateGuestTrip(tripId: string, departedAt: Date, returnedAt: Date | null): Promise<TicketGuestTrip | undefined> {
    const durationSeconds = returnedAt
      ? Math.floor((returnedAt.getTime() - departedAt.getTime()) / 1000)
      : null;
    const { rows } = await pool.query(
      `UPDATE ticket_guest_trips
       SET departed_at = $1, returned_at = $2, duration_seconds = $3
       WHERE id = $4
       RETURNING id, ticket_id as "ticketId", departed_at as "departedAt", returned_at as "returnedAt", duration_seconds as "durationSeconds", created_at as "createdAt"`,
      [departedAt, returnedAt, durationSeconds, tripId]
    );
    return rows[0];
  }

  async deleteGuestTrip(tripId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM ticket_guest_trips WHERE id = $1`,
      [tripId]
    );
    return (rowCount ?? 0) > 0;
  }

  async deleteValetTicket(ticketNumber: string): Promise<boolean> {
    const result = await db
      .delete(valetTickets)
      .where(eq(valetTickets.ticketNumber, ticketNumber))
      .returning();
    return result.length > 0;
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
    return await db.select().from(users).where(eq(users.isActive, true)).orderBy(asc(users.firstName));
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
      .where(and(eq(users.ouId, ouId), eq(users.isActive, true)))
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

  // User Location Scope operations
  async getUserLocationScopes(userId: string): Promise<UserLocationScope[]> {
    return await db
      .select()
      .from(userLocationScopes)
      .where(eq(userLocationScopes.userId, userId));
  }

  async addUserLocationScope(scope: InsertUserLocationScope): Promise<UserLocationScope> {
    const [newScope] = await db.insert(userLocationScopes).values(scope).returning();
    return newScope;
  }

  async removeUserLocationScope(userId: string, locationId: string): Promise<void> {
    await db
      .delete(userLocationScopes)
      .where(and(
        eq(userLocationScopes.userId, userId),
        eq(userLocationScopes.locationId, locationId)
      ));
  }

  async getUsersWithLocationScopes(ouId: string): Promise<{user: User, scopes: UserLocationScope[]}[]> {
    const ouUsers = await this.getUsersByOU(ouId);
    const results = await Promise.all(
      ouUsers.map(async (user) => {
        const scopes = await this.getUserLocationScopes(user.id);
        return { user, scopes };
      })
    );
    return results;
  }

  // Scoped data access methods
  async getScopedTickets(user: User, scopedLocationIds?: string[]): Promise<ValetTicket[]> {
    // Super Admin: see all tickets
    if (user.role === 'superadmin') {
      return await this.getAllTickets();
    }

    // No OU assigned: return empty (shouldn't happen for non-superadmins)
    if (!user.ouId) {
      return [];
    }

    // If user has specific location scopes, filter by those locations
    if (scopedLocationIds && scopedLocationIds.length > 0) {
      return await this.getTicketsByLocations(scopedLocationIds);
    }

    // Privilege Admin or unscoped Standard Admin: see all tickets in their OU
    return await this.getTicketsByOU(user.ouId);
  }

  async getScopedActiveTickets(user: User, scopedLocationIds?: string[]): Promise<ValetTicket[]> {
    const allTickets = await this.getScopedTickets(user, scopedLocationIds);
    // Return only active/non-cancelled tickets (including completed for history)
    return allTickets.filter(t => 
      t.status !== 'cancelled'
    );
  }

  async getScopedUsers(user: User): Promise<User[]> {
    // Super Admin: see all users
    if (user.role === 'superadmin') {
      return await this.getAllUsers();
    }

    // No OU assigned: return empty
    if (!user.ouId) {
      return [];
    }

    // Privilege Admin or Standard Admin: see users in their OU
    return await this.getUsersByOU(user.ouId);
  }

  async getScopedLocations(user: User): Promise<PhysicalLocation[]> {
    // Super Admin: see all locations
    if (user.role === 'superadmin') {
      return await this.getAllLocations();
    }

    // No OU assigned: return empty
    if (!user.ouId) {
      return [];
    }

    // Others: see locations in their OU
    return await this.getLocationsByOU(user.ouId);
  }

  async getTicketsByOU(ouId: string): Promise<ValetTicket[]> {
    return await db
      .select()
      .from(valetTickets)
      .where(eq(valetTickets.ouId, ouId))
      .orderBy(desc(valetTickets.createdAt));
  }

  async getTicketsByLocations(locationIds: string[]): Promise<ValetTicket[]> {
    if (locationIds.length === 0) return [];
    return await db
      .select()
      .from(valetTickets)
      .where(inArray(valetTickets.locationId, locationIds))
      .orderBy(desc(valetTickets.createdAt));
  }
}

export const storage = new DatabaseStorage();
