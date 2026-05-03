import { db, pool } from "./db";
import {
  type Organization,
  type InsertOrganization,
  type Project,
  type InsertProject,
  type ProjectMember,
  type InsertProjectMember,
  type User,
  type InsertUser,
  type Space,
  type InsertSpace,
  type Participant,
  type InsertParticipant,
  type Category,
  type InsertCategory,
  type Note,
  type InsertNote,
  type Vote,
  type InsertVote,
  type Ranking,
  type InsertRanking,
  type MarketplaceAllocation,
  type InsertMarketplaceAllocation,
  type SurveyQuestion,
  type InsertSurveyQuestion,
  type SurveyResponse,
  type InsertSurveyResponse,
  type CompanyAdmin,
  type InsertCompanyAdmin,
  type SpaceFacilitator,
  type InsertSpaceFacilitator,
  type AccessRequest,
  type InsertAccessRequest,
  type EmailVerificationToken,
  type InsertEmailVerificationToken,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type KnowledgeBaseDocument,
  type InsertKnowledgeBaseDocument,
  type DocumentWorkspaceAccess,
  type InsertDocumentWorkspaceAccess,
  type KnowledgeBaseChunk,
  type InsertKnowledgeBaseChunk,
  type WorkspaceTemplate,
  type InsertWorkspaceTemplate,
  type WorkspaceTemplateNote,
  type InsertWorkspaceTemplateNote,
  type WorkspaceTemplateDocument,
  type InsertWorkspaceTemplateDocument,
  type AiUsageLog,
  type CohortResult,
  type InsertCohortResult,
  type PersonalizedResult,
  type InsertPersonalizedResult,
  type Idea,
  type InsertIdea,
  type IdeaContribution,
  type InsertIdeaContribution,
  type WorkspaceModule,
  type InsertWorkspaceModule,
  type WorkspaceModuleRun,
  type InsertWorkspaceModuleRun,
  type PriorityMatrix,
  type InsertPriorityMatrix,
  type PriorityMatrixPosition,
  type InsertPriorityMatrixPosition,
  type StaircaseModule,
  type InsertStaircaseModule,
  type StaircasePosition,
  type InsertStaircasePosition,
  type Notification,
  type InsertNotification,
  type ClientError,
  type InsertClientError,
  type SystemSetting,
  type InsertSystemSetting,
  type ServicePlan,
  type InsertServicePlan,
  organizations,
  projects,
  projectMembers,
  systemSettings,
  servicePlans,
  users,
  spaces,
  participants,
  categories,
  notes,
  votes,
  rankings,
  marketplaceAllocations,
  surveyQuestions,
  surveyResponses,
  companyAdmins,
  spaceFacilitators,
  accessRequests,
  emailVerificationTokens,
  passwordResetTokens,
  knowledgeBaseDocuments,
  knowledgeBaseChunks,
  documentWorkspaceAccess,
  workspaceTemplates,
  workspaceTemplateNotes,
  workspaceTemplateDocuments,
  aiUsageLog,
  cohortResults,
  personalizedResults,
  ideas,
  ideaContributions,
  workspaceModules,
  workspaceModuleRuns,
  priorityMatrices,
  priorityMatrixPositions,
  staircaseModules,
  staircasePositions,
  notifications,
  clientErrors,
  pulseActivityEvents,
} from "@shared/schema";
import { eq, and, desc, or, isNull, gte, lte, sql, inArray } from "drizzle-orm";

/**
 * Normalize email addresses for consistent storage and lookup.
 * Converts to lowercase and trims whitespace.
 * Preserves undefined (returns undefined if input is undefined).
 * Converts null and empty strings to null.
 */
export function normalizeEmail(email: string | null | undefined): string | null | undefined {
  if (email === undefined) return undefined;
  if (email === null || email.trim() === '') return null;
  return email.toLowerCase().trim();
}

/**
 * Result row returned by full-text search over the knowledge base. The
 * `searchVector` column from `knowledge_base_chunks` is intentionally not
 * exposed here because it isn't needed by callers and is a Postgres-internal
 * representation of the indexed text.
 */
export interface KnowledgeBaseSearchHit {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  createdAt: Date;
  documentTitle: string;
  rank: number;
  snippet: string;
}

export interface IStorage {
  // System Settings
  getSystemSetting(key: string, organizationId?: string | null): Promise<SystemSetting | undefined>;
  setSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  getAllSystemSettings(organizationId?: string | null): Promise<SystemSetting[]>;

  // Service Plans
  getServicePlan(id: string): Promise<ServicePlan | undefined>;
  getServicePlanByName(name: string): Promise<ServicePlan | undefined>;
  getAllServicePlans(): Promise<ServicePlan[]>;
  getActiveServicePlans(): Promise<ServicePlan[]>;
  createServicePlan(plan: InsertServicePlan): Promise<ServicePlan>;
  updateServicePlan(id: string, plan: Partial<InsertServicePlan>): Promise<ServicePlan | undefined>;
  
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationsByIds(ids: string[]): Promise<Organization[]>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  getOrganizationByDomain(domain: string): Promise<Organization | undefined>;
  getOrganizationByEntraTenantId(entraTenantId: string): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjectsByIds(ids: string[]): Promise<Project[]>;
  getProjectBySlug(organizationId: string, slug: string): Promise<Project | undefined>;
  getProjectsByOrganization(organizationId: string): Promise<Project[]>;
  getProjectsByOrganizations(organizationIds: string[]): Promise<Project[]>;
  getDefaultProject(organizationId: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Project Members
  getProjectMembers(projectId: string): Promise<(ProjectMember & { user: User })[]>;
  getProjectMembersByUser(userId: string): Promise<(ProjectMember & { project: Project })[]>;
  isProjectMember(projectId: string, userId: string): Promise<boolean>;
  addProjectMember(projectId: string, userId: string, role?: string): Promise<ProjectMember>;
  removeProjectMember(projectId: string, userId: string): Promise<boolean>;
  updateProjectMemberRole(projectId: string, userId: string, role: string): Promise<ProjectMember | undefined>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEntraId(entraId: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByOrganization(organizationId: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Spaces
  getSpace(id: string): Promise<Space | undefined>;
  getSpaceByCode(code: string): Promise<Space | undefined>;
  getAllSpaces(): Promise<Space[]>;
  getSpacesByOrganization(organizationId: string): Promise<Space[]>;
  getSpacesByOrganizations(organizationIds: string[]): Promise<Space[]>;
  getSpacesByIds(ids: string[]): Promise<Space[]>;
  getSpacesByProject(projectId: string): Promise<Space[]>;
  getSpacesByProjects(projectIds: string[]): Promise<Space[]>;
  getNoteCountsBySpaces(spaceIds: string[]): Promise<Map<string, number>>;
  getParticipantCountsBySpaces(spaceIds: string[]): Promise<Map<string, number>>;
  createSpace(space: InsertSpace): Promise<Space>;
  updateSpace(id: string, space: Partial<InsertSpace>): Promise<Space | undefined>;
  deleteSpace(id: string): Promise<boolean>;
  getSpaceDependencies(id: string): Promise<{
    notesCount: number;
    votesCount: number;
    rankingsCount: number;
    marketplaceAllocationsCount: number;
    participantsCount: number;
    accessRequestsCount: number;
  }>;
  
  // Template Management (snapshot-based system using isTemplate flag)
  getAllTemplates(): Promise<Space[]>; // Get all templates (for global admins)
  getTemplates(organizationId?: string): Promise<Space[]>; // Get system + org templates
  createTemplateSnapshot(sourceWorkspaceId: string, templateScope: 'system' | 'organization'): Promise<Space>;
  markWorkspaceAsTemplate(id: string, templateScope: 'system' | 'organization'): Promise<Space | undefined>;
  unmarkWorkspaceAsTemplate(id: string): Promise<Space | undefined>;
  cloneWorkspaceFromTemplate(templateId: string, newWorkspaceData: Partial<InsertSpace>): Promise<Space>;

  // Company Admins (association)
  getCompanyAdminsByOrganization(organizationId: string): Promise<CompanyAdmin[]>;
  getCompanyAdminsByUser(userId: string): Promise<CompanyAdmin[]>;
  createCompanyAdmin(companyAdmin: InsertCompanyAdmin): Promise<CompanyAdmin>;
  deleteCompanyAdmin(id: string): Promise<boolean>;

  // Space Facilitators (association)
  getSpaceFacilitator(id: string): Promise<SpaceFacilitator | undefined>;
  getSpaceFacilitatorsBySpace(spaceId: string): Promise<SpaceFacilitator[]>;
  getSpaceFacilitatorsByUser(userId: string): Promise<SpaceFacilitator[]>;
  createSpaceFacilitator(spaceFacilitator: InsertSpaceFacilitator): Promise<SpaceFacilitator>;
  deleteSpaceFacilitator(id: string): Promise<boolean>;

  // Participants
  getParticipant(id: string): Promise<Participant | undefined>;
  getParticipantsBySpace(spaceId: string): Promise<Participant[]>;
  getParticipantBySpaceAndEmail(spaceId: string, email: string): Promise<Participant | undefined>;
  getParticipantBySpaceAndUserId(spaceId: string, userId: string): Promise<Participant | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  getOrCreateParticipantByUserId(spaceId: string, userId: string, defaults: Omit<InsertParticipant, "spaceId" | "userId">): Promise<Participant>;
  updateParticipant(id: string, participant: Partial<InsertParticipant>): Promise<Participant | undefined>;
  deleteParticipant(id: string): Promise<boolean>;
  findOrphanedParticipantsByEmail(email: string): Promise<Participant[]>;
  linkParticipantToUser(participantId: string, userId: string): Promise<Participant | undefined>;

  // Pulse heatmap activity log (append-only event source for the
  // per-minute participation heatmap on the Pulse tab).
  recordPulseActivity(spaceId: string, moduleType: string, participantId?: string | null, occurredAt?: Date): Promise<void>;
  getPulseActivityBuckets(spaceId: string): Promise<Array<{ t: number; counts: Record<string, number> }>>;

  // Notes
  getNote(id: string): Promise<Note | undefined>;
  getNotesBySpace(spaceId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: string): Promise<boolean>;
  deleteNotes(ids: string[]): Promise<boolean>;

  // Pulse aggregates (cheap counts/distincts for the live dashboard)
  getPulseAggregates(
    spaceId: string,
    options?: { matrixId?: string | null; staircaseId?: string | null; recentSinceMs?: number },
  ): Promise<{
    noteCount: number;
    voteCount: number;
    distinctNoteParticipants: string[];
    distinctVoteParticipants: string[];
    distinctRankingParticipants: string[];
    distinctMarketplaceParticipants: string[];
    distinctSurveyParticipants: string[];
    distinctMatrixParticipants: string[];
    distinctStaircaseParticipants: string[];
    noteCountsByParticipant: Array<{ participantId: string; count: number }>;
    voteCountsByParticipant: Array<{ participantId: string; count: number }>;
    recentNoteTimestamps: number[];
  }>;

  // Categories
  getCategory(id: string): Promise<Category | undefined>;
  getCategoriesBySpace(spaceId: string): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  // Votes
  getVotesBySpace(spaceId: string): Promise<Vote[]>;
  getVotesByParticipant(participantId: string): Promise<Vote[]>;
  createVote(vote: InsertVote): Promise<Vote>;

  // Rankings
  getRankingsBySpace(spaceId: string): Promise<Ranking[]>;
  getRankingsByParticipant(participantId: string): Promise<Ranking[]>;
  createRanking(ranking: InsertRanking): Promise<Ranking>;
  deleteRankingsByParticipant(participantId: string, spaceId: string): Promise<boolean>;

  // Marketplace Allocations
  getMarketplaceAllocationsBySpace(spaceId: string): Promise<MarketplaceAllocation[]>;
  getMarketplaceAllocationsByParticipant(participantId: string): Promise<MarketplaceAllocation[]>;
  createMarketplaceAllocation(allocation: InsertMarketplaceAllocation): Promise<MarketplaceAllocation>;
  deleteMarketplaceAllocationsByParticipant(participantId: string, spaceId: string): Promise<boolean>;

  // Survey Questions
  getSurveyQuestion(id: string): Promise<SurveyQuestion | undefined>;
  getSurveyQuestionsBySpace(spaceId: string): Promise<SurveyQuestion[]>;
  createSurveyQuestion(question: InsertSurveyQuestion): Promise<SurveyQuestion>;
  updateSurveyQuestion(id: string, question: Partial<InsertSurveyQuestion>): Promise<SurveyQuestion | undefined>;
  deleteSurveyQuestion(id: string): Promise<boolean>;

  // Survey Responses
  getSurveyResponsesBySpace(spaceId: string): Promise<SurveyResponse[]>;
  getSurveyResponsesByParticipant(participantId: string, spaceId: string): Promise<SurveyResponse[]>;
  getSurveyResponsesByNote(noteId: string): Promise<SurveyResponse[]>;
  createSurveyResponse(response: InsertSurveyResponse): Promise<SurveyResponse>;
  updateSurveyResponse(id: string, response: Partial<InsertSurveyResponse>): Promise<SurveyResponse | undefined>;
  deleteSurveyResponsesByParticipant(participantId: string, spaceId: string): Promise<boolean>;

  // Access Requests
  getAccessRequest(id: string): Promise<AccessRequest | undefined>;
  getAccessRequestsBySpace(spaceId: string): Promise<AccessRequest[]>;
  getPendingAccessRequestsBySpace(spaceId: string): Promise<AccessRequest[]>;
  createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest>;
  updateAccessRequest(id: string, request: Partial<InsertAccessRequest>): Promise<AccessRequest | undefined>;
  checkExistingAccessRequest(spaceId: string, email: string): Promise<AccessRequest | undefined>;

  // Knowledge Base Documents
  getKnowledgeBaseDocument(id: string): Promise<KnowledgeBaseDocument | undefined>;
  getKnowledgeBaseDocumentsByScope(scope: string, scopeId?: string): Promise<KnowledgeBaseDocument[]>;
  getKnowledgeBaseDocumentsForSpace(spaceId: string, organizationId: string): Promise<KnowledgeBaseDocument[]>;
  createKnowledgeBaseDocument(document: InsertKnowledgeBaseDocument): Promise<KnowledgeBaseDocument>;
  updateKnowledgeBaseDocument(id: string, document: Partial<InsertKnowledgeBaseDocument>): Promise<KnowledgeBaseDocument | undefined>;
  deleteKnowledgeBaseDocument(id: string): Promise<boolean>;
  createDocumentWorkspaceAccess(access: InsertDocumentWorkspaceAccess): Promise<DocumentWorkspaceAccess>;
  getDocumentWorkspaceAccesses(documentId: string): Promise<DocumentWorkspaceAccess[]>;

  // Knowledge Base Chunks (full-text search)
  createKnowledgeBaseChunks(chunks: InsertKnowledgeBaseChunk[]): Promise<KnowledgeBaseChunk[]>;
  deleteKnowledgeBaseChunksByDocument(documentId: string): Promise<number>;
  getKnowledgeBaseChunksByDocument(documentId: string): Promise<KnowledgeBaseChunk[]>;
  searchKnowledgeBaseChunks(params: {
    query: string;
    spaceId?: string;
    organizationId?: string;
    includeSystem?: boolean;
    limit?: number;
  }): Promise<KnowledgeBaseSearchHit[]>;

  // Workspace Templates
  getWorkspaceTemplate(id: string): Promise<WorkspaceTemplate | undefined>;
  getWorkspaceTemplates(organizationId?: string): Promise<WorkspaceTemplate[]>;
  createWorkspaceTemplateFromSpace(spaceId: string, name: string, type: string, description: string | undefined, createdBy: string): Promise<WorkspaceTemplate>;
  deleteWorkspaceTemplate(id: string): Promise<boolean>;
  getWorkspaceTemplateNotes(templateId: string): Promise<WorkspaceTemplateNote[]>;
  getWorkspaceTemplateDocuments(templateId: string): Promise<WorkspaceTemplateDocument[]>;

  // AI Usage Logs
  getAiUsageLogs(filters: {
    organizationId?: string;
    spaceId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AiUsageLog[]>;

  // Email Verification Tokens
  createEmailVerificationToken(token: InsertEmailVerificationToken): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  deleteEmailVerificationToken(token: string): Promise<boolean>;
  deleteExpiredEmailVerificationTokens(): Promise<boolean>;

  // Password Reset Tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(token: string): Promise<boolean>;
  deletePasswordResetToken(token: string): Promise<boolean>;
  deleteExpiredPasswordResetTokens(): Promise<boolean>;

  // Cohort Results
  getCohortResult(id: string): Promise<CohortResult | undefined>;
  getCohortResultsBySpace(spaceId: string): Promise<CohortResult[]>;
  createCohortResult(result: InsertCohortResult): Promise<CohortResult>;
  updateCohortResult(id: string, result: Partial<InsertCohortResult>): Promise<CohortResult | undefined>;
  deleteCohortResult(id: string): Promise<boolean>;

  // Personalized Results
  getPersonalizedResult(id: string): Promise<PersonalizedResult | undefined>;
  getPersonalizedResultsBySpace(spaceId: string): Promise<PersonalizedResult[]>;
  getPersonalizedResultsByParticipant(participantId: string): Promise<PersonalizedResult[]>;
  createPersonalizedResult(result: InsertPersonalizedResult): Promise<PersonalizedResult>;
  updatePersonalizedResult(id: string, result: Partial<InsertPersonalizedResult>): Promise<PersonalizedResult | undefined>;
  deletePersonalizedResult(id: string): Promise<boolean>;

  // IDEAS-CENTRIC ARCHITECTURE

  // Ideas Management
  getIdea(id: string): Promise<Idea | undefined>;
  getIdeasBySpace(spaceId: string): Promise<Idea[]>;
  getIdeasByCategory(spaceId: string, categoryId: string): Promise<Idea[]>;
  createIdea(idea: InsertIdea): Promise<Idea>;
  updateIdea(id: string, idea: Partial<InsertIdea>): Promise<Idea | undefined>;
  deleteIdea(id: string): Promise<boolean>;
  bulkCreateIdeas(ideas: InsertIdea[]): Promise<Idea[]>;
  
  // Idea Contributions
  getIdeaContributions(ideaId: string): Promise<IdeaContribution[]>;
  createIdeaContribution(contribution: InsertIdeaContribution): Promise<IdeaContribution>;
  
  // Workspace Modules
  getWorkspaceModules(spaceId: string): Promise<WorkspaceModule[]>;
  getWorkspaceModule(id: string): Promise<WorkspaceModule | undefined>;
  createWorkspaceModule(module: InsertWorkspaceModule): Promise<WorkspaceModule>;
  updateWorkspaceModule(id: string, module: Partial<InsertWorkspaceModule>): Promise<WorkspaceModule | undefined>;
  deleteWorkspaceModule(id: string): Promise<boolean>;
  
  // Workspace Module Runs
  getActiveModuleRun(moduleId: string): Promise<WorkspaceModuleRun | undefined>;
  getModuleRuns(moduleId: string): Promise<WorkspaceModuleRun[]>;
  createModuleRun(run: InsertWorkspaceModuleRun): Promise<WorkspaceModuleRun>;
  completeModuleRun(id: string): Promise<WorkspaceModuleRun | undefined>;
  
  // Priority Matrices (2x2 Grid)
  getPriorityMatrix(spaceId: string): Promise<PriorityMatrix | undefined>;
  createPriorityMatrix(matrix: InsertPriorityMatrix): Promise<PriorityMatrix>;
  updatePriorityMatrix(id: string, matrix: Partial<InsertPriorityMatrix>): Promise<PriorityMatrix | undefined>;
  
  // Priority Matrix Positions
  getPriorityMatrixPositions(matrixId: string): Promise<PriorityMatrixPosition[]>;
  upsertPriorityMatrixPosition(position: InsertPriorityMatrixPosition): Promise<PriorityMatrixPosition>;
  lockPriorityMatrixPosition(id: string, participantId: string): Promise<boolean>;
  unlockPriorityMatrixPosition(id: string): Promise<boolean>;

  // Staircase Modules
  getStaircaseModule(spaceId: string): Promise<StaircaseModule | undefined>;
  createStaircaseModule(module: InsertStaircaseModule): Promise<StaircaseModule>;
  updateStaircaseModule(id: string, module: Partial<InsertStaircaseModule>): Promise<StaircaseModule | undefined>;
  
  // Staircase Positions
  getStaircasePositions(staircaseId: string): Promise<StaircasePosition[]>;
  upsertStaircasePosition(position: InsertStaircasePosition): Promise<StaircasePosition>;
  lockStaircasePosition(id: string, participantId: string): Promise<boolean>;
  unlockStaircasePosition(id: string): Promise<boolean>;

  // Notifications (in-app)
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationRead(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<number>;

  // Client errors (telemetry)
  createClientError(record: InsertClientError): Promise<ClientError>;
}

export class DbStorage implements IStorage {
  // System Settings
  async getSystemSetting(key: string, organizationId: string | null = null): Promise<SystemSetting | undefined> {
    const conditions = organizationId 
      ? and(eq(systemSettings.key, key), eq(systemSettings.organizationId, organizationId))
      : and(eq(systemSettings.key, key), isNull(systemSettings.organizationId));
    
    const [setting] = await db.select().from(systemSettings).where(conditions).limit(1);
    return setting;
  }

  async setSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    // Try to update existing setting, or insert if it doesn't exist
    const existing = await this.getSystemSetting(setting.key, setting.organizationId || null);
    
    if (existing) {
      const [updated] = await db.update(systemSettings)
        .set({
          value: setting.value,
          description: setting.description,
          updatedBy: setting.updatedBy,
          updatedAt: new Date()
        })
        .where(eq(systemSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(systemSettings).values(setting).returning();
      return created;
    }
  }

  async getAllSystemSettings(organizationId: string | null = null): Promise<SystemSetting[]> {
    const condition = organizationId 
      ? eq(systemSettings.organizationId, organizationId)
      : isNull(systemSettings.organizationId);
    
    return db.select().from(systemSettings).where(condition);
  }

  // Service Plans
  async getServicePlan(id: string): Promise<ServicePlan | undefined> {
    const [plan] = await db.select().from(servicePlans).where(eq(servicePlans.id, id)).limit(1);
    return plan;
  }

  async getServicePlanByName(name: string): Promise<ServicePlan | undefined> {
    const [plan] = await db.select().from(servicePlans).where(eq(servicePlans.name, name.toLowerCase())).limit(1);
    return plan;
  }

  async getAllServicePlans(): Promise<ServicePlan[]> {
    return db.select().from(servicePlans).orderBy(servicePlans.sortOrder);
  }

  async getActiveServicePlans(): Promise<ServicePlan[]> {
    return db.select().from(servicePlans)
      .where(eq(servicePlans.isActive, true))
      .orderBy(servicePlans.sortOrder);
  }

  async createServicePlan(plan: InsertServicePlan): Promise<ServicePlan> {
    const [created] = await db.insert(servicePlans).values({
      ...plan,
      name: plan.name.toLowerCase(),
    }).returning();
    return created;
  }

  async updateServicePlan(id: string, plan: Partial<InsertServicePlan>): Promise<ServicePlan | undefined> {
    const updateData = plan.name ? { ...plan, name: plan.name.toLowerCase() } : plan;
    const [updated] = await db.update(servicePlans)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(servicePlans.id, id))
      .returning();
    return updated;
  }

  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return org;
  }

  async getOrganizationsByIds(ids: string[]): Promise<Organization[]> {
    if (ids.length === 0) return [];
    return db.select().from(organizations).where(inArray(organizations.id, ids));
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    return org;
  }

  async getOrganizationByDomain(domain: string): Promise<Organization | undefined> {
    const normalizedDomain = domain.toLowerCase().trim();
    // Check primary domain first
    const [orgByPrimary] = await db.select().from(organizations)
      .where(eq(organizations.domain, normalizedDomain))
      .limit(1);
    if (orgByPrimary) return orgByPrimary;
    
    // Check allowed domains array
    const allOrgs = await db.select().from(organizations);
    return allOrgs.find(org => 
      org.allowedDomains?.includes(normalizedDomain)
    );
  }

  async getOrganizationByEntraTenantId(entraTenantId: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations)
      .where(eq(organizations.entraTenantId, entraTenantId))
      .limit(1);
    return org;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations).orderBy(organizations.name);
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await db.update(organizations).set(org).where(eq(organizations.id, id)).returning();
    return updated;
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return project;
  }

  async getProjectBySlug(organizationId: string, slug: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.organizationId, organizationId), eq(projects.slug, slug)))
      .limit(1);
    return project;
  }

  async getProjectsByOrganization(organizationId: string): Promise<Project[]> {
    return db.select().from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(projects.name);
  }

  async getProjectsByIds(ids: string[]): Promise<Project[]> {
    if (ids.length === 0) return [];
    return db.select().from(projects).where(inArray(projects.id, ids));
  }

  async getProjectsByOrganizations(organizationIds: string[]): Promise<Project[]> {
    if (organizationIds.length === 0) return [];
    return db.select().from(projects)
      .where(inArray(projects.organizationId, organizationIds))
      .orderBy(projects.name);
  }

  async getDefaultProject(organizationId: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects)
      .where(and(eq(projects.organizationId, organizationId), eq(projects.isDefault, true)))
      .limit(1);
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // Project Members
  async getProjectMembers(projectId: string): Promise<(ProjectMember & { user: User })[]> {
    const rows = await db.select({
      projectMember: projectMembers,
      user: users,
    })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(users.displayName);
    
    return rows.map(row => ({
      ...row.projectMember,
      user: row.user,
    }));
  }

  async getProjectMembersByUser(userId: string): Promise<(ProjectMember & { project: Project })[]> {
    const rows = await db.select({
      projectMember: projectMembers,
      project: projects,
    })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId))
      .orderBy(projects.name);
    
    return rows.map(row => ({
      ...row.projectMember,
      project: row.project,
    }));
  }

  async isProjectMember(projectId: string, userId: string): Promise<boolean> {
    const [member] = await db.select().from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .limit(1);
    return !!member;
  }

  async addProjectMember(projectId: string, userId: string, role: string = "member"): Promise<ProjectMember> {
    const [created] = await db.insert(projectMembers)
      .values({ projectId, userId, role })
      .onConflictDoNothing()
      .returning();
    
    if (!created) {
      const [existing] = await db.select().from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
        .limit(1);
      return existing;
    }
    return created;
  }

  async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
    const result = await db.delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async updateProjectMemberRole(projectId: string, userId: string, role: string): Promise<ProjectMember | undefined> {
    const [updated] = await db.update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .returning();
    return updated;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = normalizeEmail(email);
    if (!normalized) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async getUserByEntraId(entraId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.entraId, entraId)).limit(1);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.organizationId, organizationId)).orderBy(desc(users.createdAt));
  }

  async createUser(user: InsertUser): Promise<User> {
    const normalizedUser = {
      ...user,
      email: normalizeEmail(user.email) || user.email,
    };
    const [created] = await db.insert(users).values(normalizedUser).returning();
    return created;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const normalizedUser = user.email 
      ? { ...user, email: normalizeEmail(user.email) || user.email }
      : user;
    const [updated] = await db.update(users).set(normalizedUser).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Spaces
  async getSpace(id: string): Promise<Space | undefined> {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, id)).limit(1);
    return space;
  }

  async getSpaceByCode(code: string): Promise<Space | undefined> {
    const [space] = await db.select().from(spaces).where(eq(spaces.code, code)).limit(1);
    return space;
  }

  async getAllSpaces(): Promise<Space[]> {
    return db.select().from(spaces).orderBy(desc(spaces.createdAt));
  }

  async getSpacesByOrganization(organizationId: string): Promise<Space[]> {
    // Exclude templates from workspace listings (templates appear in Templates tab only)
    return db.select().from(spaces).where(
      and(
        eq(spaces.organizationId, organizationId),
        eq(spaces.isTemplate, false)
      )
    ).orderBy(desc(spaces.createdAt));
  }

  async getSpacesByProject(projectId: string): Promise<Space[]> {
    return db.select().from(spaces).where(
      and(
        eq(spaces.projectId, projectId),
        eq(spaces.isTemplate, false)
      )
    ).orderBy(desc(spaces.createdAt));
  }

  async getSpacesByOrganizations(organizationIds: string[]): Promise<Space[]> {
    if (organizationIds.length === 0) return [];
    return db.select().from(spaces).where(
      and(
        inArray(spaces.organizationId, organizationIds),
        eq(spaces.isTemplate, false)
      )
    ).orderBy(desc(spaces.createdAt));
  }

  async getSpacesByIds(ids: string[]): Promise<Space[]> {
    if (ids.length === 0) return [];
    return db.select().from(spaces).where(inArray(spaces.id, ids)).orderBy(desc(spaces.createdAt));
  }

  async getSpacesByProjects(projectIds: string[]): Promise<Space[]> {
    if (projectIds.length === 0) return [];
    return db.select().from(spaces).where(
      and(
        inArray(spaces.projectId, projectIds),
        eq(spaces.isTemplate, false)
      )
    ).orderBy(desc(spaces.createdAt));
  }

  async getNoteCountsBySpaces(spaceIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (spaceIds.length === 0) return result;
    const rows = await db
      .select({ spaceId: notes.spaceId, count: sql<number>`count(*)::int` })
      .from(notes)
      .where(inArray(notes.spaceId, spaceIds))
      .groupBy(notes.spaceId);
    for (const row of rows) {
      result.set(row.spaceId, Number(row.count) || 0);
    }
    return result;
  }

  async getParticipantCountsBySpaces(spaceIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (spaceIds.length === 0) return result;
    const rows = await db
      .select({ spaceId: participants.spaceId, count: sql<number>`count(*)::int` })
      .from(participants)
      .where(inArray(participants.spaceId, spaceIds))
      .groupBy(participants.spaceId);
    for (const row of rows) {
      result.set(row.spaceId, Number(row.count) || 0);
    }
    return result;
  }

  async createSpace(space: InsertSpace): Promise<Space> {
    const [created] = await db.insert(spaces).values(space).returning();
    return created;
  }

  async updateSpace(id: string, space: Partial<InsertSpace>): Promise<Space | undefined> {
    const [updated] = await db.update(spaces).set({ ...space, updatedAt: new Date() }).where(eq(spaces.id, id)).returning();
    return updated;
  }

  async deleteSpace(id: string): Promise<boolean> {
    // Helper to safely delete from a table (ignores "table does not exist" errors for production compatibility)
    const safeDelete = async (deletePromise: Promise<any>) => {
      try {
        await deletePromise;
      } catch (error: any) {
        // Ignore "relation does not exist" errors - table may not exist in production
        // Check both error code (42P01) and message pattern for robustness
        const isRelationNotExist = 
          error.code === '42P01' || 
          (error.message && error.message.includes('relation') && error.message.includes('does not exist'));
        if (!isRelationNotExist) {
          throw error;
        }
        // Log for debugging but don't fail
        console.log(`Skipping delete for missing table: ${error.message || error.code}`);
      }
    };
    
    // Delete all associated data first to avoid foreign key constraints
    // Note: Some child tables (staircase_positions, priority_matrix_positions, idea_contributions)
    // use onDelete: "cascade" and will be automatically deleted when parent records are removed
    
    // Phase 1: Delete records that reference other workspace data
    await Promise.all([
      safeDelete(db.delete(surveyResponses).where(eq(surveyResponses.spaceId, id))),
      safeDelete(db.delete(documentWorkspaceAccess).where(eq(documentWorkspaceAccess.spaceId, id))),
    ]);
    
    // Phase 2: Delete parent records
    await Promise.all([
      safeDelete(db.delete(staircaseModules).where(eq(staircaseModules.spaceId, id))),
      safeDelete(db.delete(priorityMatrices).where(eq(priorityMatrices.spaceId, id))),
      safeDelete(db.delete(ideas).where(eq(ideas.spaceId, id))),
      safeDelete(db.delete(surveyQuestions).where(eq(surveyQuestions.spaceId, id))),
      safeDelete(db.delete(workspaceModuleRuns).where(eq(workspaceModuleRuns.spaceId, id))),
      safeDelete(db.delete(workspaceModules).where(eq(workspaceModules.spaceId, id))),
      safeDelete(db.delete(notes).where(eq(notes.spaceId, id))),
      safeDelete(db.delete(votes).where(eq(votes.spaceId, id))),
      safeDelete(db.delete(rankings).where(eq(rankings.spaceId, id))),
      safeDelete(db.delete(marketplaceAllocations).where(eq(marketplaceAllocations.spaceId, id))),
      safeDelete(db.delete(participants).where(eq(participants.spaceId, id))),
      safeDelete(db.delete(accessRequests).where(eq(accessRequests.spaceId, id))),
      safeDelete(db.delete(categories).where(eq(categories.spaceId, id))),
      safeDelete(db.delete(spaceFacilitators).where(eq(spaceFacilitators.spaceId, id))),
      safeDelete(db.delete(cohortResults).where(eq(cohortResults.spaceId, id))),
      safeDelete(db.delete(personalizedResults).where(eq(personalizedResults.spaceId, id))),
      safeDelete(db.delete(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.spaceId, id))),
      safeDelete(db.delete(aiUsageLog).where(eq(aiUsageLog.spaceId, id))),
    ]);

    // Finally, delete the workspace itself
    const result = await db.delete(spaces).where(eq(spaces.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getSpaceDependencies(id: string): Promise<{
    notesCount: number;
    votesCount: number;
    rankingsCount: number;
    marketplaceAllocationsCount: number;
    participantsCount: number;
    accessRequestsCount: number;
  }> {
    const [notesResult, votesResult, rankingsResult, marketplaceResult, participantsResult, accessRequestsResult] = await Promise.all([
      db.select().from(notes).where(eq(notes.spaceId, id)),
      db.select().from(votes).where(eq(votes.spaceId, id)),
      db.select().from(rankings).where(eq(rankings.spaceId, id)),
      db.select().from(marketplaceAllocations).where(eq(marketplaceAllocations.spaceId, id)),
      db.select().from(participants).where(eq(participants.spaceId, id)),
      db.select().from(accessRequests).where(eq(accessRequests.spaceId, id)),
    ]);

    return {
      notesCount: notesResult.length,
      votesCount: votesResult.length,
      rankingsCount: rankingsResult.length,
      marketplaceAllocationsCount: marketplaceResult.length,
      participantsCount: participantsResult.length,
      accessRequestsCount: accessRequestsResult.length,
    };
  }

  // Template Management (simplified system using isTemplate flag)
  async getAllTemplates(): Promise<Space[]> {
    // Get ALL templates (system + organization) - for global admins only
    return db.select().from(spaces).where(
      eq(spaces.isTemplate, true)
    ).orderBy(desc(spaces.createdAt));
  }

  async getTemplates(organizationId?: string): Promise<Space[]> {
    // Get system templates (isTemplate=true, templateScope='system') + org templates if specified
    if (organizationId) {
      return db.select().from(spaces).where(
        and(
          eq(spaces.isTemplate, true),
          or(
            eq(spaces.templateScope, 'system'),
            and(
              eq(spaces.templateScope, 'organization'),
              eq(spaces.organizationId, organizationId)
            )
          )
        )
      ).orderBy(desc(spaces.createdAt));
    }
    // Get only system templates (when no organizationId provided)
    return db.select().from(spaces).where(
      and(
        eq(spaces.isTemplate, true),
        eq(spaces.templateScope, 'system')
      )
    ).orderBy(desc(spaces.createdAt));
  }

  async markWorkspaceAsTemplate(id: string, templateScope: 'system' | 'organization'): Promise<Space | undefined> {
    const [updated] = await db.update(spaces).set({
      isTemplate: true,
      templateScope,
      status: 'archived', // Archive templates so they don't show up in normal workspace lists
      hidden: true,
      updatedAt: new Date()
    }).where(eq(spaces.id, id)).returning();
    return updated;
  }

  async unmarkWorkspaceAsTemplate(id: string): Promise<Space | undefined> {
    const [updated] = await db.update(spaces).set({
      isTemplate: false,
      templateScope: null,
      updatedAt: new Date()
    }).where(eq(spaces.id, id)).returning();
    return updated;
  }

  async createTemplateSnapshot(sourceWorkspaceId: string, templateScope: 'system' | 'organization'): Promise<Space> {
    // Get the source workspace
    const sourceWorkspace = await this.getSpace(sourceWorkspaceId);
    if (!sourceWorkspace) {
      throw new Error("Source workspace not found");
    }

    // Create timestamp for unique template name
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
    
    // Create a frozen snapshot workspace as the template
    const templateSnapshot = await this.createSpace({
      organizationId: sourceWorkspace.organizationId,
      name: `${sourceWorkspace.name} (Template - ${timestamp})`,
      purpose: sourceWorkspace.purpose || `Template snapshot created from "${sourceWorkspace.name}"`,
      icon: sourceWorkspace.icon,
      sessionMode: sourceWorkspace.sessionMode,
      pairwiseScope: sourceWorkspace.pairwiseScope,
      marketplaceCoinBudget: sourceWorkspace.marketplaceCoinBudget,
      guestAllowed: sourceWorkspace.guestAllowed,
      hidden: true, // Hide templates from normal workspace lists
      status: 'archived', // Archive templates
      isTemplate: true,
      templateScope,
    } as InsertSpace);

    // Create a "Template" participant for attribution
    const templateParticipant = await this.createParticipant({
      spaceId: templateSnapshot.id,
      displayName: "Template",
      isGuest: true,
    });

    // Clone categories from source workspace FIRST (to map IDs for notes)
    const sourceCategories = await this.getCategoriesBySpace(sourceWorkspaceId);
    const categoryIdMap = new Map<string, string>(); // old ID -> new ID
    
    for (const category of sourceCategories) {
      const newCategory = await this.createCategory({
        spaceId: templateSnapshot.id,
        name: category.name,
        color: category.color,
      });
      categoryIdMap.set(category.id, newCategory.id);
    }

    // Clone notes from source workspace with mapped category IDs
    const sourceNotes = await this.getNotesBySpace(sourceWorkspaceId);
    for (const note of sourceNotes) {
      const newCategoryId = note.manualCategoryId ? categoryIdMap.get(note.manualCategoryId) : null;
      
      await this.createNote({
        spaceId: templateSnapshot.id,
        participantId: templateParticipant.id,
        content: note.content,
        manualCategoryId: newCategoryId || null, // Map to new category ID
        isManualOverride: note.isManualOverride,
      });
    }

    // Reference knowledge base documents from source workspace (don't copy)
    // Convert workspace-scoped documents to multi_workspace so they can be shared between template and source
    const sourceDocs = await db.select().from(knowledgeBaseDocuments).where(
      eq(knowledgeBaseDocuments.spaceId, sourceWorkspaceId)
    );
    
    for (const doc of sourceDocs) {
      // Convert workspace-scoped documents to multi_workspace
      if (doc.scope === 'workspace') {
        await db.update(knowledgeBaseDocuments)
          .set({ 
            scope: 'multi_workspace',
            spaceId: null, // multi_workspace docs don't have a single spaceId
            organizationId: sourceWorkspace.organizationId // Maintain organization scope
          })
          .where(eq(knowledgeBaseDocuments.id, doc.id));
        
        // Create access entry for the original source workspace
        await this.createDocumentWorkspaceAccess({
          documentId: doc.id,
          spaceId: sourceWorkspaceId,
        });
      }
      
      // Create access entry for the template snapshot to reference this document
      await this.createDocumentWorkspaceAccess({
        documentId: doc.id,
        spaceId: templateSnapshot.id,
      });
    }

    return templateSnapshot;
  }

  async cloneWorkspaceFromTemplate(templateId: string, newWorkspaceData: Partial<InsertSpace>): Promise<Space> {
    // Get the template workspace
    const template = await this.getSpace(templateId);
    if (!template || !template.isTemplate) {
      throw new Error("Template not found or workspace is not a template");
    }

    // Create new workspace with data from template + overrides
    const newSpace = await this.createSpace({
      ...newWorkspaceData,
      name: newWorkspaceData.name || template.name,
      purpose: newWorkspaceData.purpose || template.purpose,
      icon: template.icon,
      sessionMode: template.sessionMode,
      pairwiseScope: template.pairwiseScope,
      marketplaceCoinBudget: template.marketplaceCoinBudget,
      guestAllowed: newWorkspaceData.guestAllowed !== undefined ? newWorkspaceData.guestAllowed : template.guestAllowed,
      isTemplate: false, // Cloned workspace is NOT a template
      templateScope: null,
    } as InsertSpace);

    // Create a "Template" participant for attribution
    const templateParticipant = await this.createParticipant({
      spaceId: newSpace.id,
      displayName: "Template",
      isGuest: true,
    });

    // Clone categories from template FIRST (to map IDs for notes)
    const templateCategories = await this.getCategoriesBySpace(templateId);
    const categoryIdMap = new Map<string, string>(); // old ID -> new ID
    
    for (const category of templateCategories) {
      const newCategory = await this.createCategory({
        spaceId: newSpace.id,
        name: category.name,
        color: category.color,
      });
      categoryIdMap.set(category.id, newCategory.id);
    }

    // Clone notes from template with mapped category IDs
    const templateNotes = await this.getNotesBySpace(templateId);
    for (const note of templateNotes) {
      const newCategoryId = note.manualCategoryId ? categoryIdMap.get(note.manualCategoryId) : null;
      
      await this.createNote({
        spaceId: newSpace.id,
        participantId: templateParticipant.id,
        content: note.content,
        manualCategoryId: newCategoryId || null, // Map to new category ID
        isManualOverride: note.isManualOverride,
      });
    }

    // Reference knowledge base documents from template instead of copying
    // Get all documents associated with the template (workspace-scoped or multi_workspace)
    const templateDocs = await db.select().from(knowledgeBaseDocuments).where(
      eq(knowledgeBaseDocuments.spaceId, templateId)
    );
    
    for (const doc of templateDocs) {
      // Convert workspace-scoped documents to multi_workspace so they can be shared
      if (doc.scope === 'workspace') {
        await db.update(knowledgeBaseDocuments)
          .set({ 
            scope: 'multi_workspace',
            spaceId: null, // multi_workspace docs don't have a single spaceId
            organizationId: template.organizationId // Maintain organization scope
          })
          .where(eq(knowledgeBaseDocuments.id, doc.id));
        
        // Create access entry for the original template workspace
        await this.createDocumentWorkspaceAccess({
          documentId: doc.id,
          spaceId: templateId,
        });
      }
      
      // Create access entry for the new workspace to reference this document
      await this.createDocumentWorkspaceAccess({
        documentId: doc.id,
        spaceId: newSpace.id,
      });
    }

    return newSpace;
  }

  // Participants
  async getParticipant(id: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.id, id)).limit(1);
    return participant;
  }

  async getParticipantsBySpace(spaceId: string): Promise<Participant[]> {
    return db.select().from(participants).where(eq(participants.spaceId, spaceId));
  }

  async getParticipantBySpaceAndEmail(spaceId: string, email: string): Promise<Participant | undefined> {
    const normalized = normalizeEmail(email);
    if (!normalized) return undefined;
    const [participant] = await db.select().from(participants).where(
      and(
        eq(participants.spaceId, spaceId),
        eq(participants.email, normalized)
      )
    ).limit(1);
    return participant;
  }

  async getParticipantBySpaceAndUserId(spaceId: string, userId: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(
      and(
        eq(participants.spaceId, spaceId),
        eq(participants.userId, userId)
      )
    ).limit(1);
    return participant;
  }

  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    const normalizedParticipant = participant.email !== undefined
      ? { ...participant, email: normalizeEmail(participant.email) }
      : participant;
    const [created] = await db.insert(participants).values(normalizedParticipant).returning();
    return created;
  }

  async getOrCreateParticipantByUserId(
    spaceId: string,
    userId: string,
    defaults: Omit<InsertParticipant, "spaceId" | "userId">
  ): Promise<Participant> {
    const existing = await this.getParticipantBySpaceAndUserId(spaceId, userId);
    if (existing) return existing;
    try {
      return await this.createParticipant({ ...defaults, spaceId, userId } as InsertParticipant);
    } catch (err: any) {
      // Handle unique-violation race (Postgres error code 23505) — another
      // concurrent request created the row first. Re-fetch the winner.
      if (err?.code === "23505") {
        const winner = await this.getParticipantBySpaceAndUserId(spaceId, userId);
        if (winner) return winner;
      }
      throw err;
    }
  }

  async updateParticipant(id: string, participant: Partial<InsertParticipant>): Promise<Participant | undefined> {
    const normalizedParticipant = participant.email !== undefined
      ? { ...participant, email: normalizeEmail(participant.email) }
      : participant;
    const [updated] = await db.update(participants).set(normalizedParticipant).where(eq(participants.id, id)).returning();
    return updated;
  }

  async deleteParticipant(id: string): Promise<boolean> {
    const result = await db.delete(participants).where(eq(participants.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async findOrphanedParticipantsByEmail(email: string): Promise<Participant[]> {
    const normalized = normalizeEmail(email);
    if (!normalized) return [];
    // Find guest participants without userId that match the email
    return db.select().from(participants).where(
      and(
        eq(participants.email, normalized),
        eq(participants.userId, null as any)
      )
    );
  }

  async linkParticipantToUser(participantId: string, userId: string): Promise<Participant | undefined> {
    // The partial unique index on participants(space_id, user_id) WHERE
    // user_id IS NOT NULL means linking can fail if another participant
    // row in the same space already references this user (e.g. a
    // facilitator participant was auto-created earlier). In that case,
    // merge the orphan row into the pre-existing one: repoint FKs and
    // delete the orphan, returning the surviving participant. We do this
    // in a transaction so a partial failure can't leave dangling refs.
    const [orphan] = await db.select().from(participants).where(eq(participants.id, participantId)).limit(1);
    if (!orphan) return undefined;

    const [existing] = await db.select().from(participants).where(
      and(
        eq(participants.spaceId, orphan.spaceId),
        eq(participants.userId, userId),
      )
    ).limit(1);

    if (existing && existing.id !== participantId) {
      // Merge: repoint every FK from orphan to existing, then delete orphan.
      // Use a single client transaction so a partial failure can't leave
      // dangling references.
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const loser = participantId;
        const keeper = existing.id;
        await client.query("UPDATE idea_contributions SET participant_id = $1 WHERE participant_id = $2", [keeper, loser]);
        await client.query("UPDATE ideas SET created_by_participant_id = $1 WHERE created_by_participant_id = $2", [keeper, loser]);
        await client.query("UPDATE marketplace_allocations SET participant_id = $1 WHERE participant_id = $2", [keeper, loser]);
        await client.query("UPDATE notes SET participant_id = $1 WHERE participant_id = $2", [keeper, loser]);
        await client.query("UPDATE personalized_results SET participant_id = $1 WHERE participant_id = $2", [keeper, loser]);
        await client.query("UPDATE priority_matrix_positions SET participant_id = $1 WHERE participant_id = $2", [keeper, loser]);
        await client.query("UPDATE priority_matrix_positions SET locked_by = $1 WHERE locked_by = $2", [keeper, loser]);
        await client.query("UPDATE rankings SET participant_id = $1 WHERE participant_id = $2", [keeper, loser]);
        await client.query("UPDATE staircase_positions SET participant_id = $1 WHERE participant_id = $2", [keeper, loser]);
        await client.query("UPDATE staircase_positions SET locked_by = $1 WHERE locked_by = $2", [keeper, loser]);
        await client.query("UPDATE survey_responses SET participant_id = $1 WHERE participant_id = $2", [keeper, loser]);
        await client.query("UPDATE votes SET participant_id = $1 WHERE participant_id = $2", [keeper, loser]);
        await client.query("DELETE FROM participants WHERE id = $1", [loser]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
      return existing;
    }

    try {
      const [updated] = await db.update(participants)
        .set({ userId, isGuest: false })
        .where(eq(participants.id, participantId))
        .returning();
      return updated;
    } catch (err: any) {
      // Narrow race: another request created the (space, user) participant
      // between our pre-check and this UPDATE, so the partial unique index
      // rejects the link. Recurse once to take the merge path.
      if (err?.code === "23505") {
        return this.linkParticipantToUser(participantId, userId);
      }
      throw err;
    }
  }

  // Pulse heatmap activity log
  async recordPulseActivity(
    spaceId: string,
    moduleType: string,
    participantId?: string | null,
    occurredAt?: Date,
  ): Promise<void> {
    try {
      await db.insert(pulseActivityEvents).values({
        spaceId,
        moduleType,
        participantId: participantId ?? null,
        ...(occurredAt ? { occurredAt } : {}),
      });
    } catch (error) {
      // Pulse logging is best-effort: never let a missing/dropped row fail
      // the underlying participant action.
      console.warn("[pulse] failed to record activity:", error);
    }
  }

  async getPulseActivityBuckets(
    spaceId: string,
  ): Promise<Array<{ t: number; counts: Record<string, number> }>> {
    // Aggregate in SQL: bucket occurredAt to the minute and count per
    // (minute, moduleType). This keeps payloads bounded even for sessions
    // with thousands of events. If the table is temporarily absent (e.g.
    // mid-rollout before startup migrations have run), we fail soft with
    // an empty series so the rest of the Pulse tab keeps working.
    let rows: Array<{ bucket: Date; moduleType: string; count: number }> = [];
    try {
      rows = await db
        .select({
          bucket: sql<Date>`date_trunc('minute', ${pulseActivityEvents.occurredAt})`.as("bucket"),
          moduleType: pulseActivityEvents.moduleType,
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(pulseActivityEvents)
        .where(eq(pulseActivityEvents.spaceId, spaceId))
        .groupBy(
          sql`date_trunc('minute', ${pulseActivityEvents.occurredAt})`,
          pulseActivityEvents.moduleType,
        );
    } catch (error) {
      console.warn("[pulse] getPulseActivityBuckets failed, returning empty:", error);
      return [];
    }
    const buckets = new Map<number, Record<string, number>>();
    for (const r of rows) {
      const t = r.bucket instanceof Date ? r.bucket.getTime() : new Date(String(r.bucket)).getTime();
      if (!Number.isFinite(t)) continue;
      let entry = buckets.get(t);
      if (!entry) {
        entry = {};
        buckets.set(t, entry);
      }
      entry[r.moduleType] = Number(r.count) || 0;
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, counts]) => ({ t, counts }));
  }

  // Notes
  async getNote(id: string): Promise<Note | undefined> {
    const [note] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
    return note;
  }

  async getNotesBySpace(spaceId: string): Promise<Note[]> {
    return db.select().from(notes).where(eq(notes.spaceId, spaceId)).orderBy(desc(notes.createdAt));
  }

  async createNote(note: InsertNote): Promise<Note> {
    const [created] = await db.insert(notes).values(note).returning();
    return created;
  }

  async updateNote(id: string, note: Partial<InsertNote>): Promise<Note | undefined> {
    const [updated] = await db.update(notes).set(note).where(eq(notes.id, id)).returning();
    return updated;
  }

  async deleteNote(id: string): Promise<boolean> {
    const result = await db.delete(notes).where(eq(notes.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deleteNotes(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return false;
    const result = await db.delete(notes).where(
      ids.map(id => eq(notes.id, id)).reduce((a, b) => and(a, b) as any)
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getPulseAggregates(
    spaceId: string,
    options?: { matrixId?: string | null; staircaseId?: string | null; recentSinceMs?: number },
  ): Promise<{
    noteCount: number;
    voteCount: number;
    distinctNoteParticipants: string[];
    distinctVoteParticipants: string[];
    distinctRankingParticipants: string[];
    distinctMarketplaceParticipants: string[];
    distinctSurveyParticipants: string[];
    distinctMatrixParticipants: string[];
    distinctStaircaseParticipants: string[];
    noteCountsByParticipant: Array<{ participantId: string; count: number }>;
    voteCountsByParticipant: Array<{ participantId: string; count: number }>;
    recentNoteTimestamps: number[];
  }> {
    const matrixId = options?.matrixId ?? null;
    const staircaseId = options?.staircaseId ?? null;
    const recentSinceMs = options?.recentSinceMs ?? 10 * 60 * 1000;
    const cutoff = new Date(Date.now() - recentSinceMs);

    const dedupe = (rows: Array<{ participantId: string | null }>): string[] => {
      const out: string[] = [];
      for (const r of rows) if (r.participantId) out.push(r.participantId);
      return out;
    };

    const [
      noteCountRow,
      voteCountRow,
      distinctNoteRows,
      distinctVoteRows,
      distinctRankingRows,
      distinctMarketplaceRows,
      distinctSurveyRows,
      distinctMatrixRows,
      distinctStaircaseRows,
      noteCountsByParticipantRows,
      voteCountsByParticipantRows,
      recentNoteRows,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .where(eq(notes.spaceId, spaceId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(votes)
        .where(eq(votes.spaceId, spaceId)),
      db
        .selectDistinct({ participantId: notes.participantId })
        .from(notes)
        .where(eq(notes.spaceId, spaceId)),
      db
        .selectDistinct({ participantId: votes.participantId })
        .from(votes)
        .where(eq(votes.spaceId, spaceId)),
      db
        .selectDistinct({ participantId: rankings.participantId })
        .from(rankings)
        .where(eq(rankings.spaceId, spaceId)),
      db
        .selectDistinct({ participantId: marketplaceAllocations.participantId })
        .from(marketplaceAllocations)
        .where(eq(marketplaceAllocations.spaceId, spaceId)),
      db
        .selectDistinct({ participantId: surveyResponses.participantId })
        .from(surveyResponses)
        .where(eq(surveyResponses.spaceId, spaceId)),
      matrixId
        ? db
            .selectDistinct({ participantId: priorityMatrixPositions.participantId })
            .from(priorityMatrixPositions)
            .where(eq(priorityMatrixPositions.matrixId, matrixId))
        : Promise.resolve([] as Array<{ participantId: string | null }>),
      staircaseId
        ? db
            .selectDistinct({ participantId: staircasePositions.participantId })
            .from(staircasePositions)
            .where(eq(staircasePositions.staircaseId, staircaseId))
        : Promise.resolve([] as Array<{ participantId: string | null }>),
      db
        .select({
          participantId: notes.participantId,
          count: sql<number>`count(*)::int`,
        })
        .from(notes)
        .where(eq(notes.spaceId, spaceId))
        .groupBy(notes.participantId),
      db
        .select({
          participantId: votes.participantId,
          count: sql<number>`count(*)::int`,
        })
        .from(votes)
        .where(eq(votes.spaceId, spaceId))
        .groupBy(votes.participantId),
      db
        .select({ createdAt: notes.createdAt })
        .from(notes)
        .where(and(eq(notes.spaceId, spaceId), gte(notes.createdAt, cutoff))),
    ]);

    const recentNoteTimestamps = recentNoteRows
      .map(r => (r.createdAt instanceof Date ? r.createdAt.getTime() : new Date(String(r.createdAt)).getTime()))
      .filter(t => Number.isFinite(t))
      .sort((a, b) => a - b);

    const filterCounts = (
      rows: Array<{ participantId: string | null; count: number }>,
    ): Array<{ participantId: string; count: number }> => {
      const out: Array<{ participantId: string; count: number }> = [];
      for (const r of rows) {
        if (r.participantId) out.push({ participantId: r.participantId, count: Number(r.count) || 0 });
      }
      return out;
    };

    return {
      noteCount: Number(noteCountRow[0]?.count) || 0,
      voteCount: Number(voteCountRow[0]?.count) || 0,
      distinctNoteParticipants: dedupe(distinctNoteRows),
      distinctVoteParticipants: dedupe(distinctVoteRows),
      distinctRankingParticipants: dedupe(distinctRankingRows),
      distinctMarketplaceParticipants: dedupe(distinctMarketplaceRows),
      distinctSurveyParticipants: dedupe(distinctSurveyRows),
      distinctMatrixParticipants: dedupe(distinctMatrixRows),
      distinctStaircaseParticipants: dedupe(distinctStaircaseRows),
      noteCountsByParticipant: filterCounts(noteCountsByParticipantRows),
      voteCountsByParticipant: filterCounts(voteCountsByParticipantRows),
      recentNoteTimestamps,
    };
  }

  // Categories
  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return category;
  }

  async getCategoriesBySpace(spaceId: string): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.spaceId, spaceId)).orderBy(desc(categories.createdAt));
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [created] = await db.insert(categories).values(category).returning();
    return created;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
    return updated;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Votes
  async getVotesBySpace(spaceId: string): Promise<Vote[]> {
    return db.select().from(votes).where(eq(votes.spaceId, spaceId));
  }

  async getVotesByParticipant(participantId: string): Promise<Vote[]> {
    return db.select().from(votes).where(eq(votes.participantId, participantId));
  }

  async createVote(vote: InsertVote): Promise<Vote> {
    const [created] = await db.insert(votes).values(vote).returning();
    return created;
  }

  // Rankings
  async getRankingsBySpace(spaceId: string): Promise<Ranking[]> {
    return db.select().from(rankings).where(eq(rankings.spaceId, spaceId));
  }

  async getRankingsByParticipant(participantId: string): Promise<Ranking[]> {
    return db.select().from(rankings).where(eq(rankings.participantId, participantId));
  }

  async createRanking(ranking: InsertRanking): Promise<Ranking> {
    const [created] = await db.insert(rankings).values(ranking).returning();
    return created;
  }

  async deleteRankingsByParticipant(participantId: string, spaceId: string): Promise<boolean> {
    const result = await db.delete(rankings).where(
      and(eq(rankings.participantId, participantId), eq(rankings.spaceId, spaceId))
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Marketplace Allocations
  async getMarketplaceAllocationsBySpace(spaceId: string): Promise<MarketplaceAllocation[]> {
    return db.select().from(marketplaceAllocations).where(eq(marketplaceAllocations.spaceId, spaceId));
  }

  async getMarketplaceAllocationsByParticipant(participantId: string): Promise<MarketplaceAllocation[]> {
    return db.select().from(marketplaceAllocations).where(eq(marketplaceAllocations.participantId, participantId));
  }

  async createMarketplaceAllocation(allocation: InsertMarketplaceAllocation): Promise<MarketplaceAllocation> {
    const [created] = await db.insert(marketplaceAllocations).values(allocation).returning();
    return created;
  }

  async deleteMarketplaceAllocationsByParticipant(participantId: string, spaceId: string): Promise<boolean> {
    const result = await db.delete(marketplaceAllocations).where(
      and(eq(marketplaceAllocations.participantId, participantId), eq(marketplaceAllocations.spaceId, spaceId))
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Survey Questions
  async getSurveyQuestion(id: string): Promise<SurveyQuestion | undefined> {
    const [question] = await db.select().from(surveyQuestions).where(eq(surveyQuestions.id, id)).limit(1);
    return question;
  }

  async getSurveyQuestionsBySpace(spaceId: string): Promise<SurveyQuestion[]> {
    return db.select().from(surveyQuestions)
      .where(eq(surveyQuestions.spaceId, spaceId))
      .orderBy(surveyQuestions.sortOrder);
  }

  async createSurveyQuestion(question: InsertSurveyQuestion): Promise<SurveyQuestion> {
    const [created] = await db.insert(surveyQuestions).values(question).returning();
    return created;
  }

  async updateSurveyQuestion(id: string, question: Partial<InsertSurveyQuestion>): Promise<SurveyQuestion | undefined> {
    const [updated] = await db.update(surveyQuestions)
      .set(question)
      .where(eq(surveyQuestions.id, id))
      .returning();
    return updated;
  }

  async deleteSurveyQuestion(id: string): Promise<boolean> {
    const result = await db.delete(surveyQuestions).where(eq(surveyQuestions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Survey Responses
  async getSurveyResponsesBySpace(spaceId: string): Promise<SurveyResponse[]> {
    return db.select().from(surveyResponses).where(eq(surveyResponses.spaceId, spaceId));
  }

  async getSurveyResponsesByParticipant(participantId: string, spaceId: string): Promise<SurveyResponse[]> {
    return db.select().from(surveyResponses).where(
      and(eq(surveyResponses.participantId, participantId), eq(surveyResponses.spaceId, spaceId))
    );
  }

  async getSurveyResponsesByNote(noteId: string): Promise<SurveyResponse[]> {
    return db.select().from(surveyResponses).where(eq(surveyResponses.noteId, noteId));
  }

  async createSurveyResponse(response: InsertSurveyResponse): Promise<SurveyResponse> {
    const [created] = await db.insert(surveyResponses).values(response).returning();
    return created;
  }

  async updateSurveyResponse(id: string, response: Partial<InsertSurveyResponse>): Promise<SurveyResponse | undefined> {
    const [updated] = await db.update(surveyResponses)
      .set(response)
      .where(eq(surveyResponses.id, id))
      .returning();
    return updated;
  }

  async deleteSurveyResponsesByParticipant(participantId: string, spaceId: string): Promise<boolean> {
    const result = await db.delete(surveyResponses).where(
      and(eq(surveyResponses.participantId, participantId), eq(surveyResponses.spaceId, spaceId))
    );
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Company Admins
  async getCompanyAdminsByOrganization(organizationId: string): Promise<CompanyAdmin[]> {
    return db.select().from(companyAdmins).where(eq(companyAdmins.organizationId, organizationId));
  }

  async getCompanyAdminsByUser(userId: string): Promise<CompanyAdmin[]> {
    return db.select().from(companyAdmins).where(eq(companyAdmins.userId, userId));
  }

  async createCompanyAdmin(companyAdmin: InsertCompanyAdmin): Promise<CompanyAdmin> {
    const [created] = await db.insert(companyAdmins).values(companyAdmin).returning();
    return created;
  }

  async deleteCompanyAdmin(id: string): Promise<boolean> {
    const result = await db.delete(companyAdmins).where(eq(companyAdmins.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Space Facilitators
  async getSpaceFacilitator(id: string): Promise<SpaceFacilitator | undefined> {
    const [facilitator] = await db.select().from(spaceFacilitators).where(eq(spaceFacilitators.id, id)).limit(1);
    return facilitator;
  }

  async getSpaceFacilitatorsBySpace(spaceId: string): Promise<SpaceFacilitator[]> {
    return db.select().from(spaceFacilitators).where(eq(spaceFacilitators.spaceId, spaceId));
  }

  async getSpaceFacilitatorsByUser(userId: string): Promise<SpaceFacilitator[]> {
    return db.select().from(spaceFacilitators).where(eq(spaceFacilitators.userId, userId));
  }

  async createSpaceFacilitator(spaceFacilitator: InsertSpaceFacilitator): Promise<SpaceFacilitator> {
    const [created] = await db.insert(spaceFacilitators).values(spaceFacilitator).returning();
    return created;
  }

  async deleteSpaceFacilitator(id: string): Promise<boolean> {
    const result = await db.delete(spaceFacilitators).where(eq(spaceFacilitators.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Access Requests
  async getAccessRequest(id: string): Promise<AccessRequest | undefined> {
    const [request] = await db.select().from(accessRequests).where(eq(accessRequests.id, id)).limit(1);
    return request;
  }

  async getAccessRequestsBySpace(spaceId: string): Promise<AccessRequest[]> {
    return db.select().from(accessRequests).where(eq(accessRequests.spaceId, spaceId)).orderBy(desc(accessRequests.requestedAt));
  }

  async getPendingAccessRequestsBySpace(spaceId: string): Promise<AccessRequest[]> {
    return db.select().from(accessRequests).where(
      and(eq(accessRequests.spaceId, spaceId), eq(accessRequests.status, "pending"))
    ).orderBy(desc(accessRequests.requestedAt));
  }

  async createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest> {
    // Access requests always have email (notNull field), normalize it
    const normalizedEmail = request.email.toLowerCase().trim();
    const [created] = await db.insert(accessRequests).values({
      ...request,
      email: normalizedEmail,
    }).returning();
    return created;
  }

  async updateAccessRequest(id: string, request: Partial<InsertAccessRequest>): Promise<AccessRequest | undefined> {
    // Add resolvedAt timestamp when status changes
    const updateData = {
      ...request,
      ...(request.status && request.status !== "pending" ? { resolvedAt: new Date() } : {}),
    };
    const [updated] = await db.update(accessRequests).set(updateData as any).where(eq(accessRequests.id, id)).returning();
    return updated;
  }

  async checkExistingAccessRequest(spaceId: string, email: string): Promise<AccessRequest | undefined> {
    const normalized = normalizeEmail(email);
    if (!normalized) return undefined;
    const [existing] = await db.select().from(accessRequests).where(
      and(eq(accessRequests.spaceId, spaceId), eq(accessRequests.email, normalized), eq(accessRequests.status, "pending"))
    ).limit(1);
    return existing;
  }

  // Knowledge Base Documents
  async getKnowledgeBaseDocument(id: string): Promise<KnowledgeBaseDocument | undefined> {
    const [document] = await db.select().from(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.id, id)).limit(1);
    return document;
  }

  async getKnowledgeBaseDocumentsByScope(scope: string, scopeId?: string): Promise<KnowledgeBaseDocument[]> {
    if (scope === "system") {
      return db.select().from(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.scope, "system")).orderBy(desc(knowledgeBaseDocuments.createdAt));
    } else if (scope === "organization" && scopeId) {
      return db.select().from(knowledgeBaseDocuments).where(
        and(eq(knowledgeBaseDocuments.scope, "organization"), eq(knowledgeBaseDocuments.organizationId, scopeId))
      ).orderBy(desc(knowledgeBaseDocuments.createdAt));
    } else if (scope === "workspace" && scopeId) {
      return db.select().from(knowledgeBaseDocuments).where(
        and(eq(knowledgeBaseDocuments.scope, "workspace"), eq(knowledgeBaseDocuments.spaceId, scopeId))
      ).orderBy(desc(knowledgeBaseDocuments.createdAt));
    }
    return [];
  }

  async getKnowledgeBaseDocumentsForSpace(spaceId: string, organizationId: string): Promise<KnowledgeBaseDocument[]> {
    // Get documents with standard scopes
    const standardDocs = await db.select().from(knowledgeBaseDocuments).where(
      or(
        eq(knowledgeBaseDocuments.scope, "system"),
        and(eq(knowledgeBaseDocuments.scope, "organization"), eq(knowledgeBaseDocuments.organizationId, organizationId)),
        and(eq(knowledgeBaseDocuments.scope, "workspace"), eq(knowledgeBaseDocuments.spaceId, spaceId))
      )
    );

    // Get multi_workspace documents that have access to this workspace
    const multiWorkspaceDocs = await db
      .select({ document: knowledgeBaseDocuments })
      .from(knowledgeBaseDocuments)
      .innerJoin(
        documentWorkspaceAccess,
        eq(knowledgeBaseDocuments.id, documentWorkspaceAccess.documentId)
      )
      .where(
        and(
          eq(knowledgeBaseDocuments.scope, "multi_workspace"),
          eq(documentWorkspaceAccess.spaceId, spaceId)
        )
      );

    // Combine and deduplicate
    const allDocs = [
      ...standardDocs,
      ...multiWorkspaceDocs.map(row => row.document)
    ];

    // Sort by creation date
    return allDocs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createKnowledgeBaseDocument(document: InsertKnowledgeBaseDocument): Promise<KnowledgeBaseDocument> {
    const [created] = await db.insert(knowledgeBaseDocuments).values(document).returning();
    return created;
  }

  async updateKnowledgeBaseDocument(id: string, document: Partial<InsertKnowledgeBaseDocument>): Promise<KnowledgeBaseDocument | undefined> {
    const updateData = {
      ...document,
      updatedAt: new Date(),
    };
    const [updated] = await db.update(knowledgeBaseDocuments).set(updateData as any).where(eq(knowledgeBaseDocuments.id, id)).returning();
    return updated;
  }

  async deleteKnowledgeBaseDocument(id: string): Promise<boolean> {
    const result = await db.delete(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Knowledge Base Chunks
  async createKnowledgeBaseChunks(chunks: InsertKnowledgeBaseChunk[]): Promise<KnowledgeBaseChunk[]> {
    if (chunks.length === 0) return [];
    // Raw INSERT so search_vector is populated server-side via to_tsvector.
    const inserted: KnowledgeBaseChunk[] = [];
    for (const c of chunks) {
      const result = await db.execute(sql`
        INSERT INTO ${knowledgeBaseChunks} (document_id, chunk_index, content, search_vector)
        VALUES (${c.documentId}, ${c.chunkIndex}, ${c.content}, to_tsvector('english', ${c.content}))
        RETURNING id, document_id AS "documentId", chunk_index AS "chunkIndex", content, search_vector AS "searchVector", created_at AS "createdAt"
      `);
      const row = result.rows[0] as KnowledgeBaseChunk;
      inserted.push(row);
    }
    return inserted;
  }

  async deleteKnowledgeBaseChunksByDocument(documentId: string): Promise<number> {
    const result = await db.delete(knowledgeBaseChunks).where(eq(knowledgeBaseChunks.documentId, documentId));
    return result.rowCount ?? 0;
  }

  async getKnowledgeBaseChunksByDocument(documentId: string): Promise<KnowledgeBaseChunk[]> {
    return db.select().from(knowledgeBaseChunks)
      .where(eq(knowledgeBaseChunks.documentId, documentId))
      .orderBy(knowledgeBaseChunks.chunkIndex);
  }

  async searchKnowledgeBaseChunks(params: {
    query: string;
    spaceId?: string;
    organizationId?: string;
    includeSystem?: boolean;
    limit?: number;
  }): Promise<KnowledgeBaseSearchHit[]> {
    const { query, spaceId, organizationId, includeSystem = true, limit = 8 } = params;
    if (!query || !query.trim()) return [];

    // OR-style tsquery: sanitize tokens and join with ` | ` so multi-term
    // input still matches relevant chunks (plainto_tsquery would AND them).
    const tokens = Array.from(
      new Set(
        query
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .map((t) => t.trim())
          .filter((t) => t.length >= 3 && t.length <= 30),
      ),
    ).slice(0, 40);
    if (tokens.length === 0) return [];
    const tsqueryString = tokens.join(" | ");

    // Build scope predicate. We always allow system docs unless caller opts out.
    const scopeClauses: ReturnType<typeof sql>[] = [];
    if (includeSystem) {
      scopeClauses.push(sql`${knowledgeBaseDocuments.scope} = 'system'`);
    }
    if (organizationId) {
      scopeClauses.push(
        sql`(${knowledgeBaseDocuments.scope} = 'organization' AND ${knowledgeBaseDocuments.organizationId} = ${organizationId})`,
      );
    }
    if (spaceId) {
      scopeClauses.push(
        sql`(${knowledgeBaseDocuments.scope} = 'workspace' AND ${knowledgeBaseDocuments.spaceId} = ${spaceId})`,
      );
      // Multi-workspace docs surfaced through documentWorkspaceAccess
      scopeClauses.push(sql`(
        ${knowledgeBaseDocuments.scope} = 'multi_workspace' AND EXISTS (
          SELECT 1 FROM ${documentWorkspaceAccess}
          WHERE ${documentWorkspaceAccess.documentId} = ${knowledgeBaseDocuments.id}
            AND ${documentWorkspaceAccess.spaceId} = ${spaceId}
        )
      )`);
    }
    if (scopeClauses.length === 0) return [];

    const scopeSql = scopeClauses.reduce((acc, cur, i) =>
      i === 0 ? cur : sql`${acc} OR ${cur}`,
    );

    // ts_headline emits private markers; route layer escapes the snippet
    // and replaces markers with controlled <b>/</b> tags (XSS-safe).
    // NOTE: do not alias knowledge_base_documents — scopeSql references the
    // unaliased table via drizzle's ${knowledgeBaseDocuments.column}, so an
    // alias would make those references invalid in Postgres.
    const rows = await db.execute(sql`
      SELECT
        c.id, c.document_id AS "documentId", c.chunk_index AS "chunkIndex",
        c.content, c.created_at AS "createdAt",
        ${knowledgeBaseDocuments.title} AS "documentTitle",
        ts_rank_cd(c.search_vector, to_tsquery('english', ${tsqueryString})) AS rank,
        ts_headline('english', c.content, to_tsquery('english', ${tsqueryString}),
          'StartSel=__KB_HL_START__, StopSel=__KB_HL_END__, MaxWords=35, MinWords=15, ShortWord=3, MaxFragments=2') AS snippet
      FROM ${knowledgeBaseChunks} c
      INNER JOIN ${knowledgeBaseDocuments} ON ${knowledgeBaseDocuments.id} = c.document_id
      WHERE c.search_vector @@ to_tsquery('english', ${tsqueryString})
        AND (${scopeSql})
      ORDER BY rank DESC, c.document_id ASC, c.chunk_index ASC
      LIMIT ${limit}
    `);

    return (rows.rows as Array<{
      id: string;
      documentId: string;
      chunkIndex: number;
      content: string;
      createdAt: Date;
      documentTitle: string;
      rank: string | number;
      snippet: string;
    }>).map((r) => ({
      id: r.id,
      documentId: r.documentId,
      chunkIndex: r.chunkIndex,
      content: r.content,
      createdAt: r.createdAt,
      documentTitle: r.documentTitle,
      rank: Number(r.rank),
      snippet: r.snippet,
    }));
  }

  async createDocumentWorkspaceAccess(access: InsertDocumentWorkspaceAccess): Promise<DocumentWorkspaceAccess> {
    const [created] = await db.insert(documentWorkspaceAccess).values(access).returning();
    return created;
  }

  async getDocumentWorkspaceAccesses(documentId: string): Promise<DocumentWorkspaceAccess[]> {
    return db.select().from(documentWorkspaceAccess).where(eq(documentWorkspaceAccess.documentId, documentId));
  }

  // Workspace Templates
  async getWorkspaceTemplate(id: string): Promise<WorkspaceTemplate | undefined> {
    const [template] = await db.select().from(workspaceTemplates).where(eq(workspaceTemplates.id, id)).limit(1);
    return template;
  }

  async getWorkspaceTemplates(organizationId?: string): Promise<WorkspaceTemplate[]> {
    if (organizationId) {
      return db.select().from(workspaceTemplates).where(
        or(isNull(workspaceTemplates.organizationId), eq(workspaceTemplates.organizationId, organizationId))
      ).orderBy(desc(workspaceTemplates.createdAt));
    }
    return db.select().from(workspaceTemplates).orderBy(desc(workspaceTemplates.createdAt));
  }

  async createWorkspaceTemplateFromSpace(spaceId: string, name: string, type: string, description: string | undefined, createdBy: string): Promise<WorkspaceTemplate> {
    const space = await this.getSpace(spaceId);
    if (!space) {
      throw new Error("Space not found");
    }

    const spaceNotes = await this.getNotesBySpace(spaceId);
    const spaceDocuments = await this.getKnowledgeBaseDocumentsByScope("workspace", spaceId);

    const templateData: InsertWorkspaceTemplate = {
      name,
      type,
      description,
      organizationId: space.organizationId,
      sourceSpaceId: spaceId,
      settings: {
        guestAllowed: space.guestAllowed,
        status: "draft",
      },
      createdBy,
    };

    const [template] = await db.insert(workspaceTemplates).values(templateData).returning();

    for (const note of spaceNotes) {
      const templateNote: InsertWorkspaceTemplateNote = {
        templateId: template.id,
        content: note.content,
        category: note.category,
      };
      await db.insert(workspaceTemplateNotes).values(templateNote);
    }

    for (const doc of spaceDocuments) {
      const templateDoc: InsertWorkspaceTemplateDocument = {
        templateId: template.id,
        title: doc.title,
        description: doc.description,
        filename: doc.filename,
        filePath: doc.filePath,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        tags: doc.tags,
      };
      await db.insert(workspaceTemplateDocuments).values(templateDoc);
    }

    return template;
  }

  async deleteWorkspaceTemplate(id: string): Promise<boolean> {
    await db.delete(workspaceTemplateNotes).where(eq(workspaceTemplateNotes.templateId, id));
    await db.delete(workspaceTemplateDocuments).where(eq(workspaceTemplateDocuments.templateId, id));
    const result = await db.delete(workspaceTemplates).where(eq(workspaceTemplates.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getWorkspaceTemplateNotes(templateId: string): Promise<WorkspaceTemplateNote[]> {
    return db.select().from(workspaceTemplateNotes).where(eq(workspaceTemplateNotes.templateId, templateId)).orderBy(workspaceTemplateNotes.createdAt);
  }

  async getWorkspaceTemplateDocuments(templateId: string): Promise<WorkspaceTemplateDocument[]> {
    return db.select().from(workspaceTemplateDocuments).where(eq(workspaceTemplateDocuments.templateId, templateId)).orderBy(workspaceTemplateDocuments.createdAt);
  }

  async cloneTemplateIntoWorkspace(templateId: string, spaceId: string, participantName: string = "Template"): Promise<void> {
    // Get the template and workspace to validate organization match
    const template = await this.getWorkspaceTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const workspace = await this.getSpace(spaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    // SECURITY: Verify template belongs to same organization as workspace
    if (template.organizationId !== workspace.organizationId) {
      throw new Error("Template does not belong to the same organization as the workspace");
    }

    // Get template notes, documents, and categories. Categories live on the
    // template's source space (when present) — this lets CSV-imported
    // templates and any other templates that declared real category rows
    // round-trip into freshly cloned workspaces with proper category
    // assignments instead of dropping them on the floor.
    const templateNotes = await this.getWorkspaceTemplateNotes(templateId);
    const templateDocuments = await this.getWorkspaceTemplateDocuments(templateId);
    const sourceSpaceId = template.sourceSpaceId ?? null;
    const sourceCategories = sourceSpaceId
      ? await this.getCategoriesBySpace(sourceSpaceId)
      : [];

    // Only create participant if there are notes, documents, or categories to clone
    if (templateNotes.length === 0 && templateDocuments.length === 0 && sourceCategories.length === 0) {
      return; // Nothing to clone, exit early
    }

    // Recreate categories in the destination workspace and remember them by
    // lower-cased name so we can resolve the free-text `category` column on
    // template notes back to a real category id.
    const categoryByName = new Map<string, string>();
    for (const cat of sourceCategories) {
      const newCat = await this.createCategory({
        spaceId,
        name: cat.name,
        color: cat.color,
      });
      categoryByName.set(cat.name.toLowerCase(), newCat.id);
    }

    // Create a template participant for the cloned notes
    const participantData: InsertParticipant = {
      spaceId,
      displayName: participantName,
    };
    const [participant] = await db.insert(participants).values(participantData).returning();

    // Clone notes into workspace, mapping the free-text category label onto
    // the new category id when one exists in the destination workspace.
    for (const templateNote of templateNotes) {
      const matchedCategoryId = templateNote.category
        ? categoryByName.get(templateNote.category.toLowerCase()) ?? null
        : null;
      const noteData: InsertNote = {
        spaceId,
        content: templateNote.content,
        participantId: participant.id,
        category: templateNote.category || undefined,
        manualCategoryId: matchedCategoryId,
        isManualOverride: matchedCategoryId !== null,
      };
      await db.insert(notes).values(noteData);
    }

    // Clone documents into workspace knowledge base
    for (const templateDoc of templateDocuments) {
      const docData: InsertKnowledgeBaseDocument = {
        title: templateDoc.title,
        description: templateDoc.description,
        filename: templateDoc.filename,
        filePath: templateDoc.filePath,
        fileSize: templateDoc.fileSize,
        mimeType: templateDoc.mimeType,
        scope: "workspace",
        spaceId: spaceId,
        tags: templateDoc.tags || [],
        uploadedBy: participant.id, // Use template participant as uploader
      };
      await db.insert(knowledgeBaseDocuments).values(docData);
    }
  }

  // AI Usage Logs
  async getAiUsageLogs(filters: {
    organizationId?: string;
    spaceId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AiUsageLog[]> {
    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(aiUsageLog.organizationId, filters.organizationId));
    }

    if (filters.spaceId) {
      conditions.push(eq(aiUsageLog.spaceId, filters.spaceId));
    }

    if (filters.userId) {
      conditions.push(eq(aiUsageLog.userId, filters.userId));
    }

    if (filters.startDate) {
      conditions.push(gte(aiUsageLog.createdAt, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(aiUsageLog.createdAt, filters.endDate));
    }

    let query = db.select().from(aiUsageLog);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query.orderBy(desc(aiUsageLog.createdAt));
  }

  // Email Verification Tokens
  async createEmailVerificationToken(token: InsertEmailVerificationToken): Promise<EmailVerificationToken> {
    const [newToken] = await db.insert(emailVerificationTokens).values(token).returning();
    return newToken;
  }

  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    const [found] = await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.token, token)).limit(1);
    return found;
  }

  async deleteEmailVerificationToken(token: string): Promise<boolean> {
    const result = await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deleteExpiredEmailVerificationTokens(): Promise<boolean> {
    const now = new Date();
    const result = await db.delete(emailVerificationTokens).where(lte(emailVerificationTokens.expiresAt, now));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Password Reset Tokens
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [newToken] = await db.insert(passwordResetTokens).values(token).returning();
    return newToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [found] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).limit(1);
    return found;
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<boolean> {
    const result = await db.update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deletePasswordResetToken(token: string): Promise<boolean> {
    const result = await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deleteExpiredPasswordResetTokens(): Promise<boolean> {
    const now = new Date();
    const result = await db.delete(passwordResetTokens).where(lte(passwordResetTokens.expiresAt, now));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Cohort Results
  async getCohortResult(id: string): Promise<CohortResult | undefined> {
    const [result] = await db.select().from(cohortResults).where(eq(cohortResults.id, id)).limit(1);
    return result;
  }

  async getCohortResultsBySpace(spaceId: string): Promise<CohortResult[]> {
    return db.select().from(cohortResults).where(eq(cohortResults.spaceId, spaceId)).orderBy(desc(cohortResults.createdAt));
  }

  async createCohortResult(result: InsertCohortResult): Promise<CohortResult> {
    const [created] = await db.insert(cohortResults).values(result).returning();
    return created;
  }

  async updateCohortResult(id: string, result: Partial<InsertCohortResult>): Promise<CohortResult | undefined> {
    const [updated] = await db.update(cohortResults).set(result).where(eq(cohortResults.id, id)).returning();
    return updated;
  }

  async deleteCohortResult(id: string): Promise<boolean> {
    const result = await db.delete(cohortResults).where(eq(cohortResults.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Personalized Results
  async getPersonalizedResult(id: string): Promise<PersonalizedResult | undefined> {
    const [result] = await db.select().from(personalizedResults).where(eq(personalizedResults.id, id)).limit(1);
    return result;
  }

  async getPersonalizedResultsBySpace(spaceId: string): Promise<PersonalizedResult[]> {
    return db.select().from(personalizedResults).where(eq(personalizedResults.spaceId, spaceId)).orderBy(desc(personalizedResults.createdAt));
  }

  async getPersonalizedResultsByParticipant(participantId: string): Promise<PersonalizedResult[]> {
    return db.select().from(personalizedResults).where(eq(personalizedResults.participantId, participantId)).orderBy(desc(personalizedResults.createdAt));
  }

  async createPersonalizedResult(result: InsertPersonalizedResult): Promise<PersonalizedResult> {
    const [created] = await db.insert(personalizedResults).values(result).returning();
    return created;
  }

  async updatePersonalizedResult(id: string, result: Partial<InsertPersonalizedResult>): Promise<PersonalizedResult | undefined> {
    const [updated] = await db.update(personalizedResults).set(result).where(eq(personalizedResults.id, id)).returning();
    return updated;
  }

  async deletePersonalizedResult(id: string): Promise<boolean> {
    const result = await db.delete(personalizedResults).where(eq(personalizedResults.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // IDEAS-CENTRIC ARCHITECTURE IMPLEMENTATION

  // Ideas Management
  async getIdea(id: string): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id)).limit(1);
    return idea;
  }

  async getIdeasBySpace(spaceId: string): Promise<Idea[]> {
    return db.select().from(ideas)
      .where(eq(ideas.spaceId, spaceId))
      .orderBy(desc(ideas.createdAt));
  }

  async getIdeasByCategory(spaceId: string, categoryId: string): Promise<Idea[]> {
    return db.select().from(ideas)
      .where(and(
        eq(ideas.spaceId, spaceId),
        eq(ideas.manualCategoryId, categoryId)
      ))
      .orderBy(desc(ideas.createdAt));
  }

  async createIdea(idea: InsertIdea): Promise<Idea> {
    const [created] = await db.insert(ideas).values(idea).returning();
    return created;
  }

  async updateIdea(id: string, idea: Partial<InsertIdea>): Promise<Idea | undefined> {
    const [updated] = await db.update(ideas)
      .set({ ...idea, updatedAt: new Date() })
      .where(eq(ideas.id, id))
      .returning();
    return updated;
  }

  async deleteIdea(id: string): Promise<boolean> {
    const result = await db.delete(ideas).where(eq(ideas.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async bulkCreateIdeas(ideaList: InsertIdea[]): Promise<Idea[]> {
    if (ideaList.length === 0) return [];
    return db.insert(ideas).values(ideaList).returning();
  }

  // Idea Contributions
  async getIdeaContributions(ideaId: string): Promise<IdeaContribution[]> {
    return db.select().from(ideaContributions)
      .where(eq(ideaContributions.ideaId, ideaId))
      .orderBy(desc(ideaContributions.createdAt));
  }

  async createIdeaContribution(contribution: InsertIdeaContribution): Promise<IdeaContribution> {
    const [created] = await db.insert(ideaContributions).values(contribution).returning();
    return created;
  }

  // Workspace Modules
  async getWorkspaceModules(spaceId: string): Promise<WorkspaceModule[]> {
    return db.select().from(workspaceModules)
      .where(eq(workspaceModules.spaceId, spaceId))
      .orderBy(workspaceModules.orderIndex);
  }

  async getWorkspaceModule(id: string): Promise<WorkspaceModule | undefined> {
    const [module] = await db.select().from(workspaceModules)
      .where(eq(workspaceModules.id, id))
      .limit(1);
    return module;
  }

  async createWorkspaceModule(module: InsertWorkspaceModule): Promise<WorkspaceModule> {
    const [created] = await db.insert(workspaceModules).values(module).returning();
    return created;
  }

  async updateWorkspaceModule(id: string, module: Partial<InsertWorkspaceModule>): Promise<WorkspaceModule | undefined> {
    const [updated] = await db.update(workspaceModules)
      .set({ ...module, updatedAt: new Date() })
      .where(eq(workspaceModules.id, id))
      .returning();
    return updated;
  }

  async deleteWorkspaceModule(id: string): Promise<boolean> {
    const result = await db.delete(workspaceModules).where(eq(workspaceModules.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Workspace Module Runs
  async getActiveModuleRun(moduleId: string): Promise<WorkspaceModuleRun | undefined> {
    const [run] = await db.select().from(workspaceModuleRuns)
      .where(and(
        eq(workspaceModuleRuns.moduleId, moduleId),
        eq(workspaceModuleRuns.status, 'active')
      ))
      .orderBy(desc(workspaceModuleRuns.startedAt))
      .limit(1);
    return run;
  }

  async getModuleRuns(moduleId: string): Promise<WorkspaceModuleRun[]> {
    return db.select().from(workspaceModuleRuns)
      .where(eq(workspaceModuleRuns.moduleId, moduleId))
      .orderBy(desc(workspaceModuleRuns.startedAt));
  }

  async createModuleRun(run: InsertWorkspaceModuleRun): Promise<WorkspaceModuleRun> {
    const [created] = await db.insert(workspaceModuleRuns).values(run).returning();
    return created;
  }

  async completeModuleRun(id: string): Promise<WorkspaceModuleRun | undefined> {
    const [updated] = await db.update(workspaceModuleRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(workspaceModuleRuns.id, id))
      .returning();
    return updated;
  }

  // Priority Matrices (2x2 Grid)
  async getPriorityMatrix(spaceId: string): Promise<PriorityMatrix | undefined> {
    const [matrix] = await db.select().from(priorityMatrices)
      .where(eq(priorityMatrices.spaceId, spaceId))
      .orderBy(desc(priorityMatrices.createdAt))
      .limit(1);
    return matrix;
  }

  async createPriorityMatrix(matrix: InsertPriorityMatrix): Promise<PriorityMatrix> {
    const [created] = await db.insert(priorityMatrices).values(matrix).returning();
    return created;
  }

  async updatePriorityMatrix(id: string, matrix: Partial<InsertPriorityMatrix>): Promise<PriorityMatrix | undefined> {
    const [updated] = await db.update(priorityMatrices)
      .set({ ...matrix, updatedAt: new Date() })
      .where(eq(priorityMatrices.id, id))
      .returning();
    return updated;
  }

  // Priority Matrix Positions
  async getPriorityMatrixPositions(matrixId: string): Promise<PriorityMatrixPosition[]> {
    return db.select().from(priorityMatrixPositions)
      .where(eq(priorityMatrixPositions.matrixId, matrixId));
  }

  async upsertPriorityMatrixPosition(position: InsertPriorityMatrixPosition): Promise<PriorityMatrixPosition> {
    // Use proper Drizzle upsert with onConflictDoUpdate
    const [upsertedPosition] = await db.insert(priorityMatrixPositions)
      .values(position)
      .onConflictDoUpdate({
        target: [
          priorityMatrixPositions.matrixId,
          priorityMatrixPositions.noteId,
          priorityMatrixPositions.moduleRunId
        ],
        set: {
          xCoord: sql`excluded.x_coord`,
          yCoord: sql`excluded.y_coord`,
          lockedBy: sql`excluded.locked_by`,
          lockedAt: sql`excluded.locked_at`,
          participantId: sql`excluded.participant_id`,
          updatedAt: sql`now()`
        }
      })
      .returning();
    
    return upsertedPosition;
  }

  async lockPriorityMatrixPosition(id: string, participantId: string): Promise<boolean> {
    const result = await db.update(priorityMatrixPositions)
      .set({ lockedBy: participantId, lockedAt: new Date() })
      .where(eq(priorityMatrixPositions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async unlockPriorityMatrixPosition(id: string): Promise<boolean> {
    const result = await db.update(priorityMatrixPositions)
      .set({ lockedBy: null, lockedAt: null })
      .where(eq(priorityMatrixPositions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Staircase Modules
  async getStaircaseModule(spaceId: string): Promise<StaircaseModule | undefined> {
    const [module] = await db.select().from(staircaseModules)
      .where(eq(staircaseModules.spaceId, spaceId))
      .orderBy(desc(staircaseModules.createdAt))
      .limit(1);
    return module;
  }

  async createStaircaseModule(module: InsertStaircaseModule): Promise<StaircaseModule> {
    const [created] = await db.insert(staircaseModules).values(module).returning();
    return created;
  }

  async updateStaircaseModule(id: string, module: Partial<InsertStaircaseModule>): Promise<StaircaseModule | undefined> {
    const [updated] = await db.update(staircaseModules)
      .set({ ...module, updatedAt: new Date() })
      .where(eq(staircaseModules.id, id))
      .returning();
    return updated;
  }

  // Staircase Positions
  async getStaircasePositions(staircaseId: string): Promise<StaircasePosition[]> {
    return db.select().from(staircasePositions)
      .where(eq(staircasePositions.staircaseId, staircaseId))
      .orderBy(staircasePositions.score);
  }

  async upsertStaircasePosition(position: InsertStaircasePosition): Promise<StaircasePosition> {
    // Build update set with only defined values
    const updateSet: any = {
      score: position.score,
    };
    
    if (position.slotOffset !== undefined) {
      updateSet.slotOffset = position.slotOffset;
    }
    
    if (position.participantId !== undefined) {
      updateSet.participantId = position.participantId;
    }
    
    // Use proper Drizzle upsert with onConflictDoUpdate
    const [upsertedPosition] = await db.insert(staircasePositions)
      .values(position)
      .onConflictDoUpdate({
        target: [
          staircasePositions.staircaseId,
          staircasePositions.noteId,
          staircasePositions.moduleRunId,
        ],
        set: updateSet,
      })
      .returning();

    return upsertedPosition;
  }

  async lockStaircasePosition(id: string, participantId: string): Promise<boolean> {
    const result = await db.update(staircasePositions)
      .set({ lockedBy: participantId, lockedAt: new Date() })
      .where(eq(staircasePositions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async unlockStaircasePosition(id: string): Promise<boolean> {
    const result = await db.update(staircasePositions)
      .set({ lockedBy: null, lockedAt: null })
      .where(eq(staircasePositions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Notifications (in-app)
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async getNotificationsByUser(userId: string, limit: number = 30): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const rows = await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return rows.length;
  }

  async markNotificationRead(id: string, userId: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const result = await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return result.rowCount || 0;
  }

  async createClientError(record: InsertClientError): Promise<ClientError> {
    const [created] = await db.insert(clientErrors).values(record).returning();
    return created;
  }
}

export const storage = new DbStorage();
