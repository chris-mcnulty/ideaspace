import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
import type { Note } from "@shared/schema";

export interface BordaScore {
  noteId: string;
  note: Note;
  totalScore: number;
  averageRank: number;
  participantCount: number;
}

interface LeaderboardProps {
  scores: BordaScore[];
  showRankBadges?: boolean;
}

export function Leaderboard({ scores, showRankBadges = true }: LeaderboardProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankBadgeVariant = (rank: number): "default" | "secondary" | "outline" => {
    if (rank === 1) return "default";
    if (rank <= 3) return "secondary";
    return "outline";
  };

  if (scores.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No rankings submitted yet</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {scores.map((score, index) => {
        const rank = index + 1;
        const isTopThree = rank <= 3;
        
        return (
          <Card
            key={score.noteId}
            className={`p-4 transition-all ${
              isTopThree ? "border-primary/30 bg-primary/5" : ""
            }`}
            data-testid={`leaderboard-item-${rank}`}
          >
            <div className="flex items-start gap-4">
              {/* Rank */}
              <div className="flex flex-col items-center min-w-[60px]">
                <div className="flex items-center justify-center h-10 w-10">
                  {getRankIcon(rank) || (
                    <span className="text-2xl font-bold text-muted-foreground">
                      {rank}
                    </span>
                  )}
                </div>
                {showRankBadges && (
                  <Badge
                    variant={getRankBadgeVariant(rank)}
                    className="mt-1 text-xs"
                    data-testid={`badge-rank-${rank}`}
                  >
                    Rank {rank}
                  </Badge>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {score.note.category && (
                  <Badge variant="secondary" className="mb-2 text-xs">
                    {score.note.category}
                  </Badge>
                )}
                <p className="text-base leading-relaxed mb-3">
                  {score.note.content}
                </p>

                {/* Stats */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-foreground" data-testid={`score-${rank}`}>
                      {score.totalScore}
                    </span>
                    <span>Borda Points</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-foreground">
                      {score.averageRank.toFixed(1)}
                    </span>
                    <span>Avg Rank</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-foreground">
                      {score.participantCount}
                    </span>
                    <span>Participant{score.participantCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
