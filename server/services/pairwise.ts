import { Note, Vote } from "@shared/schema";

export interface NotePair {
  noteA: Note;
  noteB: Note;
}

export interface VotingProgress {
  totalPairs: number;
  completedPairs: number;
  percentComplete: number;
  isComplete: boolean;
}

// Track recent pairs to avoid repetition (in-memory, per-session)
const recentPairsCache = new Map<string, Array<{ noteA: string; noteB: string }>>();
const MAX_RECENT_PAIRS = 10;

// Track last shown pair with positions to avoid same note in same position
const lastPairPositions = new Map<string, { leftNoteId: string; rightNoteId: string }>();

/**
 * Calculate the next pair of notes for a participant to vote on
 * Uses weighted random pairing - prioritizes less-seen pairs while avoiding repetition
 * Randomizes left/right positioning
 * 
 * @param notes - All notes in the workspace
 * @param existingVotes - Votes already cast by this participant (used to track what they've seen)
 * @param scope - 'all' for cross-category voting, 'within_categories' to only pair notes in same category
 * @param participantId - Optional participant ID for caching recent pairs
 */
export function getNextPair(
  notes: Note[],
  existingVotes: Vote[],
  scope: "all" | "within_categories" = "all",
  participantId?: string
): NotePair | null {
  if (notes.length < 2) {
    return null;
  }

  // Filter to visible notes only
  const visibleNotes = notes.filter(n => n.visibleInRanking !== false);
  
  if (visibleNotes.length < 2) {
    return null;
  }

  // Get recent pairs for this participant to avoid repetition
  const cacheKey = participantId || 'anonymous';
  const recentPairs = recentPairsCache.get(cacheKey) || [];
  
  // Generate all possible pairs
  const allPairs: Array<{ noteA: Note; noteB: Note }> = [];
  
  for (let i = 0; i < visibleNotes.length; i++) {
    for (let j = i + 1; j < visibleNotes.length; j++) {
      // For category-scoped voting, only include pairs from same category
      if (scope === "within_categories") {
        if (visibleNotes[i].manualCategoryId !== visibleNotes[j].manualCategoryId) {
          continue;
        }
      }
      allPairs.push({ noteA: visibleNotes[i], noteB: visibleNotes[j] });
    }
  }
  
  if (allPairs.length === 0) {
    return null;
  }

  // Calculate how many times each pair has been voted on by this participant
  const pairVoteCounts = new Map<string, number>();
  for (const vote of existingVotes) {
    const pairKey = [vote.winnerNoteId, vote.loserNoteId].sort().join('|');
    pairVoteCounts.set(pairKey, (pairVoteCounts.get(pairKey) || 0) + 1);
  }

  // Score pairs: lower score = less seen = higher priority
  // Also penalize pairs that were shown recently
  const scoredPairs = allPairs.map(pair => {
    const pairKey = [pair.noteA.id, pair.noteB.id].sort().join('|');
    const voteCount = pairVoteCounts.get(pairKey) || 0;
    
    // Check if this pair was shown recently
    const recentIndex = recentPairs.findIndex(rp => 
      (rp.noteA === pair.noteA.id && rp.noteB === pair.noteB.id) ||
      (rp.noteA === pair.noteB.id && rp.noteB === pair.noteA.id)
    );
    const recencyPenalty = recentIndex >= 0 ? (MAX_RECENT_PAIRS - recentIndex) * 2 : 0;
    
    return {
      pair,
      score: voteCount + recencyPenalty + Math.random() * 0.5 // Add small random factor for variety
    };
  });

  // Sort by score ascending (lowest = least seen/recent)
  scoredPairs.sort((a, b) => a.score - b.score);

  // Select from the least-seen pairs with some randomization
  // Pick randomly from the bottom 25% of pairs (or at least 3)
  const poolSize = Math.max(3, Math.floor(scoredPairs.length * 0.25));
  const selectedIndex = Math.floor(Math.random() * poolSize);
  const selected = scoredPairs[selectedIndex].pair;

  // Get the last pair positions to avoid showing same note in same position
  const lastPositions = lastPairPositions.get(cacheKey);
  
  let noteA: Note;
  let noteB: Note;
  
  if (lastPositions) {
    // Check if either note from selected pair was in the last pair
    const selectedAWasLeft = selected.noteA.id === lastPositions.leftNoteId;
    const selectedAWasRight = selected.noteA.id === lastPositions.rightNoteId;
    const selectedBWasLeft = selected.noteB.id === lastPositions.leftNoteId;
    const selectedBWasRight = selected.noteB.id === lastPositions.rightNoteId;
    
    if (selectedAWasLeft || selectedBWasRight) {
      // If noteA was on left before, put it on right now (swap positions)
      // If noteB was on right before, put it on left now
      noteA = selected.noteB;
      noteB = selected.noteA;
    } else if (selectedAWasRight || selectedBWasLeft) {
      // If noteA was on right before, put it on left now
      // If noteB was on left before, put it on right now
      noteA = selected.noteA;
      noteB = selected.noteB;
    } else {
      // Neither note was in the last pair, randomize as before
      [noteA, noteB] = Math.random() < 0.5 
        ? [selected.noteA, selected.noteB] 
        : [selected.noteB, selected.noteA];
    }
  } else {
    // No last pair, randomize as before
    [noteA, noteB] = Math.random() < 0.5 
      ? [selected.noteA, selected.noteB] 
      : [selected.noteB, selected.noteA];
  }

  // Store the positions we're showing (noteA = left, noteB = right)
  lastPairPositions.set(cacheKey, { leftNoteId: noteA.id, rightNoteId: noteB.id });

  // Update recent pairs cache
  recentPairs.unshift({ noteA: noteA.id, noteB: noteB.id });
  if (recentPairs.length > MAX_RECENT_PAIRS) {
    recentPairs.pop();
  }
  recentPairsCache.set(cacheKey, recentPairs);

  return { noteA, noteB };
}

/**
 * Calculate voting progress for a participant
 * Shows how many unique pairs have been voted on vs total possible pairs
 * 
 * @param notes - All notes in the workspace
 * @param existingVotes - Votes already cast by this participant
 * @param scope - 'all' or 'within_categories'
 */
export function calculateProgress(
  notes: Note[],
  existingVotes: Vote[],
  scope: "all" | "within_categories" = "all"
): VotingProgress {
  // Filter to visible notes
  const visibleNotes = notes.filter(n => n.visibleInRanking !== false);
  
  // Calculate total possible pairs
  let totalPairs = 0;
  
  if (scope === "within_categories") {
    // Count pairs within each category
    const notesByCategory = new Map<string | null, number>();
    for (const note of visibleNotes) {
      const catId = note.manualCategoryId || null;
      notesByCategory.set(catId, (notesByCategory.get(catId) || 0) + 1);
    }
    Array.from(notesByCategory.values()).forEach(count => {
      if (count >= 2) {
        totalPairs += (count * (count - 1)) / 2;
      }
    });
  } else {
    // All possible pairs
    totalPairs = (visibleNotes.length * (visibleNotes.length - 1)) / 2;
  }

  // Count unique pairs that have been voted on
  const votedPairs = new Set<string>();
  for (const vote of existingVotes) {
    const pairKey = [vote.winnerNoteId, vote.loserNoteId].sort().join('|');
    votedPairs.add(pairKey);
  }
  
  const completedPairs = votedPairs.size;
  const percentComplete = totalPairs > 0 ? Math.round((completedPairs / totalPairs) * 100) : 0;
  const isComplete = completedPairs >= totalPairs;

  return {
    totalPairs,
    completedPairs,
    percentComplete,
    isComplete,
  };
}

/**
 * Get aggregate voting statistics for a space
 * Returns win counts for each note
 */
export function calculateVoteStats(
  notes: Note[],
  allVotes: Vote[]
): Map<string, number> {
  const winCounts = new Map<string, number>();
  
  // Initialize all notes with 0 wins
  for (const note of notes) {
    winCounts.set(note.id, 0);
  }
  
  // Count wins
  for (const vote of allVotes) {
    const currentWins = winCounts.get(vote.winnerNoteId) || 0;
    winCounts.set(vote.winnerNoteId, currentWins + 1);
  }
  
  return winCounts;
}

/**
 * Clear recent pairs cache for a participant
 * Call when participant leaves or session ends
 */
export function clearRecentPairsCache(participantId: string): void {
  recentPairsCache.delete(participantId);
  lastPairPositions.delete(participantId);
}
