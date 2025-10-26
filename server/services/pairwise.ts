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

/**
 * Calculate the next pair of notes for a participant to vote on
 * Uses round-robin algorithm: all unique pairs (n choose 2)
 * Returns null if all pairs have been voted on
 */
export function getNextPair(
  notes: Note[],
  existingVotes: Vote[]
): NotePair | null {
  if (notes.length < 2) {
    return null;
  }

  // Create set of already-voted pairs for fast lookup
  const votedPairs = new Set<string>();
  for (const vote of existingVotes) {
    // Store both orderings since voting A>B is same as voting on pair (A,B)
    votedPairs.add(`${vote.winnerNoteId}:${vote.loserNoteId}`);
    votedPairs.add(`${vote.loserNoteId}:${vote.winnerNoteId}`);
  }

  // Find first unvoted pair (deterministic ordering for consistency)
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const pairKey = `${notes[i].id}:${notes[j].id}`;
      if (!votedPairs.has(pairKey)) {
        return {
          noteA: notes[i],
          noteB: notes[j],
        };
      }
    }
  }

  // All pairs have been voted on
  return null;
}

/**
 * Calculate voting progress for a participant
 */
export function calculateProgress(
  notes: Note[],
  existingVotes: Vote[]
): VotingProgress {
  // Total unique pairs = n choose 2 = n * (n - 1) / 2
  const totalPairs = (notes.length * (notes.length - 1)) / 2;
  const completedPairs = existingVotes.length;
  const percentComplete = totalPairs > 0 ? Math.round((completedPairs / totalPairs) * 100) : 0;

  return {
    totalPairs,
    completedPairs,
    percentComplete,
    isComplete: completedPairs >= totalPairs,
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
