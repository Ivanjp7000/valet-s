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

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
// Roles: 'superadmin', 'privilege_admin', 'standard_admin'
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique(),
  password: varchar("password"),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("standard_admin").notNull(), // 'superadmin', 'privilege_admin', 'standard_admin'
  ouId: varchar("ou_id").references(() => organizationalUnits.id), // Which OU this user belongs to
  locationId: varchar("location_id").references(() => physicalLocations.id), // Which location this user works at
  createdBy: varchar("created_by"), // ID of user who created this account
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Valet tickets table
export const valetTickets = pgTable("valet_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: varchar("ticket_number", { length: 6 }).notNull().unique(),
  locationId: varchar("location_id").references(() => physicalLocations.id), // Which location this ticket belongs to
  status: varchar("status").default("active").notNull(), // 'active', 'retrieving', 'transit', 'ready', 'completed', 'cancelled'
  estimatedTime: integer("estimated_time").default(5), // in minutes
  
  // Visitor information
  visitorType: varchar("visitor_type").notNull(), // 'hotel_guest', 'restaurant', 'others'
  visitorSubType: varchar("visitor_sub_type"), // For restaurant: 'regine', 'laveduta', 'wajo', 'st_regis_bar', 'le_petit'
  guestName: varchar("guest_name").notNull(), // Full name of guest/visitor
  
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
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

export type InsertValetTicket = typeof valetTickets.$inferInsert;
export type ValetTicket = typeof valetTickets.$inferSelect;

export type InsertFaq = typeof faqs.$inferInsert;
export type Faq = typeof faqs.$inferSelect;

export type InsertSystemSetting = typeof systemSettings.$inferInsert;
export type SystemSetting = typeof systemSettings.$inferSelect;

// Role type
export type UserRole = 'superadmin' | 'privilege_admin' | 'standard_admin';

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
  'Mitsubishi', 'Nissan', 'Peugeot', 'Porsche', 'Ram', 'Renault',
  'Rolls-Royce', 'Saab', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 
  'Volkswagen', 'Volvo'
] as const;

export const insertFaqSchema = createInsertSchema(faqs).pick({
  question: true,
  answer: true,
  displayOrder: true,
});

export const updateValetTicketStatusSchema = z.object({
  status: z.enum(['retrieving', 'transit', 'ready', 'completed', 'cancelled']),
});
