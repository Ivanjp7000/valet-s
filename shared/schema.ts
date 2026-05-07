import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Organizational Units (Companies like Sony, Marriott, Panasonic)
export const organizationalUnits = pgTable("organizational_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  code: varchar("code").notNull().unique(), // Short unique identifier like "SONY", "MARRIOTT"
  description: text("description"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Physical Locations (Buildings/offices under each OU)
export const physicalLocations = pgTable("physical_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ouId: varchar("ou_id").notNull().references(() => organizationalUnits.id),
  name: varchar("name").notNull(),
  code: varchar("code").notNull(), // Short identifier like "TKY-HQ"
  address: text("address"),
  parkingSectors: text("parking_sectors"), // comma-separated: "A,B,C,T,E"
  maxSpots: integer("max_spots").default(100),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Location Scopes - allows Privilege Admins to confine Standard Admins to specific locations
export const userLocationScopes = pgTable("user_location_scopes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  locationId: varchar("location_id").notNull().references(() => physicalLocations.id, { onDelete: 'cascade' }),
  assignedBy: varchar("assigned_by").references(() => users.id), // Privilege Admin who assigned this scope
  createdAt: timestamp("created_at").defaultNow(),
});

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
// Roles: 'superadmin', 'privilege_admin', 'standard_admin', 'standard_user'
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique(),
  password: varchar("password"),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("standard_admin").notNull(), // 'superadmin', 'privilege_admin', 'standard_admin', 'standard_user'
  ouId: varchar("ou_id").references(() => organizationalUnits.id), // Which OU this user belongs to
  locationId: varchar("location_id").references(() => physicalLocations.id), // Which location this user works at
  createdBy: varchar("created_by"), // ID of user who created this account
  mustChangePassword: boolean("must_change_password").default(false), // Force password change on first login
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Valet tickets table
export const valetTickets = pgTable("valet_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: varchar("ticket_number", { length: 6 }).notNull().unique(),
  ouId: varchar("ou_id").references(() => organizationalUnits.id), // Which OU this ticket belongs to (denormalized for faster queries)
  locationId: varchar("location_id").references(() => physicalLocations.id), // Which location this ticket belongs to
  status: varchar("status").default("active").notNull(), // 'active', 'retrieval_requested', 'retrieving', 'transit', 'preparing', 'ready', 'out_with_guest', 'completed', 'cancelled'
  estimatedTime: integer("estimated_time").default(5), // in minutes
  
  // Visitor information
  visitorType: varchar("visitor_type").notNull(), // 'hotel_guest', 'restaurant', 'others'
  visitorSubType: varchar("visitor_sub_type"), // For restaurant: 'regine', 'laveduta', 'wajo', 'st_regis_bar', 'le_petit'
  guestName: varchar("guest_name").notNull(), // Full name of guest/visitor
  roomNumber: varchar("room_number"), // Optional room number for hotel guests
  
  // Car details
  carMake: varchar("car_make").notNull(), // e.g., "Honda", "Ferrari", "Rolls Royce"
  carModel: varchar("car_model").notNull(), // e.g., "SL55", "R1", "Passat"
  carColor: varchar("car_color").notNull(), // e.g., "Black", "White", "Silver"
  licensePlate: varchar("license_plate"),
  platePhotoUrl: varchar("plate_photo_url"), // Cropped photo of registration plate
  carPhoto: varchar("car_photo"), // URL to car image
  parkingLocation: varchar("parking_location"), // e.g., "A3", "C12", "T21"
  parkingSector: varchar("parking_sector"), // A, B, C, T, E
  
  // Staff management
  staffNotes: text("staff_notes"),
  assignedStaff: varchar("assigned_staff"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id), // Staff who created this ticket
  createdByName: varchar("created_by_name"), // Full name of staff for display
  
  // Timer tracking for auto-progression
  retrievalStartedAt: timestamp("retrieval_started_at"), // When retrieval process began
  retrievalReadyAt: timestamp("retrieval_ready_at"),     // When status first reached 'ready'
  retrievalDurationSeconds: integer("retrieval_duration_seconds"), // Total seconds from retrieving → ready (SLA metric)
  stageStartedAt: timestamp("stage_started_at"), // When current stage started (for per-stage countdown)
  currentStage: integer("current_stage").default(0), // 0=not started, 1=retrieving, 2=transit, 3=preparing, 4=ready
  
  // Guest vehicle out tracking
  guestDepartedAt: timestamp("guest_departed_at"), // When guest took the car out (Coming Back clicked)
  guestReturnedAt: timestamp("guest_returned_at"), // When guest returned the car (Back clicked)
  totalTimeOut: integer("total_time_out"), // Duration in seconds car was out with guest
  
  // Total stay tracking
  totalStaySeconds: integer("total_stay_seconds"), // Duration in seconds from ticket creation to departure
  departedAt: timestamp("departed_at"), // When the guest finally departed (completed)

  // Scheduled retrieval
  scheduledRetrievalAt: timestamp("scheduled_retrieval_at"), // Guest-chosen future retrieval time
  reminderEmail: varchar("reminder_email"),                  // Email to send reminder to

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Guest trip log — one entry per time the car goes out with the guest and comes back
export const ticketGuestTrips = pgTable("ticket_guest_trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => valetTickets.id, { onDelete: 'cascade' }),
  departedAt: timestamp("departed_at").notNull(),
  returnedAt: timestamp("returned_at"),
  durationSeconds: integer("duration_seconds"), // null while still out
  createdAt: timestamp("created_at").defaultNow(),
});

export type InsertTicketGuestTrip = typeof ticketGuestTrips.$inferInsert;
export type TicketGuestTrip = typeof ticketGuestTrips.$inferSelect;

// FAQ entries table
export const faqs = pgTable("faqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System settings table
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema exports
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertOU = typeof organizationalUnits.$inferInsert;
export type OrganizationalUnit = typeof organizationalUnits.$inferSelect;

export type InsertPhysicalLocation = typeof physicalLocations.$inferInsert;
export type PhysicalLocation = typeof physicalLocations.$inferSelect;

export type InsertUserLocationScope = typeof userLocationScopes.$inferInsert;
export type UserLocationScope = typeof userLocationScopes.$inferSelect;

export type InsertValetTicket = typeof valetTickets.$inferInsert;
export type ValetTicket = typeof valetTickets.$inferSelect;

export type InsertFaq = typeof faqs.$inferInsert;
export type Faq = typeof faqs.$inferSelect;

export type InsertSystemSetting = typeof systemSettings.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;

// Role type
export type UserRole = 'superadmin' | 'privilege_admin' | 'standard_admin' | 'standard_user';

// Zod schemas
export const insertOUSchema = createInsertSchema(organizationalUnits).pick({
  name: true,
  code: true,
  description: true,
  contactEmail: true,
  contactPhone: true,
});

export const insertPhysicalLocationSchema = createInsertSchema(physicalLocations).pick({
  ouId: true,
  name: true,
  code: true,
  address: true,
  parkingSectors: true,
  maxSpots: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  ouId: true,
  locationId: true,
});

export const insertValetTicketSchema = createInsertSchema(valetTickets).pick({
  ticketNumber: true,
  visitorType: true,
  visitorSubType: true,
  guestName: true,
  carMake: true,
  carModel: true,
  carColor: true,
  licensePlate: true,
  platePhotoUrl: true,
  carPhoto: true,
  locationId: true,
  parkingSector: true,
  parkingLocation: true,
  createdByUserId: true,
  createdByName: true,
});

// Visitor types and sub-types
export const VISITOR_TYPES = {
  hotel_guest: 'Hotel Staying Guest',
  restaurant: 'Restaurant Valet',
  event: 'Event',
  others: 'Others',
} as const;

export const RESTAURANT_SUB_TYPES = {
  regine: 'Regine',
  laveduta: 'LaVeduta',
  wajo: 'Wajo',
  st_regis_bar: 'St. Regis Bar',
  le_petit: 'Le Petit',
} as const;

// Common car colors
export const CAR_COLORS = [
  'Black', 'White', 'Silver', 'Gray', 'Red', 
  'Blue', 'Navy', 'Green', 'Gold', 'Brown',
  'Beige', 'Orange', 'Yellow', 'Purple', 'Other'
] as const;

// Popular car makes for predictive search
export const CAR_MAKES = [
  'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 
  'Bugatti', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Citroën',
  'Daihatsu', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 'Genesis', 
  'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Isuzu', 'Jaguar', 
  'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln', 
  'Lotus', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'Mini', 
  'Mini Cooper', 'Mitsubishi', 'Nissan', 'Peugeot', 'Porsche', 'Ram', 'Renault',
  'Rolls-Royce', 'Saab', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 
  'Volkswagen', 'Volvo'
] as const;

export const insertFaqSchema = createInsertSchema(faqs).pick({
  question: true,
  answer: true,
  displayOrder: true,
});

export const updateValetTicketStatusSchema = z.object({
  status: z.enum(['active', 'retrieving', 'transit', 'preparing', 'ready', 'completed', 'cancelled', 'out_with_guest']),
});

export type SafeUser = Omit<User, 'password'> & { hasPassword: boolean };
