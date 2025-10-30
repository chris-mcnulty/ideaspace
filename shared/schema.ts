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
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const spaces = pgTable("spaces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  purpose: text("purpose").notNull(),
  code: varchar("code", { length: 9 }).notNull().unique(), // 8-digit workspace code (nnnn-nnnn)
  status: text("status").notNull().default("draft"), // draft, open, closed, processing, archived
  hidden: boolean("hidden").notNull().default(false),
  guestAllowed: boolean("guest_allowed").notNull().default(false), // Default: guests NOT allowed
  icon: text("icon").notNull().default("brain"), // Workspace icon identifier
  sessionMode: text("session_mode").notNull().default("live"), // 'live' or 'async'
  pairwiseScope: text("pairwise_scope").notNull().default("all"), // 'all' = compare all ideas, 'within_categories' = compare only within same category
  ideationStartsAt: timestamp("ideation_starts_at"),
  ideationEndsAt: timestamp("ideation_ends_at"),
  votingStartsAt: timestamp("voting_starts_at"),
  votingEndsAt: timestamp("voting_ends_at"),
  rankingStartsAt: timestamp("ranking_starts_at"),
  rankingEndsAt: timestamp("ranking_ends_at"),
  marketplaceStartsAt: timestamp("marketplace_starts_at"),
  marketplaceEndsAt: timestamp("marketplace_ends_at"),
  aiResultsEnabled: boolean("ai_results_enabled").notNull().default(false), // Facilitator toggle for AI-generated personalized results
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const participants = pgTable("participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  userId: varchar("user_id").references(() => users.id),
  displayName: text("display_name").notNull(), // For guest users, randomized name
  email: text("email"), // Optional email for guest participants (for linking to accounts later)
  isGuest: boolean("is_guest").notNull().default(false),
  isOnline: boolean("is_online").notNull().default(false),
  profileData: jsonb("profile_data"), // For registered users: email, company, job_title, etc.
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  name: text("name").notNull(),
  color: text("color").notNull().default("blue"), // Color identifier for UI
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  participantId: varchar("participant_id").notNull().references(() => participants.id),
  content: text("content").notNull(),
  category: text("category"), // Deprecated: AI-generated category label (use manualCategoryId instead)
  isAiCategory: boolean("is_ai_category").notNull().default(false), // Deprecated
  manualCategoryId: varchar("manual_category_id").references(() => categories.id), // FK to categories (used by both AI and manual)
  isManualOverride: boolean("is_manual_override").notNull().default(false), // True when facilitator manually assigns category
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

// Marketplace allocations: participants distribute coins among notes
export const marketplaceAllocations = pgTable("marketplace_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  participantId: varchar("participant_id").notNull().references(() => participants.id),
  noteId: varchar("note_id").notNull().references(() => notes.id),
  coinsAllocated: integer("coins_allocated").notNull(),
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

// Knowledge Base: Documents for grounding AI in categorization and results
export const knowledgeBaseDocuments = pgTable("knowledge_base_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  filename: text("filename").notNull(), // Original filename
  filePath: text("file_path").notNull(), // Path in local storage
  fileSize: integer("file_size").notNull(), // Size in bytes
  mimeType: text("mime_type").notNull(), // e.g., application/pdf, text/plain
  scope: text("scope").notNull(), // 'system', 'organization', 'workspace'
  organizationId: varchar("organization_id").references(() => organizations.id), // null for system scope
  spaceId: varchar("space_id").references(() => spaces.id), // null for system/organization scope
  tags: text("tags").array(), // Tags for categorization and filtering
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workspace Templates: Reusable workspace configurations with seeded content
export const workspaceTemplates = pgTable("workspace_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "Company Values Ideation"
  type: text("type").notNull(), // e.g., "values", "vision", "strategy", "general"
  description: text("description"),
  organizationId: varchar("organization_id").references(() => organizations.id), // null for system templates
  sourceSpaceId: varchar("source_space_id").references(() => spaces.id), // Optional: workspace it was cloned from
  settings: jsonb("settings"), // Workspace settings like guestAllowed, status, etc.
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Template Notes: Seeded notes included in templates
export const workspaceTemplateNotes = pgTable("workspace_template_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => workspaceTemplates.id),
  content: text("content").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Template Documents: Knowledge base documents linked to templates
export const workspaceTemplateDocuments = pgTable("workspace_template_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => workspaceTemplates.id),
  title: text("title").notNull(),
  description: text("description"),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Usage Log: Track OpenAI API usage for monitoring and billing
export const aiUsageLog = pgTable("ai_usage_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id), // null for system-level usage
  spaceId: varchar("space_id").references(() => spaces.id), // null if not workspace-specific
  userId: varchar("user_id").references(() => users.id), // Who triggered the AI operation
  modelName: text("model_name").notNull(), // e.g., "gpt-5"
  operation: text("operation").notNull(), // 'categorization', 'rewrite', 'summary', etc.
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  estimatedCostCents: integer("estimated_cost_cents"), // Cost in cents (for easy aggregation)
  metadata: jsonb("metadata"), // Additional context (note count, variation count, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cohort Results: AI-generated summaries of the collective envisioning session
export const cohortResults = pgTable("cohort_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  generatedBy: varchar("generated_by").notNull().references(() => users.id), // Facilitator who triggered generation
  summary: text("summary").notNull(), // High-level cohort summary
  keyThemes: text("key_themes").array(), // Top emerging themes
  topIdeas: jsonb("top_ideas"), // Top-ranked ideas with scores from all voting methods
  insights: text("insights").notNull(), // AI-generated insights from the data
  recommendations: text("recommendations"), // Actionable recommendations for the cohort
  metadata: jsonb("metadata"), // Additional data: voting stats, participation stats, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Personalized Results: AI-generated insights tailored to individual participants
export const personalizedResults = pgTable("personalized_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  participantId: varchar("participant_id").notNull().references(() => participants.id),
  cohortResultId: varchar("cohort_result_id").references(() => cohortResults.id), // Link to cohort summary
  personalSummary: text("personal_summary").notNull(), // Personalized overview based on their contributions
  alignmentScore: integer("alignment_score"), // How aligned they are with cohort (0-100)
  topContributions: jsonb("top_contributions"), // Their most impactful ideas
  insights: text("insights").notNull(), // Personalized insights
  recommendations: text("recommendations"), // Personalized next steps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  code: z.string().length(9).regex(/^\d{4}-\d{4}$/).optional(),
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  joinedAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
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

export const insertMarketplaceAllocationSchema = createInsertSchema(marketplaceAllocations).omit({
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

export const insertKnowledgeBaseDocumentSchema = createInsertSchema(knowledgeBaseDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkspaceTemplateSchema = createInsertSchema(workspaceTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkspaceTemplateNoteSchema = createInsertSchema(workspaceTemplateNotes).omit({
  id: true,
  createdAt: true,
});

export const insertWorkspaceTemplateDocumentSchema = createInsertSchema(workspaceTemplateDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertAiUsageLogSchema = createInsertSchema(aiUsageLog).omit({
  id: true,
  createdAt: true,
});

export const insertEmailVerificationTokenSchema = createInsertSchema(emailVerificationTokens).omit({
  id: true,
  createdAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export const insertCohortResultSchema = createInsertSchema(cohortResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPersonalizedResultSchema = createInsertSchema(personalizedResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

export type Ranking = typeof rankings.$inferSelect;
export type InsertRanking = z.infer<typeof insertRankingSchema>;

export type MarketplaceAllocation = typeof marketplaceAllocations.$inferSelect;
export type InsertMarketplaceAllocation = z.infer<typeof insertMarketplaceAllocationSchema>;

export type CompanyAdmin = typeof companyAdmins.$inferSelect;
export type InsertCompanyAdmin = z.infer<typeof insertCompanyAdminSchema>;

export type SpaceFacilitator = typeof spaceFacilitators.$inferSelect;
export type InsertSpaceFacilitator = z.infer<typeof insertSpaceFacilitatorSchema>;

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = z.infer<typeof insertAccessRequestSchema>;

export type KnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferSelect;
export type InsertKnowledgeBaseDocument = z.infer<typeof insertKnowledgeBaseDocumentSchema>;

export type WorkspaceTemplate = typeof workspaceTemplates.$inferSelect;
export type InsertWorkspaceTemplate = z.infer<typeof insertWorkspaceTemplateSchema>;

export type WorkspaceTemplateNote = typeof workspaceTemplateNotes.$inferSelect;
export type InsertWorkspaceTemplateNote = z.infer<typeof insertWorkspaceTemplateNoteSchema>;

export type WorkspaceTemplateDocument = typeof workspaceTemplateDocuments.$inferSelect;
export type InsertWorkspaceTemplateDocument = z.infer<typeof insertWorkspaceTemplateDocumentSchema>;

export type AiUsageLog = typeof aiUsageLog.$inferSelect;
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = z.infer<typeof insertEmailVerificationTokenSchema>;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export type CohortResult = typeof cohortResults.$inferSelect;
export type InsertCohortResult = z.infer<typeof insertCohortResultSchema>;

export type PersonalizedResult = typeof personalizedResults.$inferSelect;
export type InsertPersonalizedResult = z.infer<typeof insertPersonalizedResultSchema>;
