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
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Physical Locations (Buildings/offices under each OU)
export const physicalLocations = pgTable("physical_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ouId: varchar("ou_id").notNull().references(() => organizationalUnits.id),
  name: varchar("name").notNull(),
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
  // Car details
  licensePlate: varchar("license_plate"),
  carPhoto: varchar("car_photo"), // URL to car image
  parkingLocation: varchar("parking_location"), // e.g., "A3", "C12", "T21"
  parkingSector: varchar("parking_sector"), // A, B, C, T, E
  // Staff management
  staffNotes: text("staff_notes"),
  assignedStaff: varchar("assigned_staff"),
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
  description: true,
});

export const insertPhysicalLocationSchema = createInsertSchema(physicalLocations).pick({
  ouId: true,
  name: true,
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
});

export const insertFaqSchema = createInsertSchema(faqs).pick({
  question: true,
  answer: true,
  displayOrder: true,
});

export const updateValetTicketStatusSchema = z.object({
  status: z.enum(['retrieving', 'transit', 'ready', 'completed', 'cancelled']),
});
