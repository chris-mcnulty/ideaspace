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
 * Uses RANDOM pairing - selects two random notes that can be compared
 * Allows repeats (participants don't need to vote on all pairs)
 * Randomizes left/right positioning
 * 
 * @param notes - All notes in the workspace
 * @param existingVotes - Not used (random pairs allow repeats)
 * @param scope - 'all' for cross-category voting, 'within_categories' to only pair notes in same category
 */
export function getNextPair(
  notes: Note[],
  existingVotes: Vote[],
  scope: "all" | "within_categories" = "all"
): NotePair | null {
  if (notes.length < 2) {
    return null;
  }

  // For category-scoped voting, group notes by category
  if (scope === "within_categories") {
    const notesByCategory = new Map<string | null, Note[]>();
    
    for (const note of notes) {
      const categoryId = note.manualCategoryId || null;
      if (!notesByCategory.has(categoryId)) {
        notesByCategory.set(categoryId, []);
      }
      notesByCategory.get(categoryId)!.push(note);
    }
    
    // Filter to categories with at least 2 notes
    const validCategories = Array.from(notesByCategory.values()).filter(
      categoryNotes => categoryNotes.length >= 2
    );
    
    if (validCategories.length === 0) {
      return null; // No categories have enough notes to pair
    }
    
    // Randomly select a category
    const randomCategory = validCategories[Math.floor(Math.random() * validCategories.length)];
    
    // Randomly select two different notes from that category
    const index1 = Math.floor(Math.random() * randomCategory.length);
    let index2 = Math.floor(Math.random() * randomCategory.length);
    
    // Ensure index2 is different from index1
    while (index2 === index1) {
      index2 = Math.floor(Math.random() * randomCategory.length);
    }
    
    // Randomly decide which note goes on left vs right
    const noteA = Math.random() < 0.5 ? randomCategory[index1] : randomCategory[index2];
    const noteB = noteA === randomCategory[index1] ? randomCategory[index2] : randomCategory[index1];
    
    return { noteA, noteB };
  }
  
  // For cross-category voting, select any two random notes
  const index1 = Math.floor(Math.random() * notes.length);
  let index2 = Math.floor(Math.random() * notes.length);
  
  // Ensure index2 is different from index1
  while (index2 === index1) {
    index2 = Math.floor(Math.random() * notes.length);
  }
  
  // Randomly decide which note goes on left vs right
  const noteA = Math.random() < 0.5 ? notes[index1] : notes[index2];
  const noteB = noteA === notes[index1] ? notes[index2] : notes[index1];
  
  return { noteA, noteB };
}

/**
 * Calculate voting progress for a participant
 * With random pairing and repeats allowed, there's no fixed "total pairs" to complete
 * Progress simply tracks number of votes cast
 * 
 * @param notes - All notes in the workspace
 * @param existingVotes - Votes already cast by this participant
 * @param scope - Not used for random pairing (kept for API compatibility)
 */
export function calculateProgress(
  notes: Note[],
  existingVotes: Vote[],
  scope: "all" | "within_categories" = "all"
): VotingProgress {
  // With random pairing and repeats, we just track vote count
  // No concept of "total pairs" or "completion percentage"
  const completedPairs = existingVotes.length;
  
  return {
    totalPairs: 0, // Not applicable for random pairing
    completedPairs,
    percentComplete: 0, // Not applicable for random pairing
    isComplete: false, // Never "complete" with random pairing
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
