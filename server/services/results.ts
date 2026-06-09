import { openai } from "./openai";
import { db } from "../db";
import { notes, votes, rankings, marketplaceAllocations, participants, spaces, knowledgeBaseDocuments, cohortResults, personalizedResults, categories, workspaceModules, priorityMatrices, priorityMatrixPositions, staircaseModules, staircasePositions, surveyQuestions, surveyResponses, starships, starshipPositions, signalDecks, signalActivities, signalResponses } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import type { CohortResult, PersonalizedResult } from "@shared/schema";
import { storage } from "../storage";
import { logAiUsage, extractUsageMetrics } from "./aiUsageLogger";
import { PROMPT_INJECTION_GUARD, sanitizeForPrompt, wrapUntrusted } from "./promptSafety";
import {
  computeCohortInputsHash,
  computePersonalizedInputsHash,
  findCachedCohortResult,
  findCachedPersonalizedResult,
  hashKbChunkContents,
  type CohortInputs,
} from "./resultsCache";

// Schema for validating AI-generated cohort results
// Accepts a string or an array of strings from the model and normalises to string.
const coercedString = z.preprocess(
  (v) => Array.isArray(v) ? v.join('\n\n') : v,
  z.string(),
);
const coercedStringOptional = z.preprocess(
  (v) => Array.isArray(v) ? v.join('\n\n') : v,
  z.string().optional().nullable(),
);

const CohortResultSchema = z.object({
  summary: coercedString,
  keyThemes: z.array(z.string()),
  topIdeas: z.array(z.object({
    noteId: z.union([z.string(), z.number()]).nullable().transform(v => (v !== null && v !== undefined) ? String(v) : null),
    content: z.string(),
    category: z.string().optional().nullable(),
    pairwiseWins: z.number().optional().nullable().transform(v => v ?? undefined),
    bordaScore: z.number().optional().nullable().transform(v => v ?? undefined),
    marketplaceCoins: z.number().optional().nullable().transform(v => v ?? undefined),
    matrixPosition: z.object({
      x: z.number(),
      y: z.number(),
      xLabel: z.string().optional().nullable(),
      yLabel: z.string().optional().nullable(),
    }).optional().nullable(),
    staircaseScore: z.number().optional().nullable().transform(v => v ?? undefined),
    avgSurveyScore: z.number().optional().nullable().transform(v => v ?? undefined),
    overallRank: z.number(),
  })),
  surveyAnalysis: coercedStringOptional,
  insights: coercedString,
  recommendations: coercedStringOptional,
});

// Schema for validating AI-generated personalized results
const PersonalizedResultSchema = z.object({
  personalSummary: coercedString,
  alignmentScore: z.number().min(0).max(100),
  topContributions: z.array(z.object({
    noteId: z.union([z.string(), z.number()]).nullable().transform(v => (v !== null && v !== undefined) ? String(v) : null),
    content: z.string(),
    impact: z.string(),
  })),
  insights: coercedString,
  recommendations: coercedStringOptional,
});

/**
 * Generate cohort results using GPT-5
 */
export async function generateCohortResults(
  spaceId: string,
  generatedBy: string
): Promise<CohortResult> {
  // We need notes-count first because the SQL Borda aggregation depends on
  // it (rank is clamped to [1, totalNotes]). So fetch the workspace-scoped
  // tables that are independent of that count first, in parallel.
  type ModuleRow = { moduleType: string; enabled: boolean };
  type CategoryRow = { id: string; name: string };
  const [spaceRow, enabledModulesData, allNotes, allCategories] = await Promise.all([
    db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1),
    db.select().from(workspaceModules).where(and(
      eq(workspaceModules.spaceId, spaceId),
      eq(workspaceModules.enabled, true),
    )) as Promise<ModuleRow[]>,
    db.select().from(notes).where(eq(notes.spaceId, spaceId)),
    db.select().from(categories).where(eq(categories.spaceId, spaceId)) as Promise<CategoryRow[]>,
  ]);
  const [space] = spaceRow;

  if (!space) {
    throw new Error("Workspace not found");
  }

  const enabledModuleTypes = enabledModulesData.map((m) => m.moduleType);
  const hasPairwiseVoting = enabledModuleTypes.includes('pairwise-voting');
  const hasStackRanking = enabledModuleTypes.includes('stack-ranking');
  const hasMarketplace = enabledModuleTypes.includes('marketplace');
  const hasSurvey = enabledModuleTypes.includes('survey');
  const hasPriorityMatrix = enabledModuleTypes.includes('priority-matrix');
  const hasStaircase = enabledModuleTypes.includes('staircase');
  const hasStarship = enabledModuleTypes.includes('starship');
  const hasSignal = enabledModuleTypes.includes('signal');

  const noteCount = allNotes.length;

  const categoryMap = new Map<string, string>();
  allCategories.forEach((cat) => {
    categoryMap.set(cat.id, cat.name);
  });

  // Now fetch all aggregate-shaped per-module data in parallel. Pushing
  // SUM/COUNT into Postgres means the cohort-results pipeline is O(notes)
  // payload regardless of cohort size, instead of streaming every vote /
  // ranking / allocation / survey response back into Node.
  type MatrixRow = {
    id: string; xAxisLabel: string; yAxisLabel: string;
  };
  type StaircaseRow = {
    id: string; minLabel: string; maxLabel: string; minScore: number; maxScore: number;
  };
  type SurveyQuestionRow = { id: string; questionText: string; sortOrder: number };
  type StarshipRow = { id: string; thrustLabel: string; destinationLabel: string; dragLabel: string };
  type SignalActivityRow = { id: string; type: string; prompt: string; orderIndex: number; config: unknown };
  type SignalResponseRow = { activityId: string; valueText: string | null; valueNumber: number | null; optionId: string | null };
  const [
    pairwiseTallies,
    rankingAggregates,
    rankingParticipantCounts,
    marketplaceTallies,
    surveyAggregates,
    matrixRow,
    staircaseRow,
    surveyQuestionsRows,
    starshipRow,
    signalActivitiesRows,
    signalResponsesRows,
  ] = await Promise.all([
    storage.getPairwiseTalliesBySpace(spaceId),
    noteCount > 0 ? storage.getRankingAggregatesBySpace(spaceId, noteCount) : Promise.resolve([]),
    // Distinct ranking-participant count for the analytics narrative —
    // preserves the legacy "Total Rankings Submitted" semantics (one row
    // per participant, not per ranking row).
    storage.getRankingCountsByParticipant(spaceId),
    storage.getMarketplaceTalliesBySpace(spaceId),
    hasSurvey
      ? storage.getSurveyAggregatesBySpace(spaceId)
      : Promise.resolve({ perNote: [], perNoteQuestion: [] }),
    hasPriorityMatrix
      ? (db.select().from(priorityMatrices).where(eq(priorityMatrices.spaceId, spaceId)).limit(1) as Promise<MatrixRow[]>)
      : Promise.resolve<MatrixRow[]>([]),
    hasStaircase
      ? (db.select().from(staircaseModules).where(eq(staircaseModules.spaceId, spaceId)).limit(1) as Promise<StaircaseRow[]>)
      : Promise.resolve<StaircaseRow[]>([]),
    hasSurvey
      ? (db.select().from(surveyQuestions).where(eq(surveyQuestions.spaceId, spaceId)) as Promise<SurveyQuestionRow[]>)
      : Promise.resolve<SurveyQuestionRow[]>([]),
    hasStarship
      ? (db.select().from(starships).where(eq(starships.spaceId, spaceId)).limit(1) as Promise<StarshipRow[]>)
      : Promise.resolve<StarshipRow[]>([]),
    hasSignal
      ? (db.select({ id: signalActivities.id, type: signalActivities.type, prompt: signalActivities.prompt, orderIndex: signalActivities.orderIndex, config: signalActivities.config }).from(signalActivities).where(eq(signalActivities.spaceId, spaceId)) as Promise<SignalActivityRow[]>)
      : Promise.resolve<SignalActivityRow[]>([]),
    hasSignal
      ? (db.select({ activityId: signalResponses.activityId, valueText: signalResponses.valueText, valueNumber: signalResponses.valueNumber, optionId: signalResponses.optionId }).from(signalResponses).where(eq(signalResponses.spaceId, spaceId)) as Promise<SignalResponseRow[]>)
      : Promise.resolve<SignalResponseRow[]>([]),
  ]);

  // Aggregate-derived per-note score Maps. Pre-filter against the *current*
  // note set so deleted notes don't contribute to combined-score maxes.
  const currentNoteIds = new Set(allNotes.map((n) => n.id));
  const pairwiseWins = new Map<string, number>();
  for (const t of pairwiseTallies) {
    if (currentNoteIds.has(t.noteId)) pairwiseWins.set(t.noteId, t.wins);
  }
  const bordaScores = new Map<string, number>();
  for (const a of rankingAggregates) {
    if (currentNoteIds.has(a.noteId)) bordaScores.set(a.noteId, a.totalScore);
  }
  const marketplaceCoins = new Map<string, number>();
  for (const t of marketplaceTallies) {
    if (currentNoteIds.has(t.noteId)) marketplaceCoins.set(t.noteId, t.totalCoins);
  }

  const matrix = matrixRow[0];
  const staircase = staircaseRow[0];
  const starship = starshipRow[0];

  // Priority Matrix + Staircase + Starship positions fan out in parallel once
  // we know their parent module rows exist.
  type MatrixPosRow = { noteId: string; xCoord: number; yCoord: number };
  type StaircasePosRow = { noteId: string; score: number };
  type StarshipPosRow = { noteId: string; zone: string };
  const [matrixPositions, stPositions, starshipPosRows] = await Promise.all([
    matrix
      ? (db.select().from(priorityMatrixPositions).where(eq(priorityMatrixPositions.matrixId, matrix.id)) as Promise<MatrixPosRow[]>)
      : Promise.resolve<MatrixPosRow[]>([]),
    staircase
      ? (db.select().from(staircasePositions).where(eq(staircasePositions.staircaseId, staircase.id)) as Promise<StaircasePosRow[]>)
      : Promise.resolve<StaircasePosRow[]>([]),
    starship
      ? (db.select({ noteId: starshipPositions.noteId, zone: starshipPositions.zone }).from(starshipPositions).where(eq(starshipPositions.starshipId, starship.id)) as Promise<StarshipPosRow[]>)
      : Promise.resolve<StarshipPosRow[]>([]),
  ]);

  // Priority Matrix
  const matrixPositionsByNote = new Map<string, { x: number; y: number }>();
  let matrixXLabel = 'Impact';
  let matrixYLabel = 'Effort';
  if (matrix) {
    matrixXLabel = matrix.xAxisLabel;
    matrixYLabel = matrix.yAxisLabel;
    matrixPositions.forEach((pos) => {
      matrixPositionsByNote.set(pos.noteId, {
        x: Math.round(pos.xCoord * 100),
        y: Math.round(pos.yCoord * 100),
      });
    });
  }

  // Staircase
  const staircaseScoresByNote = new Map<string, number>();
  let staircaseMinLabel = 'Lowest';
  let staircaseMaxLabel = 'Highest';
  let staircaseMinScore = 0;
  let staircaseMaxScore = 10;
  if (staircase) {
    staircaseMinLabel = staircase.minLabel;
    staircaseMaxLabel = staircase.maxLabel;
    staircaseMinScore = staircase.minScore;
    staircaseMaxScore = staircase.maxScore;
    stPositions.forEach((pos) => {
      staircaseScoresByNote.set(pos.noteId, pos.score);
    });
  }

  // Starship: build zone → note[] map for the AI summary.
  const starshipZoneByNote = new Map<string, string>(); // noteId → zone
  const starshipZoneCounts: Record<string, number> = { thrust: 0, destination: 0, drag: 0 };
  let starshipThrustLabel = 'Propulsion';
  let starshipDestLabel = 'Destinations';
  let starshipDragLabel = 'Black Holes';
  if (starship) {
    starshipThrustLabel = starship.thrustLabel;
    starshipDestLabel = starship.destinationLabel;
    starshipDragLabel = starship.dragLabel;
    for (const pos of starshipPosRows) {
      starshipZoneByNote.set(pos.noteId, pos.zone);
      if (pos.zone in starshipZoneCounts) starshipZoneCounts[pos.zone as keyof typeof starshipZoneCounts]++;
    }
  }

  // Signal: aggregate responses per activity for the AI summary.
  // For word-cloud: top-10 words by frequency.
  // For multiple-choice: option counts (labels come from activity config).
  // For numeric: mean response.
  type SignalActivitySummary = {
    orderIndex: number; type: string; prompt: string;
    wordFreqs?: Array<{ word: string; count: number }>;
    optionCounts?: Array<{ label: string; count: number }>;
    numericMean?: number; numericCount?: number;
    responseCount: number;
  };
  const signalActivitySummaries: SignalActivitySummary[] = [];
  if (hasSignal && signalActivitiesRows.length > 0) {
    // Group responses by activityId.
    const responsesByActivity = new Map<string, typeof signalResponsesRows>();
    for (const r of signalResponsesRows) {
      let bucket = responsesByActivity.get(r.activityId);
      if (!bucket) { bucket = []; responsesByActivity.set(r.activityId, bucket); }
      bucket.push(r);
    }
    for (const act of [...signalActivitiesRows].sort((a, b) => a.orderIndex - b.orderIndex)) {
      const responses = responsesByActivity.get(act.id) ?? [];
      const summary: SignalActivitySummary = { orderIndex: act.orderIndex, type: act.type, prompt: act.prompt, responseCount: responses.length };
      if (act.type === 'word-cloud') {
        const freq = new Map<string, number>();
        for (const r of responses) {
          if (r.valueText) { const w = r.valueText.trim().toLowerCase(); freq.set(w, (freq.get(w) ?? 0) + 1); }
        }
        summary.wordFreqs = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([word, count]) => ({ word, count }));
      } else if (act.type === 'multiple-choice') {
        const cfg = act.config as { options?: Array<{ id: string; text: string }> } ?? {};
        const optionMap = new Map<string, string>((cfg.options ?? []).map(o => [o.id, o.text]));
        const counts = new Map<string, number>();
        for (const r of responses) {
          if (r.optionId) counts.set(r.optionId, (counts.get(r.optionId) ?? 0) + 1);
        }
        summary.optionCounts = [...counts.entries()]
          .map(([id, count]) => ({ label: optionMap.get(id) ?? id, count }))
          .sort((a, b) => b.count - a.count);
      } else if (act.type === 'numeric') {
        const nums = responses.map(r => r.valueNumber).filter((v): v is number => v != null);
        if (nums.length > 0) {
          summary.numericMean = nums.reduce((a, b) => a + b, 0) / nums.length;
          summary.numericCount = nums.length;
        }
      }
      signalActivitySummaries.push(summary);
    }
  }

  // Survey: derive per-note + per-(note,question) averages from SQL aggregates.
  // We MUST compute the per-note average from perNoteQuestion filtered by the
  // current question set (same semantics as the legacy raw-row pipeline that
  // dropped responses tied to deleted/invalid questions). Using the raw
  // perNote aggregate would let stale-question responses leak into combined
  // scores.
  const surveyAvgByNote = new Map<string, number>();
  const surveyQuestionsList: { id: string; questionText: string; sortOrder: number }[] = [];
  const surveyQuestionAverages = new Map<string, Map<string, number>>(); // questionId -> noteId -> avg
  if (hasSurvey) {
    surveyQuestionsRows.forEach((q) =>
      surveyQuestionsList.push({ id: q.id, questionText: q.questionText, sortOrder: q.sortOrder }),
    );
    surveyQuestionsList.sort((a, b) => a.sortOrder - b.sortOrder);

    const currentQuestionIds = new Set(surveyQuestionsList.map((q) => q.id));
    const noteSurveyTotals = new Map<string, { sum: number; count: number }>();
    for (const a of surveyAggregates.perNoteQuestion) {
      if (a.count <= 0 || !currentNoteIds.has(a.noteId) || !currentQuestionIds.has(a.questionId)) continue;
      let qMap = surveyQuestionAverages.get(a.questionId);
      if (!qMap) {
        qMap = new Map<string, number>();
        surveyQuestionAverages.set(a.questionId, qMap);
      }
      qMap.set(a.noteId, a.sum / a.count);
      const tot = noteSurveyTotals.get(a.noteId) ?? { sum: 0, count: 0 };
      tot.sum += a.sum;
      tot.count += a.count;
      noteSurveyTotals.set(a.noteId, tot);
    }
    noteSurveyTotals.forEach((tot, noteId) => {
      if (tot.count > 0) surveyAvgByNote.set(noteId, tot.sum / tot.count);
    });
  }

  // Determine which scoring modules have data and build dynamic combined score
  const activeModules: { name: string; getScore: (noteId: string) => number; maxVal: number }[] = [];

  if (hasPairwiseVoting && pairwiseWins.size > 0) {
    const maxPairwise = Math.max(...Array.from(pairwiseWins.values()), 0);
    if (maxPairwise > 0) {
      activeModules.push({ name: 'pairwise', getScore: (id) => pairwiseWins.get(id) || 0, maxVal: maxPairwise });
    }
  }
  if (hasStackRanking && bordaScores.size > 0) {
    const maxBorda = Math.max(...Array.from(bordaScores.values()), 0);
    if (maxBorda > 0) {
      activeModules.push({ name: 'borda', getScore: (id) => bordaScores.get(id) || 0, maxVal: maxBorda });
    }
  }
  if (hasMarketplace && marketplaceCoins.size > 0) {
    const maxCoins = Math.max(...Array.from(marketplaceCoins.values()), 0);
    if (maxCoins > 0) {
      activeModules.push({ name: 'marketplace', getScore: (id) => marketplaceCoins.get(id) || 0, maxVal: maxCoins });
    }
  }
  if (hasPriorityMatrix && matrixPositionsByNote.size > 0) {
    activeModules.push({ name: 'matrix', getScore: (id) => matrixPositionsByNote.get(id)?.x || 0, maxVal: 100 });
  }
  if (hasStaircase && staircaseScoresByNote.size > 0) {
    const maxStaircase = staircaseMaxScore > 0 ? staircaseMaxScore : 10;
    activeModules.push({ name: 'staircase', getScore: (id) => staircaseScoresByNote.get(id) || 0, maxVal: maxStaircase });
  }
  if (hasSurvey && surveyAvgByNote.size > 0) {
    activeModules.push({ name: 'survey', getScore: (id) => surveyAvgByNote.get(id) || 0, maxVal: 5 });
  }

  const moduleWeight = activeModules.length > 0 ? 1 / activeModules.length : 1;

  // Combine all scoring data with dynamic weighting
  const notesWithScores = allNotes.map((note: any) => {
    let combinedScore = 0;
    if (activeModules.length > 0) {
      combinedScore = activeModules.reduce((sum, mod) => {
        return sum + (mod.getScore(note.id) / mod.maxVal) * moduleWeight;
      }, 0);
    }
    return {
      ...note,
      pairwiseWins: pairwiseWins.get(note.id) || 0,
      bordaScore: bordaScores.get(note.id) || 0,
      marketplaceCoins: marketplaceCoins.get(note.id) || 0,
      staircaseScore: staircaseScoresByNote.get(note.id),
      avgSurveyScore: surveyAvgByNote.get(note.id),
      matrixPosition: matrixPositionsByNote.has(note.id) ? {
        ...matrixPositionsByNote.get(note.id)!,
        xLabel: matrixXLabel,
        yLabel: matrixYLabel,
      } : undefined,
      combinedScore,
    };
  });

  // Sort by combined score with deterministic tiebreakers
  notesWithScores.sort((a: any, b: any) => {
    const scoreDiff = b.combinedScore - a.combinedScore;
    if (Math.abs(scoreDiff) > 0.0001) return scoreDiff;
    const contentCmp = (a.content || '').localeCompare(b.content || '');
    if (contentCmp !== 0) return contentCmp;
    return (a.id || '').localeCompare(b.id || '');
  });

  // FTS query from workspace purpose + a deterministic sample of notes
  // (sorted by id) so the KB grounding inputs hash is reproducible by
  // getCurrentCohortInputsHash without re-deriving combined scores.
  const kbQueryNotes = [...allNotes]
    .sort((a: any, b: any) => a.id.localeCompare(b.id))
    .slice(0, 12)
    .map((n: any) => n.content || '');
  const queryTerms = [space.purpose || '', ...kbQueryNotes].join(' ').slice(0, 4000);

  const kbChunks = queryTerms.trim().length > 0
    ? await storage.searchKnowledgeBaseChunks({
        query: queryTerms,
        spaceId,
        organizationId: space.organizationId ?? undefined,
        includeSystem: true,
        limit: 8,
      })
    : [];

  const kbContext = kbChunks.length > 0
    ? `\n\nKNOWLEDGE BASE CONTEXT — ${kbChunks.length} excerpt(s) retrieved from the organisation's grounding documents.\nYou MUST anchor your analysis, insights, and recommendations in this material. Quote or reference specific concepts, frameworks, or terminology from these excerpts where relevant. Do not ignore this content.\n${kbChunks
        .map((c, i) => `[KB${i + 1}] ${sanitizeForPrompt(c.documentTitle, 200)}\n${sanitizeForPrompt(c.content.replace(/\s+/g, ' '), 1000)}`)
        .join('\n\n')}`
    : '';

  // Hash over every prompt-affecting input; cache invalidates on any change.
  const cohortInputs: CohortInputs = {
    spaceId,
    workspaceName: space.name ?? null,
    workspacePurpose: space.purpose ?? null,
    enabledModules: enabledModuleTypes,
    matrixAxes: hasPriorityMatrix
      ? { xLabel: matrixXLabel, yLabel: matrixYLabel }
      : null,
    staircaseConfig: hasStaircase
      ? {
          label: `${staircaseMinLabel}|${staircaseMaxLabel}`,
          minScore: staircaseMinScore,
          maxScore: staircaseMaxScore,
        }
      : null,
    surveyQuestions: surveyQuestionsList.map((q) => ({
      id: q.id,
      text: q.questionText,
      order: q.sortOrder,
    })),
    categories: allCategories.map((c) => ({ id: c.id, name: c.name })),
    notes: allNotes.map((n) => ({ id: n.id, content: n.content, manualCategoryId: n.manualCategoryId ?? null })),
    // Aggregate-based hash inputs: any change in raw rows that affects
    // these tallies will change the hash and invalidate the cached result.
    pairwiseTallies: pairwiseTallies.filter((t) => currentNoteIds.has(t.noteId)),
    rankingAggregates: rankingAggregates.filter((a) => currentNoteIds.has(a.noteId)),
    marketplaceTallies: marketplaceTallies.filter((t) => currentNoteIds.has(t.noteId)),
    matrixPositions: Array.from(matrixPositionsByNote.entries()).map(([noteId, p]) => ({ noteId, xCoord: p.x, yCoord: p.y })),
    staircasePositions: Array.from(staircaseScoresByNote.entries()).map(([noteId, score]) => ({ noteId, score })),
    surveyAggregates: hasSurvey
      ? surveyAggregates.perNoteQuestion.filter((a) => currentNoteIds.has(a.noteId))
      : [],
    kbChunkIds: kbChunks.map((c) => c.id),
    kbContentHash: hashKbChunkContents(kbChunks.map((c) => ({ id: c.id, content: c.content }))),
    signalResponses: hasSignal
      ? signalResponsesRows.map((r) => ({
          activityId: r.activityId,
          valueText: r.valueText,
          valueNumber: r.valueNumber,
          optionId: r.optionId,
        }))
      : [],
  };
  const inputsHash = computeCohortInputsHash(cohortInputs);

  const cached = await findCachedCohortResult(spaceId, inputsHash);
  if (cached) {
    // Track the cache hit so we can report token savings.
    await logAiUsage({
      organizationId: space.organizationId ?? undefined,
      spaceId,
      userId: generatedBy,
      modelName: 'gpt-4o',
      operation: 'cohort-results-cache-hit',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: { cacheHit: true, cohortResultId: cached.id, inputsHash },
    });
    return cached;
  }

  // Build module-aware data summary
  const enabledModulesDescription = [
    enabledModuleTypes.includes('ideation') && 'Ideation (collaborative idea capture)',
    hasPairwiseVoting && 'Pairwise Voting',
    hasStackRanking && 'Stack Ranking (Borda Count)',
    hasMarketplace && 'Marketplace Allocation',
    hasSurvey && 'Survey',
    hasPriorityMatrix && '2x2 Priority Matrix',
    hasStaircase && 'Staircase Rating',
    hasStarship && 'Starship Envisioning (zone-based idea placement)',
    hasSignal && 'Signal (live audience interaction)',
  ].filter(Boolean).join(', ');

  // Sanitize all user-controlled fields. The structured analytics shape is
  // preserved (numbers are not user-controlled) but every free-text value is
  // length-capped, control-char stripped, and delimiter-neutralized so it
  // cannot break out of the data block below.
  const sfShort = (v: unknown) => sanitizeForPrompt(v, 200);
  const sfNote = (v: unknown) => sanitizeForPrompt(v, 2000);
  const sfQuestion = (v: unknown) => sanitizeForPrompt(v, 500);

  // Prepare data summary for AI. The entire block is wrapped in an
  // UNTRUSTED_INPUT envelope and the system message instructs the model to
  // treat anything inside it as data, not instructions.
  const dataSummary = `${wrapUntrusted(
    `Workspace: ${sfShort(space.name)}
Purpose: ${sanitizeForPrompt(space.purpose, 2000)}

ENABLED MODULES: ${enabledModulesDescription || 'Ideation only'}
(Only discuss the modules that were enabled. Do NOT mention or analyze modules that were not used.)
${kbContext}

Total Ideas: ${allNotes.length}
${hasPairwiseVoting ? `Total Pairwise Votes: ${pairwiseTallies.reduce((s, t) => s + t.wins, 0)}` : ''}
${hasStackRanking ? `Total Rankings Submitted: ${rankingParticipantCounts.length}` : ''}
${hasMarketplace ? `Total Marketplace Allocations: ${marketplaceTallies.reduce((s, t) => s + t.participantCount, 0)}` : ''}
${hasPriorityMatrix ? `Priority Matrix Axes: X="${sfShort(matrixXLabel)}" (0=Low, 100=High), Y="${sfShort(matrixYLabel)}" (0=Low, 100=High)
Notes positioned on matrix: ${matrixPositionsByNote.size}` : ''}
${hasStaircase ? `Staircase Scale: ${staircaseMinScore} (${sfShort(staircaseMinLabel)}) to ${staircaseMaxScore} (${sfShort(staircaseMaxLabel)})
Notes rated on staircase: ${staircaseScoresByNote.size}` : ''}
${hasSurvey && surveyQuestionsList.length > 0 ? `Survey Questions (participants rated each idea 1-5 on these):
${surveyQuestionsList.map((q, i) => `  Q${i + 1}: ${sfQuestion(q.questionText)}`).join('\n')}
Total survey responses: ${surveyAvgByNote.size} ideas rated` : ''}
${hasStarship && starship ? `
STARSHIP ENVISIONING — Zone breakdown:
  Zone "${sfShort(starshipThrustLabel)}" (Propulsion — drivers/enablers): ${starshipZoneCounts.thrust} idea(s)
  Zone "${sfShort(starshipDestLabel)}" (Destinations — goals/outcomes): ${starshipZoneCounts.destination} idea(s)
  Zone "${sfShort(starshipDragLabel)}" (Black Holes — blockers/barriers): ${starshipZoneCounts.drag} idea(s)
  Total ideas placed: ${starshipPosRows.length}` : ''}
${hasSignal && signalActivitySummaries.length > 0 ? `
SIGNAL (LIVE INTERACTION) — ${signalActivitySummaries.length} activit${signalActivitySummaries.length === 1 ? 'y' : 'ies'}:
${signalActivitySummaries.map((a, i) => `Activity ${i + 1} [${a.type}]: "${sfQuestion(a.prompt)}" — ${a.responseCount} response(s)${a.wordFreqs && a.wordFreqs.length > 0 ? `\n  Top words: ${a.wordFreqs.map(w => `"${sfShort(w.word)}" (${w.count})`).join(', ')}` : ''}${a.optionCounts && a.optionCounts.length > 0 ? `\n  Results: ${a.optionCounts.map(o => `"${sfShort(o.label)}" → ${o.count}`).join(', ')}` : ''}${a.numericMean != null ? `\n  Mean score: ${a.numericMean.toFixed(2)} (${a.numericCount} responses)` : ''}`).join('\n')}` : ''}

${allNotes.length > 0 ? `All Ideas Ranked by Combined Score:
${notesWithScores.map((note: any, idx: any) => `
${idx + 1}. "${sfNote(note.content)}" (Category: ${note.manualCategoryId ? sfShort(categoryMap.get(note.manualCategoryId) || 'Uncategorized') : 'Uncategorized'})${hasStarship && starshipZoneByNote.has(note.id) ? `
   - Starship Zone: ${starshipZoneByNote.get(note.id) === 'thrust' ? sfShort(starshipThrustLabel) : starshipZoneByNote.get(note.id) === 'destination' ? sfShort(starshipDestLabel) : sfShort(starshipDragLabel)}` : ''}${hasPairwiseVoting ? `
   - Pairwise Wins: ${note.pairwiseWins}` : ''}${hasStackRanking ? `
   - Borda Score: ${note.bordaScore}` : ''}${hasMarketplace ? `
   - Marketplace Coins: ${note.marketplaceCoins}` : ''}${hasPriorityMatrix && matrixPositionsByNote.has(note.id) ? `
   - Matrix Position: ${sfShort(matrixXLabel)}=${matrixPositionsByNote.get(note.id)!.x}%, ${sfShort(matrixYLabel)}=${matrixPositionsByNote.get(note.id)!.y}% (${matrixPositionsByNote.get(note.id)!.x > 50 ? 'High' : 'Low'} ${sfShort(matrixXLabel)}, ${matrixPositionsByNote.get(note.id)!.y > 50 ? 'High' : 'Low'} ${sfShort(matrixYLabel)})` : ''}${hasStaircase && staircaseScoresByNote.has(note.id) ? `
   - Staircase Score: ${staircaseScoresByNote.get(note.id)} / ${staircaseMaxScore}` : ''}${hasSurvey && surveyAvgByNote.has(note.id) ? `
   - Avg Survey Score: ${surveyAvgByNote.get(note.id)!.toFixed(2)} / 5${surveyQuestionsList.map(q => {
      const qAvg = surveyQuestionAverages.get(q.id)?.get(note.id);
      return qAvg != null ? `\n     - "${sfQuestion(q.questionText)}": ${qAvg.toFixed(2)}/5` : '';
    }).join('')}` : ''}
   - Combined Score: ${note.combinedScore.toFixed(3)}
`).join('')}

All Ideas Grouped by Category:
${Object.entries(
    allNotes.reduce((acc: any, note: any) => {
      const cat = note.manualCategoryId ? categoryMap.get(note.manualCategoryId) || 'Uncategorized' : 'Uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(note.content);
      return acc;
    }, {} as Record<string, string[]>)
  ).map(([category, ideas]: any) => `
${sfShort(category)} (${ideas.length} ideas):
${ideas.map((idea: any) => `  - ${sfNote(idea)}`).join('\n')}
`).join('\n')}` : '(No ideas were captured in this session — analysis is based on Signal and/or Starship interaction data above.)'}`,
    80000,
  )}`;

  // Generate results using GPT-5
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert facilitator analyzing collaborative envisioning session results. Generate comprehensive cohort insights grounded in the session data AND any provided knowledge base material.

KNOWLEDGE BASE GROUNDING (most important rule):
- If a KNOWLEDGE BASE CONTEXT block is present in the data, you MUST use it. Your summary, insights, and recommendations must draw on the specific concepts, frameworks, terminology, and strategic context from those excerpts.
- Reference knowledge base material explicitly — cite document titles (e.g. "As outlined in [document name]...") when it is relevant to a finding or recommendation.
- Do NOT produce generic analysis that could apply to any organisation. Ground every recommendation in both the session data AND the knowledge base content.

CRITICAL FORMATTING RULES:
1. Only discuss and analyze the modules that were ENABLED for this session. Do NOT mention modules that were not used.
2. Use clear paragraph breaks (\\n\\n) between distinct points for readability.
3. For recommendations, format as a numbered list with each recommendation on its own line.
4. Keep summaries focused on what WAS done, not what wasn't.

${PROMPT_INJECTION_GUARD}`,
      },
      {
        role: "user",
        content: `Analyze the following envisioning session data and generate cohort results:

${dataSummary}

Please provide your analysis in the following JSON format:
{
  "summary": "A 2-3 paragraph high-level summary of the session outcomes. Use \\n\\n between paragraphs. Focus only on the modules that were enabled - do not mention or analyze modules that were not used.",
  "keyThemes": ["theme1", "theme2", "theme3", ...],
  "topIdeas": [
    {
      "noteId": "id",
      "content": "idea text",
      "category": "category name or null",
      ${hasPairwiseVoting ? '"pairwiseWins": number,' : ''}
      ${hasStackRanking ? '"bordaScore": number,' : ''}
      ${hasMarketplace ? '"marketplaceCoins": number,' : ''}
      ${hasPriorityMatrix ? '"matrixPosition": {"x": number, "y": number, "xLabel": "' + matrixXLabel + '", "yLabel": "' + matrixYLabel + '"} or null,' : ''}
      ${hasStaircase ? '"staircaseScore": number or null,' : ''}
      ${hasSurvey ? '"avgSurveyScore": number or null,' : ''}
      "overallRank": number (1-based rank)
    }
  ],
  ${hasSurvey ? '"surveyAnalysis": "A paragraph analyzing survey response patterns across questions and ideas. What dimensions scored highest/lowest? Any surprising patterns?",' : ''}
  "insights": "3-4 paragraphs of deep insights about patterns, alignment, diversity of thought, and key findings. Use \\n\\n between paragraphs for readability. Focus only on enabled modules.${hasPriorityMatrix ? ' Include analysis of where ideas fall on the priority matrix quadrants.' : ''}${hasStaircase ? ' Include analysis of staircase rating distributions.' : ''}${hasSurvey ? ' Include analysis of survey response patterns.' : ''}${hasStarship ? ' Include analysis of how ideas were distributed across the three Starship zones (Propulsion/Destinations/Black Holes) and what that reveals about the group\'s strategic thinking.' : ''}${hasSignal ? ' Include analysis of the live Signal interaction results — key themes from word clouds, patterns in multiple-choice selections, and numeric response averages.' : ''}",
  "recommendations": "Format as a numbered list:\\n\\n1. First recommendation\\n\\n2. Second recommendation\\n\\n3. Third recommendation\\n\\nEach recommendation must be actionable and specific. Where a KNOWLEDGE BASE CONTEXT block was provided, every recommendation must explicitly connect to or build upon concepts from that material — name the relevant framework, principle, or approach from the knowledge base."
}

${allNotes.length > 0 ? 'Include ALL ideas in the topIdeas array, ranked by combined score (highest to lowest). IMPORTANT: "noteId" must always be the exact idea ID string from the data above — never null or omitted. Only include optional module-specific fields (pairwiseWins, bordaScore, etc.) for modules that were enabled; omit or set to null only those optional numeric fields when an idea has no data for that module.' : 'This session has no captured ideas — set topIdeas to an empty array []. Base your summary, keyThemes, insights, and recommendations entirely on the Signal and/or Starship interaction data provided above.'}
${kbChunks.length > 0 ? `\nIMPORTANT: ${kbChunks.length} knowledge base excerpt(s) are embedded in the session data above under "KNOWLEDGE BASE CONTEXT". You must ground your analysis in this material — do not ignore it.` : ''}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const rawResponse = completion.choices[0].message.content;
  if (!rawResponse) {
    throw new Error("Empty response from OpenAI");
  }

  // Parse and validate AI response
  const parsed = JSON.parse(rawResponse);
  const validatedRaw = CohortResultSchema.parse(parsed);
  // Guard against the AI incorrectly setting noteId to null (e.g. in Starship-only spaces)
  const validated = {
    ...validatedRaw,
    topIdeas: validatedRaw.topIdeas.filter((idea): idea is typeof idea & { noteId: string } => idea.noteId !== null),
  };

  // Track AI token usage for cost monitoring.
  const usage = extractUsageMetrics(completion);
  if (usage) {
    await logAiUsage({
      organizationId: space.organizationId ?? undefined,
      spaceId,
      userId: generatedBy,
      modelName: 'gpt-4o',
      operation: 'cohort-results',
      usage,
      metadata: {
        cacheHit: false,
        kbChunks: kbChunks.length,
        inputsHash,
      },
    });
  }

  // Save to database
  const [cohortResult] = await db
    .insert(cohortResults)
    .values({
      spaceId,
      generatedBy,
      summary: validated.summary,
      keyThemes: validated.keyThemes,
      topIdeas: validated.topIdeas,
      insights: validated.insights,
      recommendations: validated.recommendations || null,
      signalSummary: signalActivitySummaries.length > 0 ? signalActivitySummaries : null,
      inputsHash,
      metadata: {
        totalNotes: allNotes.length,
        totalVotes: pairwiseTallies.reduce((s, t) => s + t.wins, 0),
        totalRankings: rankingAggregates.reduce((s, a) => s + a.count, 0),
        totalAllocations: marketplaceTallies.reduce((s, t) => s + t.participantCount, 0),
        kbChunks: kbChunks.length,
        kbChunkIds: kbChunks.map((c) => c.id),
        generatedAt: new Date().toISOString(),
      },
    })
    .returning();

  return cohortResult;
}

/**
 * Format a participant's Signal responses into a readable prompt block.
 * Returns an empty string when the participant has no Signal responses.
 */
function buildParticipantSignalContext(
  participantResponses: Array<{ activityId: string; valueText: string | null; valueNumber: number | null; optionId: string | null }>,
  activities: Array<{ id: string; type: string; prompt: string; orderIndex: number; config: unknown }>,
  sfShort: (v: unknown) => string,
): string {
  if (participantResponses.length === 0) return '';
  const actMap = new Map(activities.map((a) => [a.id, a]));
  // Group responses by activity.
  const byActivity = new Map<string, typeof participantResponses>();
  for (const r of participantResponses) {
    const bucket = byActivity.get(r.activityId) ?? [];
    bucket.push(r);
    byActivity.set(r.activityId, bucket);
  }
  const lines: string[] = ['\nSignal (Live Interaction) — Participant Responses:'];
  const sortedActIds = [...byActivity.keys()].sort((a, b) => {
    const oa = actMap.get(a)?.orderIndex ?? 0;
    const ob = actMap.get(b)?.orderIndex ?? 0;
    return oa - ob;
  });
  for (const actId of sortedActIds) {
    const act = actMap.get(actId);
    if (!act) continue;
    const responses = byActivity.get(actId)!;
    if (act.type === 'word-cloud') {
      const words = responses.map((r) => r.valueText).filter(Boolean).map((w) => sfShort(w));
      lines.push(`  - Word Cloud "${sfShort(act.prompt)}": submitted word(s): ${words.join(', ') || '(none)'}`);
    } else if (act.type === 'multiple-choice') {
      const cfg = act.config as { options?: Array<{ id: string; text: string }> } ?? {};
      const optMap = new Map((cfg.options ?? []).map((o) => [o.id, o.text]));
      const labels = responses.map((r) => r.optionId ? sfShort(optMap.get(r.optionId) ?? r.optionId) : null).filter(Boolean);
      lines.push(`  - Multiple Choice "${sfShort(act.prompt)}": selected: ${labels.join(', ') || '(none)'}`);
    } else if (act.type === 'numeric') {
      const nums = responses.map((r) => r.valueNumber).filter((v): v is number => v != null);
      if (nums.length > 0) {
        lines.push(`  - Numeric "${sfShort(act.prompt)}": response: ${nums[0]}`);
      }
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Format the cohort's Signal summary for inclusion in the personalized prompt
 * so the AI can compare individual vs. cohort responses.
 */
function formatCohortSignalSummary(
  signalSummary: unknown,
  sfShort: (v: unknown) => string,
): string {
  if (!Array.isArray(signalSummary) || signalSummary.length === 0) return '(none)';
  const lines: string[] = [];
  for (const entry of signalSummary as Array<{ type: string; prompt: string; responseCount: number; wordFreqs?: Array<{ word: string; count: number }>; optionCounts?: Array<{ label: string; count: number }>; numericMean?: number; numericCount?: number }>) {
    if (entry.type === 'word-cloud' && entry.wordFreqs?.length) {
      const top = entry.wordFreqs.slice(0, 5).map((w) => `"${sfShort(w.word)}"(${w.count})`).join(', ');
      lines.push(`  - Word Cloud "${sfShort(entry.prompt)}" (${entry.responseCount} responses): top words: ${top}`);
    } else if (entry.type === 'multiple-choice' && entry.optionCounts?.length) {
      const opts = entry.optionCounts.map((o) => `"${sfShort(o.label)}"(${o.count})`).join(', ');
      lines.push(`  - Multiple Choice "${sfShort(entry.prompt)}" (${entry.responseCount} responses): ${opts}`);
    } else if (entry.type === 'numeric' && entry.numericMean != null) {
      lines.push(`  - Numeric "${sfShort(entry.prompt)}" (${entry.numericCount} responses): cohort mean ${entry.numericMean.toFixed(2)}`);
    }
  }
  return lines.join('\n') || '(none)';
}

/**
 * Generate personalized results for a specific participant
 */
export async function generatePersonalizedResults(
  spaceId: string,
  participantId: string,
  cohortResultId?: string
): Promise<PersonalizedResult> {
  // Fetch participant details
  const [participant] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId))
    .limit(1);

  if (!participant) {
    throw new Error("Participant not found");
  }

  // Fetch cohort result if provided
  let cohortResult: CohortResult | null = null;
  if (cohortResultId) {
    const [result] = await db
      .select()
      .from(cohortResults)
      .where(eq(cohortResults.id, cohortResultId))
      .limit(1);
    cohortResult = result || null;
  }

  // Fetch participant inputs first so the cache key reflects every
  // prompt-affecting input (notes/votes/rankings/allocations + cohort
  // alignment), not just identity + cohort hash.
  type SignalActRow = { id: string; type: string; prompt: string; orderIndex: number; config: unknown };
  type SignalRespRow = { activityId: string; valueText: string | null; valueNumber: number | null; optionId: string | null };
  const [participantNotes, participantVotes, participantRankings, participantAllocations, allCategories, allVotes, spaceSignalActivities, participantSignalResponses] =
    await Promise.all([
      db.select().from(notes).where(and(eq(notes.spaceId, spaceId), eq(notes.participantId, participantId))),
      db.select().from(votes).where(and(eq(votes.spaceId, spaceId), eq(votes.participantId, participantId))),
      db.select().from(rankings).where(and(eq(rankings.spaceId, spaceId), eq(rankings.participantId, participantId))),
      db.select().from(marketplaceAllocations).where(and(eq(marketplaceAllocations.spaceId, spaceId), eq(marketplaceAllocations.participantId, participantId))),
      db.select().from(categories).where(eq(categories.spaceId, spaceId)),
      db.select().from(votes).where(eq(votes.spaceId, spaceId)),
      db.select({ id: signalActivities.id, type: signalActivities.type, prompt: signalActivities.prompt, orderIndex: signalActivities.orderIndex, config: signalActivities.config }).from(signalActivities).where(eq(signalActivities.spaceId, spaceId)) as Promise<SignalActRow[]>,
      db.select({ activityId: signalResponses.activityId, valueText: signalResponses.valueText, valueNumber: signalResponses.valueNumber, optionId: signalResponses.optionId }).from(signalResponses).where(and(eq(signalResponses.spaceId, spaceId), eq(signalResponses.participantId, participantId))) as Promise<SignalRespRow[]>,
    ]);
  const categoryNameById = new Map<string, string>();
  for (const c of allCategories) categoryNameById.set(c.id, c.name);

  const winsByNote = new Map<string, number>();
  const comparisonsByNote = new Map<string, number>();
  for (const v of allVotes) {
    winsByNote.set(v.winnerNoteId, (winsByNote.get(v.winnerNoteId) ?? 0) + 1);
    comparisonsByNote.set(v.winnerNoteId, (comparisonsByNote.get(v.winnerNoteId) ?? 0) + 1);
    comparisonsByNote.set(v.loserNoteId, (comparisonsByNote.get(v.loserNoteId) ?? 0) + 1);
  }
  const noteImpact = participantNotes.map((note: any) => {
    const wins = winsByNote.get(note.id) ?? 0;
    const totalComparisons = comparisonsByNote.get(note.id) ?? 0;
    return {
      noteId: note.id,
      content: note.content,
      wins,
      totalComparisons,
      winRate: totalComparisons > 0 ? wins / totalComparisons : 0,
    };
  });
  noteImpact.sort((a: any, b: any) => b.winRate - a.winRate);

  // Recompute the workspace's *current* cohort inputs hash so the
  // personalized cache invalidates whenever any underlying cohort input
  // changes (new ideas, votes, KB docs, etc.) — not only when the
  // persisted cohort row was regenerated.
  const currentCohortInputsHash = (await getCurrentCohortInputsHash(spaceId)) ?? '';
  const personalHash = computePersonalizedInputsHash({
    spaceId,
    participantId,
    participantDisplayName: participant.displayName ?? null,
    cohortResultId: cohortResultId || null,
    cohortInputsHash: currentCohortInputsHash,
    cohortSummary: cohortResult?.summary ?? null,
    participantNotes: participantNotes.map((n: any) => ({ id: n.id, content: n.content, manualCategoryId: n.manualCategoryId ?? null })),
    participantVotes: participantVotes.map((v: any) => ({ winnerNoteId: v.winnerNoteId, loserNoteId: v.loserNoteId })),
    participantRankings: participantRankings.map((r: any) => ({ noteId: r.noteId, rank: r.rank })),
    participantAllocations: participantAllocations.map((a: any) => ({ noteId: a.noteId, coinsAllocated: a.coinsAllocated })),
    noteImpacts: noteImpact.map((n) => ({ noteId: n.noteId, wins: n.wins, totalComparisons: n.totalComparisons })),
  });
  const cachedSingle = await findCachedPersonalizedResult(spaceId, participantId, personalHash);
  if (cachedSingle) {
    await logAiUsage({
      spaceId,
      modelName: 'gpt-4o',
      operation: 'personalized-results-cache-hit',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: { cacheHit: true, personalizedResultId: cachedSingle.id, personalHash },
    });
    return cachedSingle;
  }

  // Build personalized context. All free-text values are sanitized and the
  // whole block is wrapped as untrusted data; the system message provides the
  // trust-boundary guard.
  const sfShortP = (v: unknown) => sanitizeForPrompt(v, 200);
  const sfNoteP = (v: unknown) => sanitizeForPrompt(v, 2000);

  // Format participant's Signal responses for context.
  const signalContextBlock = buildParticipantSignalContext(
    participantSignalResponses,
    spaceSignalActivities,
    sfShortP,
  );

  const personalContext = wrapUntrusted(
    `Participant: ${sfShortP(participant.displayName)}

Contributions:
- Total Ideas: ${participantNotes.length}
- Ideas by Category: ${Object.entries(
      participantNotes.reduce<Record<string, number>>((acc, note) => {
        const manualName = note.manualCategoryId
          ? categoryNameById.get(note.manualCategoryId)
          : undefined;
        const cat = manualName ?? (note as { category?: string }).category ?? 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {})
    ).map(([cat, count]) => `${sfShortP(cat)} (${count})`).join(', ')}

Engagement:
- Pairwise Votes Cast: ${participantVotes.length}
- Rankings Submitted: ${participantRankings.length > 0 ? 'Yes' : 'No'}
- Marketplace Allocations: ${participantAllocations.length > 0 ? 'Yes' : 'No'}
${signalContextBlock}
Top Contributions by Impact:
${noteImpact.slice(0, 5).map((n: any, idx: any) => `${idx + 1}. "${sfNoteP(n.content)}" - Win rate: ${(n.winRate * 100).toFixed(1)}% (${n.wins}/${n.totalComparisons})`).join('\n')}

${cohortResult ? `
Cohort Summary:
${sanitizeForPrompt(cohortResult.summary, 4000)}

Key Themes Identified:
${cohortResult.keyThemes?.map((t: string) => sfShortP(t)).join(', ') || 'None identified'}
${(cohortResult as any).signalSummary ? `\nCohort Signal Summary (for comparison with participant's own responses below):\n${formatCohortSignalSummary((cohortResult as any).signalSummary, sfShortP)}` : ''}
` : ''}`,
    40000,
  );

  // Generate personalized insights using GPT-5
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a personal coach providing tailored feedback to a participant in a collaborative envisioning session. Analyze their contributions, engagement, and alignment with the cohort to provide meaningful insights and recommendations.

${PROMPT_INJECTION_GUARD}`,
      },
      {
        role: "user",
        content: `Analyze this participant's session performance and generate personalized results:

${personalContext}

Please provide your analysis in the following JSON format:
{
  "personalSummary": "A 1-2 paragraph personalized summary of their session experience and contributions",
  "alignmentScore": number (0-100, how aligned their ideas and votes were with cohort consensus),
  "topContributions": [
    {
      "noteId": "id",
      "content": "idea text",
      "impact": "description of why this idea was impactful"
    }
  ],
  "insights": "2-3 paragraphs of personalized insights about their thinking style, contribution patterns, and engagement",
  "recommendations": "Personalized next steps and development suggestions based on their session performance"
}

Include their top 3 contributions in topContributions array.`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const rawResponse = completion.choices[0].message.content;
  if (!rawResponse) {
    throw new Error("Empty response from OpenAI");
  }

  // Parse and validate AI response
  const parsed = JSON.parse(rawResponse);
  const validated = PersonalizedResultSchema.parse(parsed);

  const personalUsage = extractUsageMetrics(completion);
  if (personalUsage) {
    await logAiUsage({
      spaceId,
      modelName: 'gpt-4o',
      operation: 'personalized-results',
      usage: personalUsage,
      metadata: { cacheHit: false, personalHash, participantId },
    });
  }

  // Save to database
  const [personalResult] = await db
    .insert(personalizedResults)
    .values({
      spaceId,
      participantId,
      cohortResultId: cohortResultId || null,
      personalSummary: validated.personalSummary,
      alignmentScore: validated.alignmentScore,
      topContributions: validated.topContributions,
      insights: validated.insights,
      recommendations: validated.recommendations || null,
      inputsHash: personalHash,
    })
    .returning();

  return personalResult;
}

/**
 * Batch generate personalized results for all participants in a workspace.
 *
 * Pre-fetches every workspace-scoped table once (participants/notes/votes/
 * rankings/marketplace_allocations + the cohort result), then groups by
 * participantId in memory so the per-participant AI loop only issues OpenAI
 * calls — no per-participant DB round-trips.
 */
export async function generateAllPersonalizedResults(
  spaceId: string,
  cohortResultId: string
): Promise<PersonalizedResult[]> {
  // Pre-batch every per-space dataset that generatePersonalizedResults needs.
  const [
    allParticipants,
    allNotes,
    allVotes,
    allRankings,
    allAllocations,
    allCategories,
    cohortResultRow,
    allSignalActivities,
    allSignalResponses,
  ] = await Promise.all([
    db.select().from(participants).where(eq(participants.spaceId, spaceId)),
    db.select().from(notes).where(eq(notes.spaceId, spaceId)),
    db.select().from(votes).where(eq(votes.spaceId, spaceId)),
    db.select().from(rankings).where(eq(rankings.spaceId, spaceId)),
    db.select().from(marketplaceAllocations).where(eq(marketplaceAllocations.spaceId, spaceId)),
    db.select().from(categories).where(eq(categories.spaceId, spaceId)),
    db.select().from(cohortResults).where(eq(cohortResults.id, cohortResultId)).limit(1),
    db.select({ id: signalActivities.id, type: signalActivities.type, prompt: signalActivities.prompt, orderIndex: signalActivities.orderIndex, config: signalActivities.config }).from(signalActivities).where(eq(signalActivities.spaceId, spaceId)) as Promise<SignalActivityBatchRow[]>,
    db.select({ activityId: signalResponses.activityId, participantId: signalResponses.participantId, valueText: signalResponses.valueText, valueNumber: signalResponses.valueNumber, optionId: signalResponses.optionId }).from(signalResponses).where(eq(signalResponses.spaceId, spaceId)),
  ]);

  const cohortResult: CohortResult | null = cohortResultRow[0] || null;
  const categoryNameById = new Map<string, string>();
  for (const c of allCategories) categoryNameById.set(c.id, c.name);

  // Group per-participant collections once so each participant lookup is O(1).
  const notesByParticipant = new Map<string, typeof allNotes>();
  for (const n of allNotes) {
    if (!n.participantId) continue;
    const list = notesByParticipant.get(n.participantId) ?? [];
    list.push(n);
    notesByParticipant.set(n.participantId, list);
  }
  const votesByParticipant = new Map<string, typeof allVotes>();
  for (const v of allVotes) {
    const list = votesByParticipant.get(v.participantId) ?? [];
    list.push(v);
    votesByParticipant.set(v.participantId, list);
  }
  const rankingsByParticipant = new Map<string, typeof allRankings>();
  for (const r of allRankings) {
    const list = rankingsByParticipant.get(r.participantId) ?? [];
    list.push(r);
    rankingsByParticipant.set(r.participantId, list);
  }
  const allocationsByParticipant = new Map<string, typeof allAllocations>();
  for (const a of allAllocations) {
    const list = allocationsByParticipant.get(a.participantId) ?? [];
    list.push(a);
    allocationsByParticipant.set(a.participantId, list);
  }

  // Group signal responses by participant.
  const signalResponsesByParticipant = new Map<string, SignalResponseBatchRow[]>();
  for (const r of allSignalResponses) {
    if (!r.participantId) continue;
    const list = signalResponsesByParticipant.get(r.participantId) ?? [];
    list.push({ activityId: r.activityId, valueText: r.valueText, valueNumber: r.valueNumber, optionId: r.optionId });
    signalResponsesByParticipant.set(r.participantId, list);
  }

  // Pre-compute global vote tallies per note (used to score every participant's
  // contributions). Avoids re-scanning allVotes for each participant.
  const winsByNote = new Map<string, number>();
  const comparisonsByNote = new Map<string, number>();
  for (const v of allVotes) {
    winsByNote.set(v.winnerNoteId, (winsByNote.get(v.winnerNoteId) ?? 0) + 1);
    comparisonsByNote.set(v.winnerNoteId, (comparisonsByNote.get(v.winnerNoteId) ?? 0) + 1);
    comparisonsByNote.set(v.loserNoteId, (comparisonsByNote.get(v.loserNoteId) ?? 0) + 1);
  }

  const results: PersonalizedResult[] = [];

  // Compute the current cohort inputs hash once for this batch so every
  // participant's personalized hash captures the workspace's live state.
  const currentCohortInputsHash = (await getCurrentCohortInputsHash(spaceId)) ?? '';

  for (const participant of allParticipants) {
    try {
      const result = await generatePersonalizedResultsFromCache({
        spaceId,
        cohortResultId,
        participant,
        cohortResult,
        currentCohortInputsHash,
        participantNotes: notesByParticipant.get(participant.id) ?? [],
        participantVotes: votesByParticipant.get(participant.id) ?? [],
        participantRankings: rankingsByParticipant.get(participant.id) ?? [],
        participantAllocations: allocationsByParticipant.get(participant.id) ?? [],
        winsByNote,
        comparisonsByNote,
        categoryNameById,
        signalActivities: allSignalActivities,
        participantSignalResponses: signalResponsesByParticipant.get(participant.id) ?? [],
      });
      results.push(result);
    } catch (error) {
      console.error(`Failed to generate results for participant ${participant.id}:`, error);
      // Continue with other participants
    }
  }

  return results;
}

type ParticipantRow = typeof participants.$inferSelect;
type NoteRow = typeof notes.$inferSelect;
type VoteRow = typeof votes.$inferSelect;
type RankingRow = typeof rankings.$inferSelect;
type AllocationRow = typeof marketplaceAllocations.$inferSelect;
type SignalActivityBatchRow = { id: string; type: string; prompt: string; orderIndex: number; config: unknown };
type SignalResponseBatchRow = { activityId: string; valueText: string | null; valueNumber: number | null; optionId: string | null };

/**
 * AI + persistence half of generatePersonalizedResults, operating purely on
 * pre-fetched data (no DB reads). Used by generateAllPersonalizedResults to
 * avoid per-participant round-trips.
 */
async function generatePersonalizedResultsFromCache(params: {
  spaceId: string;
  cohortResultId: string;
  participant: ParticipantRow;
  cohortResult: CohortResult | null;
  currentCohortInputsHash: string;
  participantNotes: NoteRow[];
  participantVotes: VoteRow[];
  participantRankings: RankingRow[];
  participantAllocations: AllocationRow[];
  winsByNote: Map<string, number>;
  comparisonsByNote: Map<string, number>;
  categoryNameById: Map<string, string>;
  signalActivities: SignalActivityBatchRow[];
  participantSignalResponses: SignalResponseBatchRow[];
}): Promise<PersonalizedResult> {
  const {
    spaceId, cohortResultId, participant, cohortResult, currentCohortInputsHash,
    participantNotes, participantVotes, participantRankings, participantAllocations,
    winsByNote, comparisonsByNote, categoryNameById,
    signalActivities, participantSignalResponses,
  } = params;

  const noteImpact = participantNotes.map((note) => {
    const wins = winsByNote.get(note.id) ?? 0;
    const totalComparisons = comparisonsByNote.get(note.id) ?? 0;
    return {
      noteId: note.id,
      content: note.content,
      wins,
      totalComparisons,
      winRate: totalComparisons > 0 ? wins / totalComparisons : 0,
    };
  });

  noteImpact.sort((a, b) => b.winRate - a.winRate);

  // Personalized hash includes participant prompt inputs so per-participant
  // edits invalidate cache even when cohort hash is unchanged.
  const personalHash = computePersonalizedInputsHash({
    spaceId,
    participantId: participant.id,
    participantDisplayName: participant.displayName ?? null,
    cohortResultId: cohortResultId || null,
    cohortInputsHash: currentCohortInputsHash,
    cohortSummary: cohortResult?.summary ?? null,
    participantNotes: participantNotes.map((n) => ({ id: n.id, content: n.content, manualCategoryId: n.manualCategoryId ?? null })),
    participantVotes: participantVotes.map((v) => ({ winnerNoteId: v.winnerNoteId, loserNoteId: v.loserNoteId })),
    participantRankings: participantRankings.map((r) => ({ noteId: r.noteId, rank: r.rank })),
    participantAllocations: participantAllocations.map((a) => ({ noteId: a.noteId, coinsAllocated: a.coinsAllocated })),
    noteImpacts: noteImpact.map((n) => ({ noteId: n.noteId, wins: n.wins, totalComparisons: n.totalComparisons })),
  });
  const cachedPersonal = await findCachedPersonalizedResult(spaceId, participant.id, personalHash);
  if (cachedPersonal) {
    await logAiUsage({
      spaceId,
      modelName: 'gpt-4o',
      operation: 'personalized-results-cache-hit',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      metadata: { cacheHit: true, personalizedResultId: cachedPersonal.id, personalHash },
    });
    return cachedPersonal;
  }

  const sfShortC = (v: unknown) => sanitizeForPrompt(v, 200);
  const sfNoteC = (v: unknown) => sanitizeForPrompt(v, 2000);

  const signalContextBlockC = buildParticipantSignalContext(
    participantSignalResponses,
    signalActivities,
    sfShortC,
  );

  const personalContext = wrapUntrusted(
    `Participant: ${sfShortC(participant.displayName)}

Contributions:
- Total Ideas: ${participantNotes.length}
- Ideas by Category: ${Object.entries(
      participantNotes.reduce<Record<string, number>>((acc, note) => {
        const manualName = note.manualCategoryId
          ? categoryNameById.get(note.manualCategoryId)
          : undefined;
        const cat = manualName ?? (note as { category?: string }).category ?? 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {})
    ).map(([cat, count]) => `${sfShortC(cat)} (${count})`).join(', ')}

Engagement:
- Pairwise Votes Cast: ${participantVotes.length}
- Rankings Submitted: ${participantRankings.length > 0 ? 'Yes' : 'No'}
- Marketplace Allocations: ${participantAllocations.length > 0 ? 'Yes' : 'No'}
${signalContextBlockC}
Top Contributions by Impact:
${noteImpact.slice(0, 5).map((n, idx) => `${idx + 1}. "${sfNoteC(n.content)}" - Win rate: ${(n.winRate * 100).toFixed(1)}% (${n.wins}/${n.totalComparisons})`).join('\n')}

${cohortResult ? `
Cohort Summary:
${sanitizeForPrompt(cohortResult.summary, 4000)}

Key Themes Identified:
${cohortResult.keyThemes?.map((t: string) => sfShortC(t)).join(', ') || 'None identified'}
${(cohortResult as any).signalSummary ? `\nCohort Signal Summary (for comparison with participant's own responses below):\n${formatCohortSignalSummary((cohortResult as any).signalSummary, sfShortC)}` : ''}
` : ''}`,
    40000,
  );

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a personal coach providing tailored feedback to a participant in a collaborative envisioning session. Analyze their contributions, engagement, and alignment with the cohort to provide meaningful insights and recommendations.

${PROMPT_INJECTION_GUARD}`,
      },
      {
        role: "user",
        content: `Analyze this participant's session performance and generate personalized results:

${personalContext}

Please provide your analysis in the following JSON format:
{
  "personalSummary": "A 1-2 paragraph personalized summary of their session experience and contributions",
  "alignmentScore": number (0-100, how aligned their ideas and votes were with cohort consensus),
  "topContributions": [
    {
      "noteId": "id",
      "content": "idea text",
      "impact": "description of why this idea was impactful"
    }
  ],
  "insights": "2-3 paragraphs of personalized insights about their thinking style, contribution patterns, and engagement${participantSignalResponses.length > 0 ? '. If Signal (Live Interaction) data is present, compare their individual responses to the cohort averages and highlight alignment or divergence.' : ''}",
  "recommendations": "Personalized next steps and development suggestions based on their session performance"
}

Include their top 3 contributions in topContributions array.`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const rawResponse = completion.choices[0].message.content;
  if (!rawResponse) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(rawResponse);
  const validated = PersonalizedResultSchema.parse(parsed);

  const personalUsage = extractUsageMetrics(completion);
  if (personalUsage) {
    await logAiUsage({
      spaceId,
      modelName: 'gpt-4o',
      operation: 'personalized-results',
      usage: personalUsage,
      metadata: { cacheHit: false, personalHash, participantId: participant.id },
    });
  }

  const [personalResult] = await db
    .insert(personalizedResults)
    .values({
      spaceId,
      participantId: participant.id,
      cohortResultId: cohortResultId || null,
      personalSummary: validated.personalSummary,
      alignmentScore: validated.alignmentScore,
      topContributions: validated.topContributions,
      insights: validated.insights,
      recommendations: validated.recommendations || null,
      inputsHash: personalHash,
    })
    .returning();

  return personalResult;
}

/**
 * Recompute the canonical CohortInputs hash for the workspace's *current*
 * state. GET endpoints compare this against the persisted row's `inputsHash`
 * to detect stale cached results.
 */
export async function getCurrentCohortInputsHash(spaceId: string): Promise<string | null> {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);
  if (!space) return null;

  type ModuleRow = { moduleType: string; enabled: boolean };
  type CategoryRow = { id: string; name: string };
  const [enabled, allNotes, allCategories] = await Promise.all([
    db.select().from(workspaceModules).where(and(eq(workspaceModules.spaceId, spaceId), eq(workspaceModules.enabled, true))) as Promise<ModuleRow[]>,
    db.select().from(notes).where(eq(notes.spaceId, spaceId)),
    db.select().from(categories).where(eq(categories.spaceId, spaceId)) as Promise<CategoryRow[]>,
  ]);
  const enabledModuleTypes = enabled.map((m) => m.moduleType);
  const hasSurvey = enabledModuleTypes.includes('survey');
  const hasPriorityMatrix = enabledModuleTypes.includes('priority-matrix');
  const hasStaircase = enabledModuleTypes.includes('staircase');
  const hasSignalH = enabledModuleTypes.includes('signal');
  const noteCount = allNotes.length;

  // Aggregate-shaped fetches in parallel — same SQL GROUP BY pattern as
  // generateCohortResults so the hash recompute is also O(notes) payload.
  type MatrixRow = { id: string; xAxisLabel: string; yAxisLabel: string };
  type StaircaseRow = { id: string; minLabel: string; maxLabel: string; minScore: number; maxScore: number };
  type SurveyQuestionRow = { id: string; questionText: string; sortOrder: number };
  type SignalRespRowH = { activityId: string; valueText: string | null; valueNumber: number | null; optionId: string | null };
  const [
    pairwiseTallies,
    rankingAggregates,
    marketplaceTallies,
    surveyAggregates,
    matrixRowH,
    staircaseRowH,
    surveyQRows,
    signalRespRowsH,
  ] = await Promise.all([
    storage.getPairwiseTalliesBySpace(spaceId),
    noteCount > 0 ? storage.getRankingAggregatesBySpace(spaceId, noteCount) : Promise.resolve([]),
    storage.getMarketplaceTalliesBySpace(spaceId),
    hasSurvey
      ? storage.getSurveyAggregatesBySpace(spaceId)
      : Promise.resolve({ perNote: [], perNoteQuestion: [] }),
    hasPriorityMatrix
      ? (db.select().from(priorityMatrices).where(eq(priorityMatrices.spaceId, spaceId)).limit(1) as Promise<MatrixRow[]>)
      : Promise.resolve<MatrixRow[]>([]),
    hasStaircase
      ? (db.select().from(staircaseModules).where(eq(staircaseModules.spaceId, spaceId)).limit(1) as Promise<StaircaseRow[]>)
      : Promise.resolve<StaircaseRow[]>([]),
    hasSurvey
      ? (db.select().from(surveyQuestions).where(eq(surveyQuestions.spaceId, spaceId)) as Promise<SurveyQuestionRow[]>)
      : Promise.resolve<SurveyQuestionRow[]>([]),
    hasSignalH
      ? (db.select({ activityId: signalResponses.activityId, valueText: signalResponses.valueText, valueNumber: signalResponses.valueNumber, optionId: signalResponses.optionId }).from(signalResponses).where(eq(signalResponses.spaceId, spaceId)) as Promise<SignalRespRowH[]>)
      : Promise.resolve<SignalRespRowH[]>([]),
  ]);
  const matrixH = matrixRowH[0];
  const staircaseH = staircaseRowH[0];
  type MatrixPosRow = { noteId: string; xCoord: number; yCoord: number };
  type StaircasePosRow = { noteId: string; score: number };
  const [matrixPosH, staircasePosH] = await Promise.all([
    matrixH
      ? (db.select().from(priorityMatrixPositions).where(eq(priorityMatrixPositions.matrixId, matrixH.id)) as Promise<MatrixPosRow[]>)
      : Promise.resolve<MatrixPosRow[]>([]),
    staircaseH
      ? (db.select().from(staircasePositions).where(eq(staircasePositions.staircaseId, staircaseH.id)) as Promise<StaircasePosRow[]>)
      : Promise.resolve<StaircasePosRow[]>([]),
  ]);

  const matrixPositionsByNote = new Map<string, { x: number; y: number }>();
  let matrixXLabel = 'Impact', matrixYLabel = 'Effort';
  if (matrixH) {
    matrixXLabel = matrixH.xAxisLabel; matrixYLabel = matrixH.yAxisLabel;
    matrixPosH.forEach((p) => matrixPositionsByNote.set(p.noteId, { x: Math.round(p.xCoord * 100), y: Math.round(p.yCoord * 100) }));
  }

  const staircaseScoresByNote = new Map<string, number>();
  let staircaseMinLabel = 'Lowest', staircaseMaxLabel = 'Highest';
  let staircaseMinScore = 0, staircaseMaxScore = 10;
  if (staircaseH) {
    staircaseMinLabel = staircaseH.minLabel; staircaseMaxLabel = staircaseH.maxLabel;
    staircaseMinScore = staircaseH.minScore; staircaseMaxScore = staircaseH.maxScore;
    staircasePosH.forEach((p) => staircaseScoresByNote.set(p.noteId, p.score));
  }

  let surveyQuestionsList: { id: string; questionText: string; sortOrder: number }[] = [];
  if (hasSurvey) {
    surveyQuestionsList = surveyQRows.map((q) => ({ id: q.id, questionText: q.questionText, sortOrder: q.sortOrder }));
    surveyQuestionsList.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const currentNoteIds = new Set(allNotes.map((n) => n.id));

  const kbQueryNotes = [...allNotes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 12)
    .map((n) => n.content || '');
  const queryTerms = [space.purpose || '', ...kbQueryNotes].join(' ').slice(0, 4000);
  const kbChunks = queryTerms.trim().length > 0
    ? await storage.searchKnowledgeBaseChunks({
        query: queryTerms, spaceId,
        organizationId: space.organizationId ?? undefined,
        includeSystem: true, limit: 8,
      })
    : [];

  const inputs: CohortInputs = {
    spaceId,
    workspaceName: space.name ?? null,
    workspacePurpose: space.purpose ?? null,
    enabledModules: enabledModuleTypes,
    matrixAxes: hasPriorityMatrix ? { xLabel: matrixXLabel, yLabel: matrixYLabel } : null,
    staircaseConfig: hasStaircase
      ? { label: `${staircaseMinLabel}|${staircaseMaxLabel}`, minScore: staircaseMinScore, maxScore: staircaseMaxScore }
      : null,
    surveyQuestions: surveyQuestionsList.map((q) => ({ id: q.id, text: q.questionText, order: q.sortOrder })),
    categories: allCategories.map((c) => ({ id: c.id, name: c.name })),
    notes: allNotes.map((n) => ({ id: n.id, content: n.content, manualCategoryId: n.manualCategoryId ?? null })),
    pairwiseTallies: pairwiseTallies.filter((t) => currentNoteIds.has(t.noteId)),
    rankingAggregates: rankingAggregates.filter((a) => currentNoteIds.has(a.noteId)),
    marketplaceTallies: marketplaceTallies.filter((t) => currentNoteIds.has(t.noteId)),
    matrixPositions: Array.from(matrixPositionsByNote.entries()).map(([noteId, p]) => ({ noteId, xCoord: p.x, yCoord: p.y })),
    staircasePositions: Array.from(staircaseScoresByNote.entries()).map(([noteId, score]) => ({ noteId, score })),
    surveyAggregates: hasSurvey
      ? surveyAggregates.perNoteQuestion.filter((a) => currentNoteIds.has(a.noteId))
      : [],
    kbChunkIds: kbChunks.map((c) => c.id),
    kbContentHash: hashKbChunkContents(kbChunks.map((c) => ({ id: c.id, content: c.content }))),
    signalResponses: hasSignalH
      ? signalRespRowsH.map((r) => ({
          activityId: r.activityId,
          valueText: r.valueText,
          valueNumber: r.valueNumber,
          optionId: r.optionId,
        }))
      : [],
  };
  return computeCohortInputsHash(inputs);
}

/**
 * Recompute the canonical PersonalizedInputs hash for a participant against
 * the workspace's most recent cohort result.
 */
export async function getCurrentPersonalizedInputsHash(
  spaceId: string,
  participantId: string,
): Promise<string | null> {
  const [participant] = await db.select().from(participants).where(eq(participants.id, participantId)).limit(1);
  if (!participant) return null;

  const [latestCohort] = await db
    .select()
    .from(cohortResults)
    .where(eq(cohortResults.spaceId, spaceId))
    .orderBy(sql`${cohortResults.createdAt} DESC`)
    .limit(1);

  // Use the workspace's *current* cohort inputs hash, not the persisted
  // row's, so the personalized hash invalidates when any cohort input
  // changes — even before the cohort result is regenerated.
  const currentCohortInputsHash = (await getCurrentCohortInputsHash(spaceId)) ?? '';

  const [pNotes, pVotes, pRankings, pAllocs, allVotes] = await Promise.all([
    db.select().from(notes).where(and(eq(notes.spaceId, spaceId), eq(notes.participantId, participantId))),
    db.select().from(votes).where(and(eq(votes.spaceId, spaceId), eq(votes.participantId, participantId))),
    db.select().from(rankings).where(and(eq(rankings.spaceId, spaceId), eq(rankings.participantId, participantId))),
    db.select().from(marketplaceAllocations).where(and(eq(marketplaceAllocations.spaceId, spaceId), eq(marketplaceAllocations.participantId, participantId))),
    db.select().from(votes).where(eq(votes.spaceId, spaceId)),
  ]);

  const winsByNote = new Map<string, number>();
  const cmpByNote = new Map<string, number>();
  for (const v of allVotes) {
    winsByNote.set(v.winnerNoteId, (winsByNote.get(v.winnerNoteId) ?? 0) + 1);
    cmpByNote.set(v.winnerNoteId, (cmpByNote.get(v.winnerNoteId) ?? 0) + 1);
    cmpByNote.set(v.loserNoteId, (cmpByNote.get(v.loserNoteId) ?? 0) + 1);
  }
  const noteImpacts = pNotes.map((n) => ({
    noteId: n.id,
    wins: winsByNote.get(n.id) ?? 0,
    totalComparisons: cmpByNote.get(n.id) ?? 0,
  }));

  return computePersonalizedInputsHash({
    spaceId,
    participantId,
    participantDisplayName: participant.displayName ?? null,
    cohortResultId: latestCohort?.id ?? null,
    cohortInputsHash: currentCohortInputsHash,
    cohortSummary: latestCohort?.summary ?? null,
    participantNotes: pNotes.map((n) => ({ id: n.id, content: n.content, manualCategoryId: n.manualCategoryId ?? null })),
    participantVotes: pVotes.map((v) => ({ winnerNoteId: v.winnerNoteId, loserNoteId: v.loserNoteId })),
    participantRankings: pRankings.map((r) => ({ noteId: r.noteId, rank: r.rank })),
    participantAllocations: pAllocs.map((a) => ({ noteId: a.noteId, coinsAllocated: a.coinsAllocated })),
    noteImpacts,
  });
}
