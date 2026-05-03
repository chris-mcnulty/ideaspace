import { createHash } from "crypto";
import { db } from "../db";
import { cohortResults, personalizedResults } from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";

/**
 * Stable hash of all inputs that influence a workspace's AI-generated cohort
 * result. If any of these change, the hash changes and the cached result is
 * implicitly invalidated (we just don't find a match — old rows stay around
 * for audit but won't be served).
 *
 * We deliberately include every prompt-affecting input we could find, including
 * workspace metadata (name/purpose), enabled module config, category names
 * (which are surfaced in the prompt), survey question text/order,
 * priority-matrix axis labels, staircase labels/ranges, and a content hash
 * over the KB chunks fed into grounding. Adding a new input here is the
 * correct way to ensure cache invalidation when that input changes.
 */
export interface CohortInputs {
  spaceId: string;
  // Workspace-level prompt context
  workspaceName?: string | null;
  workspacePurpose?: string | null;
  // Module configuration the prompt depends on
  enabledModules: string[];
  moduleConfig?: Record<string, unknown> | null;
  matrixAxes?: { xLabel?: string | null; yLabel?: string | null } | null;
  staircaseConfig?: {
    label?: string | null;
    minScore?: number | null;
    maxScore?: number | null;
  } | null;
  surveyQuestions?: Array<{ id: string; text: string; order: number }>;
  categories?: Array<{ id: string; name: string }>;
  // Per-participant data
  notes: Array<{ id: string; content: string; manualCategoryId: string | null }>;
  // Aggregates instead of raw rows: hash invalidation still triggers on any
  // observable change in the cohort's voting/ranking/allocation/survey data
  // (since the aggregates are deterministic functions of the rows), but the
  // cohort-results pipeline avoids streaming every row to Node.
  pairwiseTallies: Array<{ noteId: string; wins: number; comparisons: number }>;
  rankingAggregates: Array<{ noteId: string; totalScore: number; totalRank: number; count: number }>;
  marketplaceTallies: Array<{ noteId: string; totalCoins: number; participantCount: number }>;
  matrixPositions: Array<{ noteId: string; xCoord: number; yCoord: number }>;
  staircasePositions: Array<{ noteId: string; score: number }>;
  surveyAggregates: Array<{ noteId: string; questionId: string; sum: number; count: number }>;
  // KB grounding
  kbChunkIds: string[];
  kbContentHash?: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

/**
 * Hash a list of KB chunk contents so that edits to source documents (which
 * may change chunk content even when chunk IDs stay the same) invalidate the
 * cache. Inputs are sorted by id for stability.
 */
export function hashKbChunkContents(
  chunks: Array<{ id: string; content: string }>,
): string {
  const sorted = [...chunks].sort((a, b) => a.id.localeCompare(b.id));
  const h = createHash("sha256");
  for (const c of sorted) {
    h.update(c.id);
    h.update("\u0001");
    h.update(c.content);
    h.update("\u0002");
  }
  return h.digest("hex");
}

export function computeCohortInputsHash(inputs: CohortInputs): string {
  const normalized = {
    spaceId: inputs.spaceId,
    workspaceName: inputs.workspaceName ?? null,
    workspacePurpose: inputs.workspacePurpose ?? null,
    enabledModules: [...inputs.enabledModules].sort(),
    moduleConfig: inputs.moduleConfig ?? null,
    matrixAxes: inputs.matrixAxes ?? null,
    staircaseConfig: inputs.staircaseConfig ?? null,
    surveyQuestions: [...(inputs.surveyQuestions ?? [])].sort((a, b) =>
      a.order - b.order || a.id.localeCompare(b.id),
    ),
    categories: [...(inputs.categories ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    notes: [...inputs.notes].sort((a, b) => a.id.localeCompare(b.id)),
    pairwiseTallies: [...inputs.pairwiseTallies].sort((a, b) => a.noteId.localeCompare(b.noteId)),
    rankingAggregates: [...inputs.rankingAggregates].sort((a, b) => a.noteId.localeCompare(b.noteId)),
    marketplaceTallies: [...inputs.marketplaceTallies].sort((a, b) => a.noteId.localeCompare(b.noteId)),
    matrixPositions: [...inputs.matrixPositions].sort((a, b) => a.noteId.localeCompare(b.noteId)),
    staircasePositions: [...inputs.staircasePositions].sort((a, b) => a.noteId.localeCompare(b.noteId)),
    surveyAggregates: [...inputs.surveyAggregates].sort((a, b) =>
      (a.noteId + a.questionId).localeCompare(b.noteId + b.questionId),
    ),
    kbChunkIds: [...inputs.kbChunkIds].sort(),
    kbContentHash: inputs.kbContentHash ?? null,
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
  participantDisplayName?: string | null;
  cohortResultId: string | null;
  cohortInputsHash: string;
  participantNotes: Array<{ id: string; content: string; manualCategoryId: string | null }>;
  participantVotes: Array<{ winnerNoteId: string; loserNoteId: string }>;
  participantRankings: Array<{ noteId: string; rank: number }>;
  participantAllocations: Array<{ noteId: string; coinsAllocated: number }>;
  noteImpacts: Array<{ noteId: string; wins: number; totalComparisons: number }>;
  cohortSummary?: string | null;
}

export function computePersonalizedInputsHash(inputs: PersonalizedInputs): string {
  const normalized = {
    spaceId: inputs.spaceId,
    participantId: inputs.participantId,
    participantDisplayName: inputs.participantDisplayName ?? null,
    cohortResultId: inputs.cohortResultId,
    cohortInputsHash: inputs.cohortInputsHash,
    cohortSummary: inputs.cohortSummary ?? null,
    participantNotes: [...inputs.participantNotes].sort((a, b) => a.id.localeCompare(b.id)),
    participantVotes: [...inputs.participantVotes].sort((a, b) =>
      (a.winnerNoteId + a.loserNoteId).localeCompare(b.winnerNoteId + b.loserNoteId),
    ),
    participantRankings: [...inputs.participantRankings].sort((a, b) => a.noteId.localeCompare(b.noteId)),
    participantAllocations: [...inputs.participantAllocations].sort((a, b) => a.noteId.localeCompare(b.noteId)),
    noteImpacts: [...inputs.noteImpacts].sort((a, b) => a.noteId.localeCompare(b.noteId)),
  };
  return createHash("sha256").update(stableStringify(normalized)).digest("hex");
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
