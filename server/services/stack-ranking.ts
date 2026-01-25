import type { Note, Ranking } from "@shared/schema";

/**
 * Stack Ranking Service - Borda Count Implementation
 * 
 * In Borda count:
 * - For N items, the top-ranked item gets N points
 * - Second-ranked gets N-1 points, etc.
 * - Aggregate all participants' rankings to calculate final scores
 * - Higher total score = higher final ranking
 */

export interface ParticipantRanking {
  participantId: string;
  rankings: Array<{
    noteId: string;
    rank: number; // 1 = most important, higher numbers = less important
  }>;
}

export interface BordaScore {
  noteId: string;
  note: Note;
  totalScore: number; // Aggregate Borda count score
  averageRank: number; // Average rank across all participants
  participantCount: number; // Number of participants who ranked this note
}

export interface RankingProgress {
  totalParticipants: number;
  participantsCompleted: number;
  percentComplete: number;
  isComplete: boolean;
}

/**
 * Calculate Borda count scores from all participant rankings
 */
export function calculateBordaScores(
  notes: Note[],
  allRankings: Ranking[]
): BordaScore[] {
  const totalNotes = notes.length;
  
  // Initialize scores map
  const scoresMap = new Map<string, {
    totalScore: number;
    totalRank: number;
    count: number;
    note: Note;
  }>();
  
  for (const note of notes) {
    scoresMap.set(note.id, {
      totalScore: 0,
      totalRank: 0,
      count: 0,
      note,
    });
  }
  
  // Calculate Borda points for each ranking
  for (const ranking of allRankings) {
    const data = scoresMap.get(ranking.noteId);
    if (data) {
      // Clamp rank to valid range [1, totalNotes] to handle legacy data with invalid ranks
      const clampedRank = Math.max(1, Math.min(ranking.rank, totalNotes));
      // Borda count: rank 1 gets N points, rank 2 gets N-1 points, etc.
      const bordaPoints = totalNotes - clampedRank + 1;
      data.totalScore += bordaPoints;
      data.totalRank += ranking.rank;
      data.count += 1;
    }
  }
  
  // Convert to BordaScore array and sort by total score (descending)
  const results: BordaScore[] = Array.from(scoresMap.values()).map(data => ({
    noteId: data.note.id,
    note: data.note,
    totalScore: data.totalScore,
    averageRank: data.count > 0 ? data.totalRank / data.count : 0,
    participantCount: data.count,
  }));
  
  // Sort by total score (highest first), then by average rank (lowest first) as tiebreaker
  results.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return a.averageRank - b.averageRank;
  });
  
  return results;
}

/**
 * Validate that a participant's ranking is complete and valid
 */
export function validateRanking(
  noteIds: string[],
  rankings: Array<{ noteId: string; rank: number }>
): { valid: boolean; error?: string } {
  // Check that all notes are ranked
  if (rankings.length !== noteIds.length) {
    return {
      valid: false,
      error: `Must rank all ${noteIds.length} notes (received ${rankings.length})`,
    };
  }
  
  // Check that all note IDs are valid
  const validNoteIds = new Set(noteIds);
  for (const ranking of rankings) {
    if (!validNoteIds.has(ranking.noteId)) {
      return {
        valid: false,
        error: `Invalid note ID: ${ranking.noteId}`,
      };
    }
  }
  
  // Check that ranks are unique and sequential (1, 2, 3, ..., N)
  const ranks = rankings.map(r => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) {
      return {
        valid: false,
        error: `Ranks must be sequential from 1 to ${noteIds.length}`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Calculate ranking completion progress
 */
export function calculateRankingProgress(
  participantIds: string[],
  allRankings: Ranking[],
  totalNotes: number
): RankingProgress {
  // Group rankings by participant
  const participantRankings = new Map<string, number>();
  
  for (const ranking of allRankings) {
    const count = participantRankings.get(ranking.participantId) || 0;
    participantRankings.set(ranking.participantId, count + 1);
  }
  
  // Count participants who have completed full ranking (ranked all notes)
  let completedCount = 0;
  for (const [, rankingCount] of Array.from(participantRankings.entries())) {
    if (rankingCount === totalNotes) {
      completedCount++;
    }
  }
  
  const totalParticipants = participantIds.length;
  const percentComplete = totalParticipants > 0
    ? Math.round((completedCount / totalParticipants) * 100)
    : 0;
  
  return {
    totalParticipants,
    participantsCompleted: completedCount,
    percentComplete,
    isComplete: completedCount === totalParticipants && totalParticipants > 0,
  };
}

/**
 * Check if a specific participant has completed their ranking
 */
export function hasParticipantCompleted(
  participantId: string,
  allRankings: Ranking[],
  totalNotes: number
): boolean {
  const participantRankings = allRankings.filter(
    r => r.participantId === participantId
  );
  return participantRankings.length === totalNotes;
}
