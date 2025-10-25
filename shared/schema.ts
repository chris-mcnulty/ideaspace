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
  organizationId: varchar("organization_id").references(() => organizations.id),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("participant"), // publisher, org_admin, facilitator, participant
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const spaces = pgTable("spaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  purpose: text("purpose").notNull(),
  status: text("status").notNull().default("draft"), // draft, open, closed, processing
  hidden: boolean("hidden").notNull().default(false),
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
