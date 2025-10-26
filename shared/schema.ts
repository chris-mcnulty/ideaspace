import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id),
  role: text("role").notNull().default("user"), // global_admin, company_admin, facilitator, user
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const spaces = pgTable("spaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  purpose: text("purpose").notNull(),
  code: varchar("code", { length: 4 }).notNull().unique(), // 4-digit workspace code
  status: text("status").notNull().default("draft"), // draft, open, closed, processing, archived
  hidden: boolean("hidden").notNull().default(false),
  guestAllowed: boolean("guest_allowed").notNull().default(false), // Default: guests NOT allowed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const participants = pgTable("participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  userId: varchar("user_id").references(() => users.id),
  displayName: text("display_name").notNull(), // For guest users, randomized name
  isGuest: boolean("is_guest").notNull().default(false),
  isOnline: boolean("is_online").notNull().default(false),
  profileData: jsonb("profile_data"), // For registered users: email, company, job_title, etc.
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  participantId: varchar("participant_id").notNull().references(() => participants.id),
  content: text("content").notNull(),
  category: text("category"),
  isAiCategory: boolean("is_ai_category").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  participantId: varchar("participant_id").notNull().references(() => participants.id),
  winnerNoteId: varchar("winner_note_id").notNull().references(() => notes.id),
  loserNoteId: varchar("loser_note_id").notNull().references(() => notes.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rankings = pgTable("rankings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  participantId: varchar("participant_id").notNull().references(() => participants.id),
  noteId: varchar("note_id").notNull().references(() => notes.id),
  rank: integer("rank").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Association table: company admins can manage specific organizations
export const companyAdmins = pgTable("company_admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Association table: facilitators are assigned to specific workspaces
export const spaceFacilitators = pgTable("space_facilitators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Access requests: users/guests requesting access to workspaces where guest_allowed=false
export const accessRequests = pgTable("access_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  userId: varchar("user_id").references(() => users.id), // null if guest requesting before account creation
  email: text("email").notNull(), // Email for notification and identification
  displayName: text("display_name").notNull(), // Name of person requesting
  message: text("message"), // Optional message from requester
  status: text("status").notNull().default("pending"), // pending, approved, denied
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id), // Admin/facilitator who approved/denied
});

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSpaceSchema = createInsertSchema(spaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// API schema for creating spaces (code is optional, auto-generated if not provided)
export const createSpaceApiSchema = insertSpaceSchema.extend({
  code: z.string().length(4).regex(/^\d{4}$/).optional(),
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  joinedAt: true,
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

export const insertRankingSchema = createInsertSchema(rankings).omit({
  id: true,
  createdAt: true,
});

export const insertCompanyAdminSchema = createInsertSchema(companyAdmins).omit({
  id: true,
  createdAt: true,
});

export const insertSpaceFacilitatorSchema = createInsertSchema(spaceFacilitators).omit({
  id: true,
  createdAt: true,
});

export const insertAccessRequestSchema = createInsertSchema(accessRequests).omit({
  id: true,
  requestedAt: true,
  resolvedAt: true,
});

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Space = typeof spaces.$inferSelect;
export type InsertSpace = z.infer<typeof insertSpaceSchema>;

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;

export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

export type Ranking = typeof rankings.$inferSelect;
export type InsertRanking = z.infer<typeof insertRankingSchema>;

export type CompanyAdmin = typeof companyAdmins.$inferSelect;
export type InsertCompanyAdmin = z.infer<typeof insertCompanyAdminSchema>;

export type SpaceFacilitator = typeof spaceFacilitators.$inferSelect;
export type InsertSpaceFacilitator = z.infer<typeof insertSpaceFacilitatorSchema>;

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = z.infer<typeof insertAccessRequestSchema>;
