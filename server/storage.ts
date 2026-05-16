import {
  users,
  organizationalUnits,
  physicalLocations,
  userLocationScopes,
  valetTickets,
  ticketGuestTrips,
  faqs,
  systemSettings,
  ouLicenses,
  guestNameImports,
  sessionAuditLog,
  gsMembers,
  gsMessages,
  gsReplies,
  calendarEvents,
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
  type OULicense,
  type InsertOULicense,
  type SessionAuditLog,
  type GsMember,
  type GsMessage,
  type GsReply,
  type CalendarEvent,
  type GuestNameImport,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, asc, and, or, inArray, isNull, lte, isNotNull, gt, ilike, lt } from "drizzle-orm";
import { sql as drizzleSql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getPendingRegistrations(): Promise<User[]>;
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
  getValetTicketById(id: string): Promise<ValetTicket | undefined>;
  updateValetTicketStatus(ticketNumber: string, status: string): Promise<ValetTicket | undefined>;
  updateValetTicketDetails(ticketNumber: string, details: Partial<InsertValetTicket>): Promise<ValetTicket | undefined>;
  updateValetTicket(ticketNumber: string, fields: Partial<ValetTicket>): Promise<ValetTicket | undefined>;
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
  getTicketByPhotoPath(photoPath: string): Promise<ValetTicket | undefined>;
  
  // Guest trip log operations
  getTicketGuestTrips(ticketId: string): Promise<TicketGuestTrip[]>;
  getGuestTripById(tripId: string): Promise<TicketGuestTrip | undefined>;
  updateGuestTrip(tripId: string, departedAt: Date, returnedAt: Date | null): Promise<TicketGuestTrip | undefined>;
  deleteGuestTrip(tripId: string): Promise<boolean>;

  // Scheduled departure
  getDueScheduledDepartures(): Promise<ValetTicket[]>;

  // Scheduled retrieval alerts
  getUpcomingScheduledRetrievals(withinMinutes: number): Promise<ValetTicket[]>;

  // OU License operations
  createLicense(license: Omit<InsertOULicense, 'id' | 'issuedAt' | 'updatedAt'> & { licenseKey: string }): Promise<OULicense>;
  getLicenseByOU(ouId: string): Promise<OULicense | undefined>;
  getAllLicenses(): Promise<OULicense[]>;
  updateLicense(id: string, data: Partial<OULicense>): Promise<OULicense | undefined>;
  updateOUBranding(ouId: string, data: { logoUrl?: string; primaryColor?: string; accentColor?: string }): Promise<OrganizationalUnit | undefined>;

  // Guest Name Import operations
  bulkImportGuestNames(names: { name: string; visitorType: string }[], ouId: string): Promise<void>;
  getGuestNameSuggestions(prefix: string, visitorType: string, ouId: string): Promise<string[]>;
  clearGuestNameImports(visitorType: string, ouId: string): Promise<void>;
  listGuestNameImports(ouId: string): Promise<GuestNameImport[]>;
  deleteGuestNameImport(id: string, ouId: string): Promise<void>;

  // Session Audit operations
  upsertSessionAudit(data: { sessionId: string; userId: string; username: string; displayName?: string; role: string; ouId?: string; ipAddress?: string; country?: string; city?: string; deviceType?: string; os?: string; browser?: string }): Promise<void>;
  getActiveSessionAudits(ouId?: string): Promise<SessionAuditLog[]>;
  getArchivedSessionAudits(date: string, ouId?: string): Promise<SessionAuditLog[]>;
  getAuditArchiveDates(ouId?: string): Promise<string[]>;

  // GS Hub operations
  getGSMembers(ouId: string): Promise<GsMember[]>;
  isGSMember(ouId: string, userId: string): Promise<boolean>;
  addGSMember(ouId: string, userId: string, addedBy: string): Promise<GsMember>;
  removeGSMember(ouId: string, userId: string): Promise<void>;
  getGSMessages(ouId: string): Promise<(GsMessage & { replies: GsReply[] })[]>;
  createGSMessage(data: { ouId: string; senderId: string; senderName: string; content: string }): Promise<GsMessage>;
  addGSReply(messageId: string, data: { senderId: string; senderName: string; content: string }): Promise<GsReply>;
  markGSMessageScheduled(messageId: string, calendarEventId: string): Promise<GsMessage | undefined>;
  acknowledgeGSMessage(messageId: string): Promise<GsMessage | undefined>;
  updateGSMessage(messageId: string, content: string): Promise<GsMessage | undefined>;
  deleteGSMessage(messageId: string): Promise<void>;
  getCalendarEvents(ouId: string): Promise<CalendarEvent[]>;
  createCalendarEvent(data: { ouId: string; title: string; eventDate: string; startTime?: string; endTime?: string; details?: string; category?: string; createdBy: string; createdByName: string; sourceMessageId?: string }): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, data: Partial<{ title: string; eventDate: string; startTime: string; endTime: string; details: string; category: string }>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<void>;
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

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user;
  }

  async getPendingRegistrations(): Promise<User[]> {
    return await db.select().from(users)
      .where(
        or(
          eq(users.accountStatus, 'pending_approval'),
          eq(users.accountStatus, 'pending_email_verification')
        )
      )
      .orderBy(asc(users.createdAt));
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

  async getValetTicketById(id: string): Promise<ValetTicket | undefined> {
    const [ticket] = await db
      .select()
      .from(valetTickets)
      .where(eq(valetTickets.id, id));
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

  async updateValetTicket(ticketNumber: string, fields: Partial<ValetTicket>): Promise<ValetTicket | undefined> {
    const [ticket] = await db
      .update(valetTickets)
      .set({ ...(fields as any), updatedAt: new Date() })
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

  async getGuestTripById(tripId: string): Promise<TicketGuestTrip | undefined> {
    const [trip] = await db
      .select()
      .from(ticketGuestTrips)
      .where(eq(ticketGuestTrips.id, tripId));
    return trip;
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

  async getDueScheduledDepartures(): Promise<ValetTicket[]> {
    const now = new Date();
    return await db
      .select()
      .from(valetTickets)
      .where(
        and(
          eq(valetTickets.status, 'active'),
          isNotNull(valetTickets.scheduledDepartureAt),
          lte(valetTickets.scheduledDepartureAt, now)
        )
      );
  }

  async getUpcomingScheduledRetrievals(withinMinutes: number): Promise<ValetTicket[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + withinMinutes * 60 * 1000);
    return await db
      .select()
      .from(valetTickets)
      .where(
        and(
          eq(valetTickets.status, 'active'),
          isNotNull(valetTickets.scheduledRetrievalAt),
          gt(valetTickets.scheduledRetrievalAt, now),
          lte(valetTickets.scheduledRetrievalAt, cutoff)
        )
      );
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
    return await db.select().from(users)
      .where(and(eq(users.isActive, true), eq(users.accountStatus, 'active')))
      .orderBy(asc(users.firstName));
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
      .where(and(eq(users.ouId, ouId), eq(users.isActive, true), eq(users.accountStatus, 'active'), eq(users.isHidden, false)))
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

    // scopedLocationIds === undefined  → no location restriction, see full OU
    // scopedLocationIds is an array    → restricted; empty array means access to nothing
    if (scopedLocationIds !== undefined) {
      if (scopedLocationIds.length === 0) return [];
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

  async getTicketByPhotoPath(photoPath: string): Promise<ValetTicket | undefined> {
    const [ticket] = await db
      .select()
      .from(valetTickets)
      .where(or(eq(valetTickets.carPhoto, photoPath), eq(valetTickets.platePhotoUrl, photoPath)))
      .limit(1);
    return ticket;
  }

  async createLicense(license: Omit<InsertOULicense, 'id' | 'issuedAt' | 'updatedAt'> & { licenseKey: string }): Promise<OULicense> {
    const [lic] = await db.insert(ouLicenses).values(license).returning();
    return lic;
  }

  async getLicenseByOU(ouId: string): Promise<OULicense | undefined> {
    const [lic] = await db.select().from(ouLicenses).where(eq(ouLicenses.ouId, ouId)).limit(1);
    return lic;
  }

  async getAllLicenses(): Promise<OULicense[]> {
    return await db.select().from(ouLicenses).orderBy(desc(ouLicenses.issuedAt));
  }

  async updateLicense(id: string, data: Partial<OULicense>): Promise<OULicense | undefined> {
    const [lic] = await db.update(ouLicenses).set({ ...data, updatedAt: new Date() }).where(eq(ouLicenses.id, id)).returning();
    return lic;
  }

  async updateOUBranding(ouId: string, data: { logoUrl?: string; primaryColor?: string; accentColor?: string }): Promise<OrganizationalUnit | undefined> {
    const [ou] = await db.update(organizationalUnits).set({ ...data, updatedAt: new Date() }).where(eq(organizationalUnits.id, ouId)).returning();
    return ou;
  }

  async bulkImportGuestNames(names: { name: string; visitorType: string }[], ouId: string): Promise<void> {
    if (names.length === 0) return;
    // Clear old entries for this ouId + visitorType before inserting fresh batch
    const visitorType = names[0].visitorType;
    await db.delete(guestNameImports).where(and(eq(guestNameImports.ouId, ouId), eq(guestNameImports.visitorType, visitorType)));
    await db.insert(guestNameImports).values(names.map(n => ({ name: n.name, visitorType: n.visitorType, ouId })));
  }

  async getGuestNameSuggestions(prefix: string, visitorType: string, ouId: string): Promise<string[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const results = await db.select({ name: guestNameImports.name })
      .from(guestNameImports)
      .where(and(
        eq(guestNameImports.ouId, ouId),
        eq(guestNameImports.visitorType, visitorType),
        gt(guestNameImports.createdAt, cutoff),
        ilike(guestNameImports.name, `${prefix}%`)
      ))
      .orderBy(asc(guestNameImports.name))
      .limit(8);
    return results.map(r => r.name);
  }

  async clearGuestNameImports(visitorType: string, ouId: string): Promise<void> {
    await db.delete(guestNameImports).where(and(eq(guestNameImports.ouId, ouId), eq(guestNameImports.visitorType, visitorType)));
  }

  async listGuestNameImports(ouId: string): Promise<GuestNameImport[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return db.select().from(guestNameImports)
      .where(and(eq(guestNameImports.ouId, ouId), gt(guestNameImports.createdAt, cutoff)))
      .orderBy(asc(guestNameImports.visitorType), asc(guestNameImports.name));
  }

  async deleteGuestNameImport(id: string, ouId: string): Promise<void> {
    await db.delete(guestNameImports).where(and(eq(guestNameImports.id, id), eq(guestNameImports.ouId, ouId)));
  }

  async upsertSessionAudit(data: { sessionId: string; userId: string; username: string; displayName?: string; role: string; ouId?: string; ipAddress?: string; country?: string; city?: string; deviceType?: string; os?: string; browser?: string }): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    await db.insert(sessionAuditLog).values({
      sessionId: data.sessionId,
      userId: data.userId,
      username: data.username,
      displayName: data.displayName,
      role: data.role,
      ouId: data.ouId,
      ipAddress: data.ipAddress,
      country: data.country,
      city: data.city,
      deviceType: data.deviceType,
      os: data.os,
      browser: data.browser,
      firstSeenAt: now,
      lastSeenAt: now,
      snapshotDate: today,
    }).onConflictDoUpdate({
      target: sessionAuditLog.sessionId,
      set: {
        lastSeenAt: now,
        // snapshotDate intentionally NOT updated — it stays as the day the session first started
        country: data.country,
        city: data.city,
        ipAddress: data.ipAddress,
      },
    });
  }

  async getActiveSessionAudits(ouId?: string): Promise<SessionAuditLog[]> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    if (ouId) {
      return db.select().from(sessionAuditLog)
        .where(and(eq(sessionAuditLog.ouId, ouId), gt(sessionAuditLog.lastSeenAt, cutoff)))
        .orderBy(desc(sessionAuditLog.lastSeenAt));
    }
    return db.select().from(sessionAuditLog)
      .where(gt(sessionAuditLog.lastSeenAt, cutoff))
      .orderBy(desc(sessionAuditLog.lastSeenAt));
  }

  async getArchivedSessionAudits(date: string, ouId?: string): Promise<SessionAuditLog[]> {
    if (ouId) {
      return db.select().from(sessionAuditLog)
        .where(and(eq(sessionAuditLog.ouId, ouId), eq(sessionAuditLog.snapshotDate, date)))
        .orderBy(desc(sessionAuditLog.lastSeenAt));
    }
    return db.select().from(sessionAuditLog)
      .where(eq(sessionAuditLog.snapshotDate, date))
      .orderBy(desc(sessionAuditLog.lastSeenAt));
  }

  async getAuditArchiveDates(ouId?: string): Promise<string[]> {
    const rows = await pool.query<{ snapshot_date: string }>(
      ouId
        ? `SELECT DISTINCT snapshot_date FROM session_audit_log WHERE ou_id = $1 AND snapshot_date IS NOT NULL ORDER BY snapshot_date DESC LIMIT 90`
        : `SELECT DISTINCT snapshot_date FROM session_audit_log WHERE snapshot_date IS NOT NULL ORDER BY snapshot_date DESC LIMIT 90`,
      ouId ? [ouId] : []
    );
    return rows.rows.map(r => r.snapshot_date);
  }

  // ── GS Hub ────────────────────────────────────────────────────────────────

  async getGSMembers(ouId: string): Promise<GsMember[]> {
    return db.select().from(gsMembers).where(eq(gsMembers.ouId, ouId)).orderBy(asc(gsMembers.createdAt));
  }

  async isGSMember(ouId: string, userId: string): Promise<boolean> {
    const [row] = await db.select().from(gsMembers).where(and(eq(gsMembers.ouId, ouId), eq(gsMembers.userId, userId)));
    return !!row;
  }

  async addGSMember(ouId: string, userId: string, addedBy: string): Promise<GsMember> {
    const [row] = await db.insert(gsMembers).values({ ouId, userId, addedBy }).returning();
    return row;
  }

  async removeGSMember(ouId: string, userId: string): Promise<void> {
    await db.delete(gsMembers).where(and(eq(gsMembers.ouId, ouId), eq(gsMembers.userId, userId)));
  }

  async getGSMessages(ouId: string): Promise<(GsMessage & { replies: GsReply[] })[]> {
    const messages = await db.select().from(gsMessages).where(eq(gsMessages.ouId, ouId)).orderBy(desc(gsMessages.createdAt));
    const messageIds = messages.map(m => m.id);
    const replies = messageIds.length > 0
      ? await db.select().from(gsReplies).where(inArray(gsReplies.messageId, messageIds)).orderBy(asc(gsReplies.createdAt))
      : [];
    return messages.map(m => ({ ...m, replies: replies.filter(r => r.messageId === m.id) }));
  }

  async createGSMessage(data: { ouId: string; senderId: string; senderName: string; content: string }): Promise<GsMessage> {
    const [row] = await db.insert(gsMessages).values({ ...data, status: 'open' }).returning();
    return row;
  }

  async addGSReply(messageId: string, data: { senderId: string; senderName: string; content: string }): Promise<GsReply> {
    const [row] = await db.insert(gsReplies).values({ messageId, ...data }).returning();
    return row;
  }

  async markGSMessageScheduled(messageId: string, calendarEventId: string): Promise<GsMessage | undefined> {
    const [row] = await db.update(gsMessages).set({ status: 'scheduled', calendarEventId }).where(eq(gsMessages.id, messageId)).returning();
    return row;
  }

  async acknowledgeGSMessage(messageId: string): Promise<GsMessage | undefined> {
    const [row] = await db.update(gsMessages).set({ acknowledgedAt: new Date() }).where(eq(gsMessages.id, messageId)).returning();
    return row;
  }

  async updateGSMessage(messageId: string, content: string): Promise<GsMessage | undefined> {
    const [row] = await db.update(gsMessages).set({ content }).where(eq(gsMessages.id, messageId)).returning();
    return row;
  }

  async deleteGSMessage(messageId: string): Promise<void> {
    await db.delete(gsMessages).where(eq(gsMessages.id, messageId));
  }

  async getCalendarEvents(ouId: string): Promise<CalendarEvent[]> {
    return db.select().from(calendarEvents).where(eq(calendarEvents.ouId, ouId)).orderBy(asc(calendarEvents.eventDate), asc(calendarEvents.startTime));
  }

  async createCalendarEvent(data: { ouId: string; title: string; eventDate: string; startTime?: string; endTime?: string; details?: string; category?: string; createdBy: string; createdByName: string; sourceMessageId?: string }): Promise<CalendarEvent> {
    const [row] = await db.insert(calendarEvents).values({ ...data, category: data.category || 'general' }).returning();
    return row;
  }

  async updateCalendarEvent(id: string, data: Partial<{ title: string; eventDate: string; startTime: string; endTime: string; details: string; category: string }>): Promise<CalendarEvent | undefined> {
    const [row] = await db.update(calendarEvents).set({ ...data, updatedAt: new Date() }).where(eq(calendarEvents.id, id)).returning();
    return row;
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  }
}

export const storage = new DatabaseStorage();
