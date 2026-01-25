import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// System-wide and organization-level settings table
// For system-wide settings: organizationId is null
// For organization-specific settings: organizationId is set
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"), // null for system-wide settings, set for org-specific
  key: text("key").notNull(), // e.g., 'oauth_enabled', 'maintenance_mode', etc.
  value: jsonb("value").notNull(), // Flexible JSON value for different setting types
  description: text("description"), // Human-readable description of the setting
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by"), // Will reference users.id
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure unique key per organization (or system-wide if organizationId is null)
  uniqueOrgKey: unique().on(table.organizationId, table.key),
}));

// Service Plans for subscription tiers
export const servicePlans = pgTable("service_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // 'trial', 'team', 'enterprise'
  displayName: text("display_name").notNull(), // 'Trial', 'Team', 'Enterprise'
  description: text("description"),
  maxWorkspaces: integer("max_workspaces").notNull().default(1), // -1 for unlimited
  maxTeamSeats: integer("max_team_seats").notNull().default(5), // Max users per org
  aiEnabled: boolean("ai_enabled").notNull().default(false), // AI features unlocked
  trialDays: integer("trial_days"), // Number of days for trial period (null for non-trial plans)
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Public email domains list (Gmail, Yahoo, Outlook, etc.) - users with these domains get invite-only tenants
export const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'tutanota.com', 'zoho.com',
  'mail.com', 'gmx.com', 'gmx.net', 'yandex.com', 'qq.com', '163.com'
];

export function isPublicEmailDomain(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1];
  return PUBLIC_EMAIL_DOMAINS.includes(domain);
}

export function getEmailDomain(email: string): string {
  return email.toLowerCase().split('@')[1] || '';
}

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  // Domain and SSO fields
  domain: text("domain"), // Primary email domain for this organization (e.g., 'acme.com')
  allowedDomains: text("allowed_domains").array(), // Additional allowed email domains
  inviteOnly: boolean("invite_only").notNull().default(false), // If true, users must be invited to join
  // SSO Configuration
  ssoEnabled: boolean("sso_enabled").notNull().default(false),
  ssoProvider: text("sso_provider"), // 'entra', 'google', etc.
  entraTenantId: text("entra_tenant_id"), // Microsoft Entra (Azure AD) Tenant ID
  // Service Plan
  servicePlanId: varchar("service_plan_id").references(() => servicePlans.id),
  subscriptionStartedAt: timestamp("subscription_started_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password"), // Now nullable for OAuth users
  organizationId: varchar("organization_id").references(() => organizations.id),
  role: text("role").notNull().default("user"), // global_admin, company_admin, facilitator, user
  displayName: text("display_name"),
  emailVerified: boolean("email_verified").notNull().default(false),
  // OAuth fields (legacy - Orion)
  orionId: text("orion_id").unique(), // User ID from Orion identity provider
  orionTenantId: text("orion_tenant_id"), // Tenant ID from Orion
  // Entra ID (Azure AD) fields
  entraId: text("entra_id").unique(), // Microsoft Entra Object ID (oid claim)
  entraTenantId: text("entra_tenant_id"), // Microsoft Entra Tenant ID (tid claim)
  // Auth provider: 'local', 'orion', 'entra'
  authProvider: text("auth_provider").notNull().default("local"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  organizationId: varchar("organization_id").references(() => organizations.id), // Nullable for system templates
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
  marketplaceCoinBudget: integer("marketplace_coin_budget").notNull().default(100), // Number of coins each participant gets in marketplace
  surveyStartsAt: timestamp("survey_starts_at"),
  surveyEndsAt: timestamp("survey_ends_at"),
  aiResultsEnabled: boolean("ai_results_enabled").notNull().default(false), // Facilitator toggle for AI-generated personalized results
  resultsPublicAfterClose: boolean("results_public_after_close").notNull().default(false), // Allow read-only results access after workspace is closed
  isTemplate: boolean("is_template").notNull().default(false), // True if this workspace is a template
  templateScope: text("template_scope").default("organization"), // 'system' (global) or 'organization' (org-specific)
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
  visibleInRanking: boolean("visible_in_ranking").notNull().default(true), // Facilitator can hide from ranking phase
  visibleInMarketplace: boolean("visible_in_marketplace").notNull().default(true), // Facilitator can hide from marketplace phase
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

// Survey Questions: Customizable questions for participants to rate ideas
export const surveyQuestions = pgTable("survey_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  questionText: text("question_text").notNull(),
  sortOrder: integer("sort_order").notNull().default(0), // Order of questions in the survey
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Survey Responses: Participant ratings for each idea on each survey question
export const surveyResponses = pgTable("survey_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  participantId: varchar("participant_id").notNull().references(() => participants.id),
  noteId: varchar("note_id").notNull().references(() => notes.id),
  questionId: varchar("question_id").notNull().references(() => surveyQuestions.id),
  score: integer("score").notNull(), // 1-5 rating
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
  scope: text("scope").notNull(), // 'system', 'organization', 'workspace', 'multi_workspace'
  organizationId: varchar("organization_id").references(() => organizations.id), // null for system scope
  spaceId: varchar("space_id").references(() => spaces.id), // null for system/organization scope, deprecated for multi_workspace
  tags: text("tags").array(), // Tags for categorization and filtering
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Document Workspace Access: Junction table for multi-workspace document sharing
export const documentWorkspaceAccess = pgTable("document_workspace_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => knowledgeBaseDocuments.id, { onDelete: "cascade" }),
  spaceId: varchar("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

// IDEAS-CENTRIC ARCHITECTURE: Core idea entities independent of modules

// Ideas: Core idea entity that exists independently of modules
export const ideas = pgTable("ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  content: text("content").notNull(), // Rich text (HTML/Markdown) or plain text content
  contentPlain: text("content_plain"), // Plain text version for search/export (auto-extracted)
  contentType: text("content_type").notNull().default("text"), // 'text', 'markdown', 'html', 'image', 'mixed'
  sourceType: text("source_type").notNull().default("participant"), // 'participant', 'facilitator', 'preloaded', 'imported'
  assetUrl: text("asset_url"), // Primary asset URL (for image ideas or attachments)
  assetType: text("asset_type"), // 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'
  thumbnailUrl: text("thumbnail_url"), // Thumbnail for performance (auto-generated)
  assetMetadata: jsonb("asset_metadata"), // { width, height, size, originalName, mimeType }
  createdByUserId: varchar("created_by_user_id").references(() => users.id), // Nullable: facilitator or preloaded source
  createdByParticipantId: varchar("created_by_participant_id").references(() => participants.id), // Nullable: participant source
  manualCategoryId: varchar("manual_category_id").references(() => categories.id), // Category assignment (AI or manual)
  isManualOverride: boolean("is_manual_override").notNull().default(false), // True when facilitator manually assigns category
  showOnIdeationBoard: boolean("show_on_ideation_board").notNull().default(false), // When true, idea appears on participant ideation board as a "seed" idea
  metadata: jsonb("metadata"), // Flexible storage for source provenance, import details, formatting options
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Idea Contributions: Track participant contributions and revisions to ideas
export const ideaContributions = pgTable("idea_contributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  participantId: varchar("participant_id").notNull().references(() => participants.id),
  contributionType: text("contribution_type").notNull().default("create"), // 'create', 'edit', 'merge'
  revisionData: jsonb("revision_data"), // Stores old/new content for tracking changes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Module type and config definitions
export const MODULE_TYPES = [
  "ideation",
  "pairwise-voting", 
  "stack-ranking",
  "marketplace",
  "priority-matrix",
  "survey",
  "staircase"
] as const;
export type ModuleType = typeof MODULE_TYPES[number];

// Module config schemas
const ideationConfigSchema = z.object({
  maxIdeasPerParticipant: z.number().int().min(1).max(100).default(10),
  allowAnonymous: z.boolean().default(false),
  requireCategory: z.boolean().default(false),
  minWordCount: z.number().int().min(0).max(50).default(0),
  maxWordCount: z.number().int().min(0).max(500).default(0),
  timerEnabled: z.boolean().default(false),
  timerDurationMinutes: z.number().int().min(1).max(120).default(15)
});

const pairwiseVotingConfigSchema = z.object({
  roundsPerParticipant: z.number().int().min(1).max(100).default(20),
  showProgress: z.boolean().default(true),
  allowSkip: z.boolean().default(true)
});

const stackRankingConfigSchema = z.object({
  maxRankings: z.number().int().min(1).max(50).default(10),
  showScores: z.boolean().default(false),
  allowTies: z.boolean().default(false)
});

const marketplaceConfigSchema = z.object({
  coinsPerParticipant: z.number().int().min(1).max(1000).default(100),
  maxCoinsPerIdea: z.number().int().min(1).max(500).default(50),
  showLeaderboard: z.boolean().default(true)
});

const priorityMatrixConfigSchema = z.object({
  xAxisLabel: z.string().default("Impact"),
  yAxisLabel: z.string().default("Effort"),
  collaborative: z.boolean().default(true)
});

const surveyConfigSchema = z.object({
  questionsPerIdea: z.number().int().min(1).max(10).default(3),
  randomizeOrder: z.boolean().default(false),
  showAverage: z.boolean().default(true)
});

const staircaseConfigSchema = z.object({
  minLabel: z.string().default("Lowest"),
  maxLabel: z.string().default("Highest"),
  stepCount: z.number().int().min(5).max(21).default(11), // Default 0-10 = 11 steps
  allowDecimals: z.boolean().default(false),
  collaborative: z.boolean().default(true),
  showDistribution: z.boolean().default(true)
});

export const moduleConfigSchemas = {
  "ideation": ideationConfigSchema,
  "pairwise-voting": pairwiseVotingConfigSchema,
  "stack-ranking": stackRankingConfigSchema,
  "marketplace": marketplaceConfigSchema,
  "priority-matrix": priorityMatrixConfigSchema,
  "survey": surveyConfigSchema,
  "staircase": staircaseConfigSchema
} satisfies Record<ModuleType, z.ZodTypeAny>;

export type ModuleConfigMap = {
  [K in ModuleType]: z.infer<typeof moduleConfigSchemas[K]>
};

export type ModuleConfigUnion = {
  [K in ModuleType]: { moduleType: K; config: ModuleConfigMap[K] }
}[ModuleType];

// Workspace Modules: Configure which modules are enabled for a workspace
export const workspaceModules = pgTable("workspace_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  moduleType: text("module_type").notNull().$type<ModuleType>(),
  enabled: boolean("enabled").notNull().default(true),
  orderIndex: integer("order_index").notNull().default(0), // Determines module sequence in journey
  config: jsonb("config").notNull().default(sql`'{}'::jsonb`).$type<ModuleConfigMap[ModuleType]>(), // Typed module-specific configuration
  startsAt: timestamp("starts_at"), // When this module phase starts (optional for async)
  endsAt: timestamp("ends_at"), // When this module phase ends (optional for async)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueSpaceModule: unique().on(table.spaceId, table.moduleType),
}));

// Workspace Module Runs: Track individual executions of a module (for repeatable sessions)
export const workspaceModuleRuns = pgTable("workspace_module_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull().references(() => workspaceModules.id, { onDelete: "cascade" }),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  status: text("status").notNull().default("active"), // 'active', 'completed', 'archived'
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata"), // Run-specific data (participant count, completion stats, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Priority Matrices (2x2 Grid): Configuration for priority matrix module
export const priorityMatrices = pgTable("priority_matrices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  moduleRunId: varchar("module_run_id").references(() => workspaceModuleRuns.id, { onDelete: "cascade" }), // Optional: link to specific run
  xAxisLabel: text("x_axis_label").notNull().default("Impact"), // X-axis label (e.g., "Impact", "Difficulty")
  yAxisLabel: text("y_axis_label").notNull().default("Effort"), // Y-axis label (e.g., "Effort", "Cost")
  xMin: text("x_min").notNull().default("Low"), // Min label for X axis
  xMax: text("x_max").notNull().default("High"), // Max label for X axis
  yMin: text("y_min").notNull().default("Low"), // Min label for Y axis
  yMax: text("y_max").notNull().default("High"), // Max label for Y axis
  snapToGrid: boolean("snap_to_grid").notNull().default(false), // Whether to snap positions to grid
  gridSize: integer("grid_size").default(4), // Grid divisions (e.g., 4x4 grid)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Priority Matrix Positions: Track idea positions in 2x2 grid
export const priorityMatrixPositions = pgTable("priority_matrix_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matrixId: varchar("matrix_id").notNull().references(() => priorityMatrices.id, { onDelete: "cascade" }),
  ideaId: varchar("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  moduleRunId: varchar("module_run_id").references(() => workspaceModuleRuns.id, { onDelete: "cascade" }), // Optional: scope to run
  xCoord: real("x_coord").notNull(), // Normalized float (0.0 - 1.0)
  yCoord: real("y_coord").notNull(), // Normalized float (0.0 - 1.0)
  lockedBy: varchar("locked_by").references(() => participants.id), // For collaborative drag locking
  lockedAt: timestamp("locked_at"),
  participantId: varchar("participant_id").references(() => participants.id), // Who positioned this idea
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure one position per idea per matrix (or per module run if specified)
  uniqueMatrixIdea: unique().on(table.matrixId, table.ideaId, table.moduleRunId),
  // CHECK constraints for coordinate ranges (0.0 - 1.0)
  checkXCoord: sql`CHECK (x_coord >= 0 AND x_coord <= 1)`,
  checkYCoord: sql`CHECK (y_coord >= 0 AND y_coord <= 1)`,
}));

// Staircase Modules: Configuration for staircase rating module
export const staircaseModules = pgTable("staircase_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: varchar("space_id").notNull().references(() => spaces.id),
  moduleRunId: varchar("module_run_id").references(() => workspaceModuleRuns.id, { onDelete: "cascade" }),
  minScore: real("min_score").notNull().default(0), // Minimum score (e.g., 0)
  maxScore: real("max_score").notNull().default(10), // Maximum score (e.g., 10)
  stepCount: integer("step_count").notNull().default(11), // Number of steps (11 for 0-10 scale)
  allowDecimals: boolean("allow_decimals").notNull().default(false),
  minLabel: text("min_label").notNull().default("Lowest"),
  maxLabel: text("max_label").notNull().default("Highest"),
  showDistribution: boolean("show_distribution").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Staircase Positions: Track idea positions on the staircase
export const staircasePositions = pgTable("staircase_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staircaseId: varchar("staircase_id").notNull().references(() => staircaseModules.id, { onDelete: "cascade" }),
  ideaId: varchar("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  moduleRunId: varchar("module_run_id").references(() => workspaceModuleRuns.id, { onDelete: "cascade" }),
  participantId: varchar("participant_id").references(() => participants.id),
  score: real("score").notNull(), // Score value (e.g., 0.0 - 10.0)
  slotOffset: integer("slot_offset").default(0), // For handling multiple ideas at same score
  lockedBy: varchar("locked_by").references(() => participants.id),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure one position per idea per staircase (or per module run)
  uniqueStaircaseIdea: unique().on(table.staircaseId, table.ideaId, table.moduleRunId),
}));

// Insert schemas
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServicePlanSchema = createInsertSchema(servicePlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
// templateId is optional - if provided, workspace will be created from template
export const createSpaceApiSchema = insertSpaceSchema.extend({
  code: z.string().length(9).regex(/^\d{4}-\d{4}$/).optional(),
  templateId: z.string().optional(),
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

export const insertSurveyQuestionSchema = createInsertSchema(surveyQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertSurveyResponseSchema = createInsertSchema(surveyResponses).omit({
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

export const insertDocumentWorkspaceAccessSchema = createInsertSchema(documentWorkspaceAccess).omit({
  id: true,
  createdAt: true,
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

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIdeaContributionSchema = createInsertSchema(ideaContributions).omit({
  id: true,
  createdAt: true,
});

// Base insert schema
const baseInsertWorkspaceModuleSchema = createInsertSchema(workspaceModules, {
  config: z.any() // Will be overridden by discriminated union
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Create discriminated union for module types with their configs
// We need to create a proper tuple type for the discriminated union
const moduleInsertVariants = [
  z.object({
    moduleType: z.literal("ideation" as const),
    config: moduleConfigSchemas["ideation"]
  }),
  z.object({
    moduleType: z.literal("pairwise-voting" as const),
    config: moduleConfigSchemas["pairwise-voting"]
  }),
  z.object({
    moduleType: z.literal("stack-ranking" as const),
    config: moduleConfigSchemas["stack-ranking"]
  }),
  z.object({
    moduleType: z.literal("marketplace" as const),
    config: moduleConfigSchemas["marketplace"]
  }),
  z.object({
    moduleType: z.literal("priority-matrix" as const),
    config: moduleConfigSchemas["priority-matrix"]
  }),
  z.object({
    moduleType: z.literal("survey" as const),
    config: moduleConfigSchemas["survey"]
  }),
  z.object({
    moduleType: z.literal("staircase" as const),
    config: moduleConfigSchemas["staircase"]
  })
] as const;

// Final insert schema with discriminated union
export const insertWorkspaceModuleSchema = z.intersection(
  baseInsertWorkspaceModuleSchema.omit({ config: true, moduleType: true }),
  z.discriminatedUnion("moduleType", moduleInsertVariants)
);

export const insertWorkspaceModuleRunSchema = createInsertSchema(workspaceModuleRuns).omit({
  id: true,
  createdAt: true,
});

export const insertPriorityMatrixSchema = createInsertSchema(priorityMatrices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPriorityMatrixPositionSchema = createInsertSchema(priorityMatrixPositions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaircaseModuleSchema = createInsertSchema(staircaseModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaircasePositionSchema = createInsertSchema(staircasePositions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

export type ServicePlan = typeof servicePlans.$inferSelect;
export type InsertServicePlan = z.infer<typeof insertServicePlanSchema>;

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

export type SurveyQuestion = typeof surveyQuestions.$inferSelect;
export type InsertSurveyQuestion = z.infer<typeof insertSurveyQuestionSchema>;

export type SurveyResponse = typeof surveyResponses.$inferSelect;
export type InsertSurveyResponse = z.infer<typeof insertSurveyResponseSchema>;

export type CompanyAdmin = typeof companyAdmins.$inferSelect;
export type InsertCompanyAdmin = z.infer<typeof insertCompanyAdminSchema>;

export type SpaceFacilitator = typeof spaceFacilitators.$inferSelect;
export type InsertSpaceFacilitator = z.infer<typeof insertSpaceFacilitatorSchema>;

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = z.infer<typeof insertAccessRequestSchema>;

export type KnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferSelect;
export type InsertKnowledgeBaseDocument = z.infer<typeof insertKnowledgeBaseDocumentSchema>;

export type DocumentWorkspaceAccess = typeof documentWorkspaceAccess.$inferSelect;
export type InsertDocumentWorkspaceAccess = z.infer<typeof insertDocumentWorkspaceAccessSchema>;

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

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;

export type IdeaContribution = typeof ideaContributions.$inferSelect;
export type InsertIdeaContribution = z.infer<typeof insertIdeaContributionSchema>;

export type WorkspaceModule = typeof workspaceModules.$inferSelect;
export type InsertWorkspaceModule = z.infer<typeof insertWorkspaceModuleSchema>;

export type WorkspaceModuleRun = typeof workspaceModuleRuns.$inferSelect;
export type InsertWorkspaceModuleRun = z.infer<typeof insertWorkspaceModuleRunSchema>;

export type PriorityMatrix = typeof priorityMatrices.$inferSelect;
export type InsertPriorityMatrix = z.infer<typeof insertPriorityMatrixSchema>;

export type PriorityMatrixPosition = typeof priorityMatrixPositions.$inferSelect;
export type InsertPriorityMatrixPosition = z.infer<typeof insertPriorityMatrixPositionSchema>;

export type StaircaseModule = typeof staircaseModules.$inferSelect;
export type InsertStaircaseModule = z.infer<typeof insertStaircaseModuleSchema>;

export type StaircasePosition = typeof staircasePositions.$inferSelect;
export type InsertStaircasePosition = z.infer<typeof insertStaircasePositionSchema>;
