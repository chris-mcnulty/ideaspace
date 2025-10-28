import { db } from "./db";
import {
  type Organization,
  type InsertOrganization,
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
  organizations,
  users,
  spaces,
  participants,
  categories,
  notes,
  votes,
  rankings,
  marketplaceAllocations,
  companyAdmins,
  spaceFacilitators,
  accessRequests,
  emailVerificationTokens,
  passwordResetTokens,
  knowledgeBaseDocuments,
  workspaceTemplates,
  workspaceTemplateNotes,
  workspaceTemplateDocuments,
  aiUsageLog,
  cohortResults,
  personalizedResults,
} from "@shared/schema";
import { eq, and, desc, or, isNull, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
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
  createSpace(space: InsertSpace): Promise<Space>;
  updateSpace(id: string, space: Partial<InsertSpace>): Promise<Space | undefined>;
  deleteSpace(id: string): Promise<boolean>;

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
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipant(id: string, participant: Partial<InsertParticipant>): Promise<Participant | undefined>;
  deleteParticipant(id: string): Promise<boolean>;
  findOrphanedParticipantsByEmail(email: string): Promise<Participant[]>;
  linkParticipantToUser(participantId: string, userId: string): Promise<Participant | undefined>;

  // Notes
  getNote(id: string): Promise<Note | undefined>;
  getNotesBySpace(spaceId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: string): Promise<boolean>;
  deleteNotes(ids: string[]): Promise<boolean>;

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
}

export class DbStorage implements IStorage {
  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return org;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
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

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersByOrganization(organizationId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.organizationId, organizationId)).orderBy(desc(users.createdAt));
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(user).where(eq(users.id, id)).returning();
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
    return db.select().from(spaces).where(eq(spaces.organizationId, organizationId)).orderBy(desc(spaces.createdAt));
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
    const result = await db.delete(spaces).where(eq(spaces.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Participants
  async getParticipant(id: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.id, id)).limit(1);
    return participant;
  }

  async getParticipantsBySpace(spaceId: string): Promise<Participant[]> {
    return db.select().from(participants).where(eq(participants.spaceId, spaceId));
  }

  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    const [created] = await db.insert(participants).values(participant).returning();
    return created;
  }

  async updateParticipant(id: string, participant: Partial<InsertParticipant>): Promise<Participant | undefined> {
    const [updated] = await db.update(participants).set(participant).where(eq(participants.id, id)).returning();
    return updated;
  }

  async deleteParticipant(id: string): Promise<boolean> {
    const result = await db.delete(participants).where(eq(participants.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async findOrphanedParticipantsByEmail(email: string): Promise<Participant[]> {
    // Find guest participants without userId that match the email
    return db.select().from(participants).where(
      and(
        eq(participants.email, email),
        eq(participants.userId, null as any)
      )
    );
  }

  async linkParticipantToUser(participantId: string, userId: string): Promise<Participant | undefined> {
    const [updated] = await db.update(participants)
      .set({ userId, isGuest: false })
      .where(eq(participants.id, participantId))
      .returning();
    return updated;
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
    const [created] = await db.insert(accessRequests).values(request).returning();
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
    const [existing] = await db.select().from(accessRequests).where(
      and(eq(accessRequests.spaceId, spaceId), eq(accessRequests.email, email), eq(accessRequests.status, "pending"))
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
    return db.select().from(knowledgeBaseDocuments).where(
      or(
        eq(knowledgeBaseDocuments.scope, "system"),
        and(eq(knowledgeBaseDocuments.scope, "organization"), eq(knowledgeBaseDocuments.organizationId, organizationId)),
        and(eq(knowledgeBaseDocuments.scope, "workspace"), eq(knowledgeBaseDocuments.spaceId, spaceId))
      )
    ).orderBy(desc(knowledgeBaseDocuments.createdAt));
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
}

export const storage = new DbStorage();
