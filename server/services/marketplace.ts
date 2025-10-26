import type { Note, MarketplaceAllocation } from "@shared/schema";

/**
 * Marketplace Service - Coin Allocation Implementation
 * 
 * Participants are given a fixed budget of coins to distribute among ideas.
 * They can allocate any amount to any idea, as long as total doesn't exceed budget.
 * Ideas with the most coins allocated receive higher rankings.
 */

export const DEFAULT_COIN_BUDGET = 100;

export interface ParticipantAllocation {
  participantId: string;
  allocations: Array<{
    noteId: string;
    coins: number;
  }>;
}

export interface MarketplaceScore {
  noteId: string;
  note: Note;
  totalCoins: number; // Total coins allocated to this note
  averageCoins: number; // Average coins per participant
  participantCount: number; // Number of participants who allocated to this note
}

export interface AllocationProgress {
  totalParticipants: number;
  participantsCompleted: number;
  percentComplete: number;
  isComplete: boolean;
}

/**
 * Calculate marketplace scores from all participant allocations
 */
export function calculateMarketplaceScores(
  notes: Note[],
  allAllocations: MarketplaceAllocation[]
): MarketplaceScore[] {
  // Initialize scores map
  const scoresMap = new Map<string, {
    totalCoins: number;
    participantIds: Set<string>;
    note: Note;
  }>();
  
  for (const note of notes) {
    scoresMap.set(note.id, {
      totalCoins: 0,
      participantIds: new Set(),
      note,
    });
  }
  
  // Aggregate coins for each note
  for (const allocation of allAllocations) {
    const data = scoresMap.get(allocation.noteId);
    if (data) {
      data.totalCoins += allocation.coinsAllocated;
      data.participantIds.add(allocation.participantId);
    }
  }
  
  // Convert to MarketplaceScore array and sort by total coins (descending)
  const results: MarketplaceScore[] = Array.from(scoresMap.values()).map(data => ({
    noteId: data.note.id,
    note: data.note,
    totalCoins: data.totalCoins,
    averageCoins: data.participantIds.size > 0 ? data.totalCoins / data.participantIds.size : 0,
    participantCount: data.participantIds.size,
  }));
  
  // Sort by total coins (highest first), then by participant count as tiebreaker
  results.sort((a, b) => {
    if (b.totalCoins !== a.totalCoins) {
      return b.totalCoins - a.totalCoins;
    }
    return b.participantCount - a.participantCount;
  });
  
  return results;
}

/**
 * Validate that a participant's allocation is valid
 */
export function validateAllocation(
  allocations: Array<{ noteId: string; coins: number }>,
  coinBudget: number = DEFAULT_COIN_BUDGET
): { valid: boolean; error?: string } {
  // Calculate total coins allocated
  const totalCoins = allocations.reduce((sum, a) => sum + a.coins, 0);
  
  // Check that total doesn't exceed budget
  if (totalCoins > coinBudget) {
    return {
      valid: false,
      error: `Total allocation (${totalCoins}) exceeds budget (${coinBudget})`,
    };
  }
  
  // Check that all coin amounts are non-negative
  for (const allocation of allocations) {
    if (allocation.coins < 0) {
      return {
        valid: false,
        error: `Coin allocation cannot be negative`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Calculate allocation completion progress
 */
export function calculateAllocationProgress(
  participantIds: string[],
  allAllocations: MarketplaceAllocation[],
  coinBudget: number = DEFAULT_COIN_BUDGET
): AllocationProgress {
  // Group allocations by participant and calculate their total
  const participantTotals = new Map<string, number>();
  
  for (const allocation of allAllocations) {
    const currentTotal = participantTotals.get(allocation.participantId) || 0;
    participantTotals.set(allocation.participantId, currentTotal + allocation.coinsAllocated);
  }
  
  // Count participants who have allocated any coins
  // We consider "completed" as having made at least one allocation
  const completedCount = participantTotals.size;
  
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
 * Check if a specific participant has completed their allocation
 */
export function hasParticipantCompleted(
  participantId: string,
  allAllocations: MarketplaceAllocation[]
): boolean {
  // A participant has "completed" if they have made at least one allocation
  return allAllocations.some(a => a.participantId === participantId);
}

/**
 * Get participant's remaining budget
 */
export function getParticipantRemainingBudget(
  participantId: string,
  allAllocations: MarketplaceAllocation[],
  coinBudget: number = DEFAULT_COIN_BUDGET
): number {
  const participantAllocations = allAllocations.filter(
    a => a.participantId === participantId
  );
  
  const totalAllocated = participantAllocations.reduce(
    (sum, a) => sum + a.coinsAllocated,
    0
  );
  
  return coinBudget - totalAllocated;
}
