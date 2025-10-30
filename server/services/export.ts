import type { Note } from "@shared/schema";
import { calculateBordaScores, type BordaScore } from "./stack-ranking";
import { calculateMarketplaceScores, type MarketplaceScore } from "./marketplace";

/**
 * Export Service - Generate text snapshots for analytics
 */

/**
 * Generate pairwise voting export
 */
export function generatePairwiseExport(
  notes: Note[],
  voteStats: Map<string, { wins: number; losses: number; winRate: number }>
): string {
  const timestamp = new Date().toISOString();
  let output = `Nebula Pairwise Voting Export\n`;
  output += `Generated: ${timestamp}\n`;
  output += `Total Ideas: ${notes.length}\n`;
  output += `\n${'='.repeat(80)}\n\n`;

  // Group by category
  const categorized = new Map<string, Note[]>();
  const uncategorized: Note[] = [];

  notes.forEach(note => {
    if (note.category) {
      if (!categorized.has(note.category)) {
        categorized.set(note.category, []);
      }
      categorized.get(note.category)!.push(note);
    } else {
      uncategorized.push(note);
    }
  });

  // Sort categories alphabetically
  const sortedCategories = Array.from(categorized.keys()).sort();

  // Export each category
  sortedCategories.forEach(category => {
    const categoryNotes = categorized.get(category)!;
    output += `CATEGORY: ${category}\n`;
    output += `${'-'.repeat(80)}\n\n`;

    // Sort by win rate descending
    const sortedNotes = categoryNotes.sort((a, b) => {
      const statsA = voteStats.get(a.id) || { wins: 0, losses: 0, winRate: 0 };
      const statsB = voteStats.get(b.id) || { wins: 0, losses: 0, winRate: 0 };
      return statsB.winRate - statsA.winRate;
    });

    sortedNotes.forEach((note, index) => {
      const stats = voteStats.get(note.id) || { wins: 0, losses: 0, winRate: 0 };
      output += `${index + 1}. ${note.content}\n`;
      output += `   Wins: ${stats.wins} | Losses: ${stats.losses} | Win Rate: ${(stats.winRate * 100).toFixed(1)}%\n`;
      output += `   AI Categorized: ${note.isAiCategory ? 'Yes' : 'No'}\n\n`;
    });

    output += `\n`;
  });

  // Export uncategorized items
  if (uncategorized.length > 0) {
    output += `UNCATEGORIZED\n`;
    output += `${'-'.repeat(80)}\n\n`;

    const sortedNotes = uncategorized.sort((a, b) => {
      const statsA = voteStats.get(a.id) || { wins: 0, losses: 0, winRate: 0 };
      const statsB = voteStats.get(b.id) || { wins: 0, losses: 0, winRate: 0 };
      return statsB.winRate - statsA.winRate;
    });

    sortedNotes.forEach((note, index) => {
      const stats = voteStats.get(note.id) || { wins: 0, losses: 0, winRate: 0 };
      output += `${index + 1}. ${note.content}\n`;
      output += `   Wins: ${stats.wins} | Losses: ${stats.losses} | Win Rate: ${(stats.winRate * 100).toFixed(1)}%\n\n`;
    });
  }

  return output;
}

/**
 * Generate stack ranking export
 */
export function generateStackRankingExport(
  leaderboard: BordaScore[]
): string {
  const timestamp = new Date().toISOString();
  let output = `Nebula Stack Ranking Export (Borda Count)\n`;
  output += `Generated: ${timestamp}\n`;
  output += `Total Ideas: ${leaderboard.length}\n`;
  output += `\n${'='.repeat(80)}\n\n`;

  // Group by category
  const categorized = new Map<string, BordaScore[]>();
  const uncategorized: BordaScore[] = [];

  leaderboard.forEach(item => {
    if (item.note.category) {
      if (!categorized.has(item.note.category)) {
        categorized.set(item.note.category, []);
      }
      categorized.get(item.note.category)!.push(item);
    } else {
      uncategorized.push(item);
    }
  });

  // Sort categories alphabetically
  const sortedCategories = Array.from(categorized.keys()).sort();

  // Export each category
  sortedCategories.forEach(category => {
    const categoryItems = categorized.get(category)!;
    output += `CATEGORY: ${category}\n`;
    output += `${'-'.repeat(80)}\n\n`;

    // Already sorted by score from calculateBordaScores
    categoryItems.forEach((item, index) => {
      output += `${index + 1}. ${item.note.content}\n`;
      output += `   Borda Score: ${item.totalScore} | Average Rank: ${item.averageRank.toFixed(2)} | Participants: ${item.participantCount}\n`;
      output += `   AI Categorized: ${item.note.isAiCategory ? 'Yes' : 'No'}\n\n`;
    });

    output += `\n`;
  });

  // Export uncategorized items
  if (uncategorized.length > 0) {
    output += `UNCATEGORIZED\n`;
    output += `${'-'.repeat(80)}\n\n`;

    uncategorized.forEach((item, index) => {
      output += `${index + 1}. ${item.note.content}\n`;
      output += `   Borda Score: ${item.totalScore} | Average Rank: ${item.averageRank.toFixed(2)} | Participants: ${item.participantCount}\n\n`;
    });
  }

  return output;
}

/**
 * Generate marketplace allocation export
 */
export function generateMarketplaceExport(
  leaderboard: MarketplaceScore[]
): string {
  const timestamp = new Date().toISOString();
  let output = `Nebula Marketplace Allocation Export\n`;
  output += `Generated: ${timestamp}\n`;
  output += `Total Ideas: ${leaderboard.length}\n`;
  output += `\n${'='.repeat(80)}\n\n`;

  // Group by category
  const categorized = new Map<string, MarketplaceScore[]>();
  const uncategorized: MarketplaceScore[] = [];

  leaderboard.forEach(item => {
    if (item.note.category) {
      if (!categorized.has(item.note.category)) {
        categorized.set(item.note.category, []);
      }
      categorized.get(item.note.category)!.push(item);
    } else {
      uncategorized.push(item);
    }
  });

  // Sort categories alphabetically
  const sortedCategories = Array.from(categorized.keys()).sort();

  // Export each category
  sortedCategories.forEach(category => {
    const categoryItems = categorized.get(category)!;
    output += `CATEGORY: ${category}\n`;
    output += `${'-'.repeat(80)}\n\n`;

    // Already sorted by total coins from calculateMarketplaceScores
    categoryItems.forEach((item, index) => {
      output += `${index + 1}. ${item.note.content}\n`;
      output += `   Total Coins: ${item.totalCoins} | Average Coins: ${item.averageCoins.toFixed(1)} | Participants: ${item.participantCount}\n`;
      output += `   AI Categorized: ${item.note.isAiCategory ? 'Yes' : 'No'}\n\n`;
    });

    output += `\n`;
  });

  // Export uncategorized items
  if (uncategorized.length > 0) {
    output += `UNCATEGORIZED\n`;
    output += `${'-'.repeat(80)}\n\n`;

    uncategorized.forEach((item, index) => {
      output += `${index + 1}. ${item.note.content}\n`;
      output += `   Total Coins: ${item.totalCoins} | Average Coins: ${item.averageCoins.toFixed(1)} | Participants: ${item.participantCount}\n\n`;
    });
  }

  return output;
}
