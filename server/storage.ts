import { db } from "./db";
import {
  type Organization,
  type InsertOrganization,
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
  organizations,
  spaces,
  participants,
  notes,
  votes,
  rankings,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined>;

  // Spaces
  getSpace(id: string): Promise<Space | undefined>;
  getSpacesByOrganization(organizationId: string): Promise<Space[]>;
  createSpace(space: InsertSpace): Promise<Space>;
  updateSpace(id: string, space: Partial<InsertSpace>): Promise<Space | undefined>;
  deleteSpace(id: string): Promise<boolean>;

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

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
  }

  async updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await db.update(organizations).set(org).where(eq(organizations.id, id)).returning();
    return updated;
  }

  // Spaces
  async getSpace(id: string): Promise<Space | undefined> {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, id)).limit(1);
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
}

export const storage = new DbStorage();
