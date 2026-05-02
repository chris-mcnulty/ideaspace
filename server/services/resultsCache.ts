import { createHash } from "crypto";
import { db } from "../db";
import { cohortResults, personalizedResults } from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";

/**
 * Stable hash of all inputs that influence a workspace's AI-generated cohort
 * result. If any of these change, the hash changes and the cached result is
 * implicitly invalidated (we just don't find a match — old rows stay around
 * for audit but won't be served).
 */
export interface CohortInputs {
  spaceId: string;
  notes: Array<{ id: string; content: string; manualCategoryId: string | null }>;
  votes: Array<{ winnerNoteId: string; loserNoteId: string }>;
  rankings: Array<{ noteId: string; rank: number; participantId: string }>;
  marketplaceAllocations: Array<{ noteId: string; participantId: string; coinsAllocated: number }>;
  matrixPositions: Array<{ noteId: string; xCoord: number; yCoord: number }>;
  staircasePositions: Array<{ noteId: string; score: number }>;
  surveyResponses: Array<{ noteId: string; questionId: string; participantId: string; score: number }>;
  enabledModules: string[];
  kbChunkIds: string[]; // chunk ids retrieved for grounding
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

export function computeCohortInputsHash(inputs: CohortInputs): string {
  const normalized = {
    spaceId: inputs.spaceId,
    notes: [...inputs.notes].sort((a, b) => a.id.localeCompare(b.id)),
    votes: [...inputs.votes].sort((a, b) =>
      (a.winnerNoteId + a.loserNoteId).localeCompare(b.winnerNoteId + b.loserNoteId),
    ),
    rankings: [...inputs.rankings].sort((a, b) =>
      (a.participantId + a.noteId).localeCompare(b.participantId + b.noteId),
    ),
    marketplaceAllocations: [...inputs.marketplaceAllocations].sort((a, b) =>
      (a.participantId + a.noteId).localeCompare(b.participantId + b.noteId),
    ),
    matrixPositions: [...inputs.matrixPositions].sort((a, b) => a.noteId.localeCompare(b.noteId)),
    staircasePositions: [...inputs.staircasePositions].sort((a, b) => a.noteId.localeCompare(b.noteId)),
    surveyResponses: [...inputs.surveyResponses].sort((a, b) =>
      (a.participantId + a.questionId + a.noteId).localeCompare(b.participantId + b.questionId + b.noteId),
    ),
    enabledModules: [...inputs.enabledModules].sort(),
    kbChunkIds: [...inputs.kbChunkIds].sort(),
  };
  return createHash("sha256").update(stableStringify(normalized)).digest("hex");
}

export async function findCachedCohortResult(spaceId: string, inputsHash: string) {
  const [row] = await db
    .select()
    .from(cohortResults)
    .where(and(eq(cohortResults.spaceId, spaceId), eq(cohortResults.inputsHash, inputsHash)))
    .orderBy(desc(cohortResults.createdAt))
    .limit(1);
  return row;
}

export interface PersonalizedInputs {
  spaceId: string;
  participantId: string;
  cohortResultId: string | null;
  inputsHash: string; // matches the cohort inputs hash this was generated against
}

export function computePersonalizedInputsHash(inputs: PersonalizedInputs): string {
  return createHash("sha256")
    .update(
      stableStringify({
        spaceId: inputs.spaceId,
        participantId: inputs.participantId,
        cohortResultId: inputs.cohortResultId,
        cohortInputsHash: inputs.inputsHash,
      }),
    )
    .digest("hex");
}

export async function findCachedPersonalizedResult(
  spaceId: string,
  participantId: string,
  inputsHash: string,
) {
  const [row] = await db
    .select()
    .from(personalizedResults)
    .where(
      and(
        eq(personalizedResults.spaceId, spaceId),
        eq(personalizedResults.participantId, participantId),
        eq(personalizedResults.inputsHash, inputsHash),
      ),
    )
    .orderBy(desc(personalizedResults.createdAt))
    .limit(1);
  return row;
}
