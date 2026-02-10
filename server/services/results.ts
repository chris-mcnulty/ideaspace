import { openai } from "./openai";
import { db } from "../db";
import { notes, votes, rankings, marketplaceAllocations, participants, spaces, knowledgeBaseDocuments, cohortResults, personalizedResults, categories, workspaceModules, priorityMatrices, priorityMatrixPositions, staircaseModules, staircasePositions } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import type { CohortResult, PersonalizedResult } from "@shared/schema";

// Schema for validating AI-generated cohort results
const CohortResultSchema = z.object({
  summary: z.string(),
  keyThemes: z.array(z.string()),
  topIdeas: z.array(z.object({
    noteId: z.string(),
    content: z.string(),
    category: z.string().optional(),
    pairwiseWins: z.number().optional(),
    bordaScore: z.number().optional(),
    marketplaceCoins: z.number().optional(),
    overallRank: z.number(),
  })),
  insights: z.string(),
  recommendations: z.string().optional(),
});

// Schema for validating AI-generated personalized results
const PersonalizedResultSchema = z.object({
  personalSummary: z.string(),
  alignmentScore: z.number().min(0).max(100),
  topContributions: z.array(z.object({
    noteId: z.string(),
    content: z.string(),
    impact: z.string(),
  })),
  insights: z.string(),
  recommendations: z.string().optional(),
});

/**
 * Generate cohort results using GPT-5
 */
export async function generateCohortResults(
  spaceId: string,
  generatedBy: string
): Promise<CohortResult> {
  // Fetch workspace details
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);

  if (!space) {
    throw new Error("Workspace not found");
  }

  // Fetch enabled modules from the workspace_modules table
  const enabledModulesData = await db
    .select()
    .from(workspaceModules)
    .where(and(
      eq(workspaceModules.spaceId, spaceId),
      eq(workspaceModules.enabled, true)
    ));
  
  const enabledModuleTypes = enabledModulesData.map(m => m.moduleType);
  const hasPairwiseVoting = enabledModuleTypes.includes('pairwise-voting');
  const hasStackRanking = enabledModuleTypes.includes('stack-ranking');
  const hasMarketplace = enabledModuleTypes.includes('marketplace');
  const hasSurvey = enabledModuleTypes.includes('survey');
  const hasPriorityMatrix = enabledModuleTypes.includes('priority-matrix');
  const hasStaircase = enabledModuleTypes.includes('staircase');

  // Fetch all notes for this workspace
  const allNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.spaceId, spaceId));

  if (allNotes.length === 0) {
    throw new Error("No notes found for this workspace");
  }

  // Fetch categories for this workspace to map category IDs to names
  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.spaceId, spaceId));

  const categoryMap = new Map<string, string>();
  allCategories.forEach(cat => {
    categoryMap.set(cat.id, cat.name);
  });

  // Fetch voting data (pairwise)
  const pairwiseVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.spaceId, spaceId));

  // Calculate pairwise wins per note
  const pairwiseWins = new Map<string, number>();
  pairwiseVotes.forEach((vote: any) => {
    pairwiseWins.set(vote.winnerNoteId, (pairwiseWins.get(vote.winnerNoteId) || 0) + 1);
  });

  // Fetch ranking data (Borda count)
  const rankingData = await db
    .select()
    .from(rankings)
    .where(eq(rankings.spaceId, spaceId));

  // Calculate Borda scores
  const noteCount = allNotes.length;
  const bordaScores = new Map<string, number>();
  rankingData.forEach((ranking: any) => {
    // Clamp rank to valid range [1, noteCount] to handle legacy data with invalid ranks
    const clampedRank = Math.max(1, Math.min(ranking.rank, noteCount));
    const score = noteCount - clampedRank + 1;
    bordaScores.set(ranking.noteId, (bordaScores.get(ranking.noteId) || 0) + score);
  });

  // Fetch marketplace data
  const marketplaceData = await db
    .select()
    .from(marketplaceAllocations)
    .where(eq(marketplaceAllocations.spaceId, spaceId));

  // Calculate total coins per note
  const marketplaceCoins = new Map<string, number>();
  marketplaceData.forEach((allocation: any) => {
    marketplaceCoins.set(
      allocation.noteId,
      (marketplaceCoins.get(allocation.noteId) || 0) + allocation.coinsAllocated
    );
  });

  // Fetch Priority Matrix data
  const matrixPositionsByNote = new Map<string, { x: number; y: number }>();
  let matrixXLabel = 'Impact';
  let matrixYLabel = 'Effort';
  if (hasPriorityMatrix) {
    const [matrix] = await db
      .select()
      .from(priorityMatrices)
      .where(eq(priorityMatrices.spaceId, spaceId))
      .limit(1);

    if (matrix) {
      matrixXLabel = matrix.xAxisLabel;
      matrixYLabel = matrix.yAxisLabel;
      const matrixPositions = await db
        .select()
        .from(priorityMatrixPositions)
        .where(eq(priorityMatrixPositions.matrixId, matrix.id));

      matrixPositions.forEach((pos: any) => {
        matrixPositionsByNote.set(pos.noteId, {
          x: Math.round(pos.xCoord * 100),
          y: Math.round(pos.yCoord * 100),
        });
      });
    }
  }

  // Fetch Staircase data
  const staircaseScoresByNote = new Map<string, number>();
  let staircaseMinLabel = 'Lowest';
  let staircaseMaxLabel = 'Highest';
  let staircaseMinScore = 0;
  let staircaseMaxScore = 10;
  if (hasStaircase) {
    const [staircase] = await db
      .select()
      .from(staircaseModules)
      .where(eq(staircaseModules.spaceId, spaceId))
      .limit(1);

    if (staircase) {
      staircaseMinLabel = staircase.minLabel;
      staircaseMaxLabel = staircase.maxLabel;
      staircaseMinScore = staircase.minScore;
      staircaseMaxScore = staircase.maxScore;
      const stPositions = await db
        .select()
        .from(staircasePositions)
        .where(eq(staircasePositions.staircaseId, staircase.id));

      stPositions.forEach((pos: any) => {
        staircaseScoresByNote.set(pos.noteId, pos.score);
      });
    }
  }

  // Combine all scoring data
  const notesWithScores = allNotes.map((note: any) => ({
    ...note,
    pairwiseWins: pairwiseWins.get(note.id) || 0,
    bordaScore: bordaScores.get(note.id) || 0,
    marketplaceCoins: marketplaceCoins.get(note.id) || 0,
    // Calculate combined rank (simple average of normalized ranks)
    combinedScore:
      ((pairwiseWins.get(note.id) || 0) / (pairwiseVotes.length || 1)) * 0.33 +
      ((bordaScores.get(note.id) || 0) / (noteCount * noteCount || 1)) * 0.33 +
      ((marketplaceCoins.get(note.id) || 0) / 100) * 0.34,
  }));

  // Sort by combined score
  notesWithScores.sort((a: any, b: any) => b.combinedScore - a.combinedScore);

  // Fetch knowledge base documents for context (workspace, organization, and system level)
  const kbDocs = await db
    .select()
    .from(knowledgeBaseDocuments)
    .where(
      sql`(${knowledgeBaseDocuments.scope} = 'workspace' AND ${knowledgeBaseDocuments.spaceId} = ${spaceId}) OR 
          (${knowledgeBaseDocuments.scope} = 'organization' AND ${knowledgeBaseDocuments.organizationId} = ${space.organizationId}) OR 
          ${knowledgeBaseDocuments.scope} = 'system'`
    );

  // Build context for AI
  const kbContext = kbDocs.length > 0
    ? `\n\nRelevant Knowledge Base Documents:\n${kbDocs.map((doc: any) => `- ${doc.title}: ${doc.description || 'No description'}`).join('\n')}`
    : '';

  // Build module-aware data summary
  const enabledModulesDescription = [
    hasPairwiseVoting && 'Pairwise Voting',
    hasStackRanking && 'Stack Ranking (Borda Count)',
    hasMarketplace && 'Marketplace Allocation',
    hasSurvey && 'Survey',
    hasPriorityMatrix && '2x2 Priority Matrix',
    hasStaircase && 'Staircase Rating',
  ].filter(Boolean).join(', ');

  // Prepare data summary for AI
  const dataSummary = `
Workspace: ${space.name}
Purpose: ${space.purpose}

ENABLED MODULES: ${enabledModulesDescription || 'Ideation only'}
(Only discuss the modules that were enabled. Do NOT mention or analyze modules that were not used.)

Total Ideas: ${allNotes.length}
${hasPairwiseVoting ? `Total Pairwise Votes: ${pairwiseVotes.length}` : ''}
${hasStackRanking ? `Total Rankings Submitted: ${new Set(rankingData.map((r: any) => r.participantId)).size}` : ''}
${hasMarketplace ? `Total Marketplace Allocations: ${marketplaceData.length}` : ''}
${hasPriorityMatrix ? `Priority Matrix Axes: X="${matrixXLabel}" (0=Low, 100=High), Y="${matrixYLabel}" (0=Low, 100=High)
Notes positioned on matrix: ${matrixPositionsByNote.size}` : ''}
${hasStaircase ? `Staircase Scale: ${staircaseMinScore} (${staircaseMinLabel}) to ${staircaseMaxScore} (${staircaseMaxLabel})
Notes rated on staircase: ${staircaseScoresByNote.size}` : ''}

All Ideas Ranked by Combined Score:
${notesWithScores.map((note: any, idx: any) => `
${idx + 1}. "${note.content}" (Category: ${note.manualCategoryId ? categoryMap.get(note.manualCategoryId) || 'Uncategorized' : 'Uncategorized'})${hasPairwiseVoting ? `
   - Pairwise Wins: ${note.pairwiseWins}` : ''}${hasStackRanking ? `
   - Borda Score: ${note.bordaScore}` : ''}${hasMarketplace ? `
   - Marketplace Coins: ${note.marketplaceCoins}` : ''}${hasPriorityMatrix && matrixPositionsByNote.has(note.id) ? `
   - Matrix Position: ${matrixXLabel}=${matrixPositionsByNote.get(note.id)!.x}%, ${matrixYLabel}=${matrixPositionsByNote.get(note.id)!.y}% (${matrixPositionsByNote.get(note.id)!.x > 50 ? 'High' : 'Low'} ${matrixXLabel}, ${matrixPositionsByNote.get(note.id)!.y > 50 ? 'High' : 'Low'} ${matrixYLabel})` : ''}${hasStaircase && staircaseScoresByNote.has(note.id) ? `
   - Staircase Score: ${staircaseScoresByNote.get(note.id)} / ${staircaseMaxScore}` : ''}
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
${category} (${ideas.length} ideas):
${ideas.map((idea: any) => `  - ${idea}`).join('\n')}
`).join('\n')}
${kbContext}
`;

  // Generate results using GPT-5
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert facilitator analyzing collaborative envisioning session results. Generate comprehensive cohort insights based on voting data, idea categorization, and participant engagement. Focus on identifying patterns, themes, and actionable recommendations.

CRITICAL FORMATTING RULES:
1. Only discuss and analyze the modules that were ENABLED for this session. Do NOT mention modules that were not used.
2. Use clear paragraph breaks (\\n\\n) between distinct points for readability.
3. For recommendations, format as a numbered list with each recommendation on its own line.
4. Keep summaries focused on what WAS done, not what wasn't.`,
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
      "category": "category name",
      "pairwiseWins": number,
      "bordaScore": number,
      "marketplaceCoins": number,
      "overallRank": number (1-based rank)
    }
  ],
  "insights": "3-4 paragraphs of deep insights about patterns, alignment, diversity of thought, and key findings. Use \\n\\n between paragraphs for readability. Focus only on enabled modules.",
  "recommendations": "Format as a numbered list:\\n\\n1. First recommendation\\n\\n2. Second recommendation\\n\\n3. Third recommendation\\n\\nEach recommendation should be actionable and specific."
}

Include ALL ideas in the topIdeas array, ranked by combined score (highest to lowest).`,
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
  const validated = CohortResultSchema.parse(parsed);

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
      metadata: {
        totalNotes: allNotes.length,
        totalVotes: pairwiseVotes.length,
        totalRankings: rankingData.length,
        totalAllocations: marketplaceData.length,
        generatedAt: new Date().toISOString(),
      },
    })
    .returning();

  return cohortResult;
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

  // Fetch participant's contributions
  const participantNotes = await db
    .select()
    .from(notes)
    .where(and(eq(notes.spaceId, spaceId), eq(notes.participantId, participantId)));

  // Fetch participant's votes
  const participantVotes = await db
    .select()
    .from(votes)
    .where(and(eq(votes.spaceId, spaceId), eq(votes.participantId, participantId)));

  // Fetch participant's rankings
  const participantRankings = await db
    .select()
    .from(rankings)
    .where(and(eq(rankings.spaceId, spaceId), eq(rankings.participantId, participantId)));

  // Fetch participant's marketplace allocations
  const participantAllocations = await db
    .select()
    .from(marketplaceAllocations)
    .where(and(eq(marketplaceAllocations.spaceId, spaceId), eq(marketplaceAllocations.participantId, participantId)));

  // Calculate impact scores for participant's notes
  const allVotes = await db.select().from(votes).where(eq(votes.spaceId, spaceId));
  const noteImpact = participantNotes.map((note: any) => {
    const wins = allVotes.filter((v: any) => v.winnerNoteId === note.id).length;
    const totalComparisons = allVotes.filter((v: any) => v.winnerNoteId === note.id || v.loserNoteId === note.id).length;
    return {
      noteId: note.id,
      content: note.content,
      wins,
      totalComparisons,
      winRate: totalComparisons > 0 ? wins / totalComparisons : 0,
    };
  });

  noteImpact.sort((a: any, b: any) => b.winRate - a.winRate);

  // Build personalized context
  const personalContext = `
Participant: ${participant.displayName}

Contributions:
- Total Ideas: ${participantNotes.length}
- Ideas by Category: ${Object.entries(
    participantNotes.reduce((acc: any, note: any) => {
      const cat = note.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([cat, count]: any) => `${cat} (${count})`).join(', ')}

Engagement:
- Pairwise Votes Cast: ${participantVotes.length}
- Rankings Submitted: ${participantRankings.length > 0 ? 'Yes' : 'No'}
- Marketplace Allocations: ${participantAllocations.length > 0 ? 'Yes' : 'No'}

Top Contributions by Impact:
${noteImpact.slice(0, 5).map((n: any, idx: any) => `${idx + 1}. "${n.content}" - Win rate: ${(n.winRate * 100).toFixed(1)}% (${n.wins}/${n.totalComparisons})`).join('\n')}

${cohortResult ? `
Cohort Summary:
${cohortResult.summary}

Key Themes Identified:
${cohortResult.keyThemes?.join(', ') || 'None identified'}
` : ''}
`;

  // Generate personalized insights using GPT-5
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a personal coach providing tailored feedback to a participant in a collaborative envisioning session. Analyze their contributions, engagement, and alignment with the cohort to provide meaningful insights and recommendations.`,
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
    })
    .returning();

  return personalResult;
}

/**
 * Batch generate personalized results for all participants in a workspace
 */
export async function generateAllPersonalizedResults(
  spaceId: string,
  cohortResultId: string
): Promise<PersonalizedResult[]> {
  // Fetch all participants
  const allParticipants = await db
    .select()
    .from(participants)
    .where(eq(participants.spaceId, spaceId));

  const results: PersonalizedResult[] = [];

  // Generate results for each participant
  for (const participant of allParticipants) {
    try {
      const result = await generatePersonalizedResults(spaceId, participant.id, cohortResultId);
      results.push(result);
    } catch (error) {
      console.error(`Failed to generate results for participant ${participant.id}:`, error);
      // Continue with other participants
    }
  }

  return results;
}
