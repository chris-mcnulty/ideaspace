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
  type Note,
  type InsertNote,
  type Vote,
  type InsertVote,
  type Ranking,
  type InsertRanking,
  type CompanyAdmin,
  type InsertCompanyAdmin,
  type SpaceFacilitator,
  type InsertSpaceFacilitator,
  type AccessRequest,
  type InsertAccessRequest,
  organizations,
  users,
  spaces,
  participants,
  notes,
  votes,
  rankings,
  companyAdmins,
  spaceFacilitators,
  accessRequests,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

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

  // Notes
  getNote(id: string): Promise<Note | undefined>;
  getNotesBySpace(spaceId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: string): Promise<boolean>;
  deleteNotes(ids: string[]): Promise<boolean>;

  // Votes
  getVotesBySpace(spaceId: string): Promise<Vote[]>;
  getVotesByParticipant(participantId: string): Promise<Vote[]>;
  createVote(vote: InsertVote): Promise<Vote>;

  // Rankings
  getRankingsBySpace(spaceId: string): Promise<Ranking[]>;
  getRankingsByParticipant(participantId: string): Promise<Ranking[]>;
  createRanking(ranking: InsertRanking): Promise<Ranking>;
  deleteRankingsByParticipant(participantId: string, spaceId: string): Promise<boolean>;

  // Access Requests
  getAccessRequest(id: string): Promise<AccessRequest | undefined>;
  getAccessRequestsBySpace(spaceId: string): Promise<AccessRequest[]>;
  getPendingAccessRequestsBySpace(spaceId: string): Promise<AccessRequest[]>;
  createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest>;
  updateAccessRequest(id: string, request: Partial<InsertAccessRequest>): Promise<AccessRequest | undefined>;
  checkExistingAccessRequest(spaceId: string, email: string): Promise<AccessRequest | undefined>;
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
}

export const storage = new DbStorage();
