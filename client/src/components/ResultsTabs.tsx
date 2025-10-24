import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Award } from "lucide-react";

interface ResultItem {
  id: string;
  content: string;
  category?: string;
  score: number;
  winRate?: number;
}

interface ResultsTabsProps {
  topByVotes: ResultItem[];
  topByWinRate: ResultItem[];
  finalRanking: ResultItem[];
}

export default function ResultsTabs({
  topByVotes,
  topByWinRate,
  finalRanking,
}: ResultsTabsProps) {
  const renderItem = (item: ResultItem, index: number, showWinRate = false) => {
    const medals = [
      <Trophy className="h-5 w-5 text-yellow-500" />,
      <Award className="h-5 w-5 text-gray-400" />,
      <Award className="h-5 w-5 text-amber-600" />,
    ];

    return (
      <div
        key={item.id}
        className="flex items-center gap-4 rounded-lg border p-4 hover-elevate"
        data-testid={`result-item-${index}`}
      >
        <div className="flex-shrink-0">
          {index < 3 ? medals[index] : (
            <div className="flex h-5 w-5 items-center justify-center text-sm font-semibold text-muted-foreground">
              {index + 1}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm leading-snug">{item.content}</p>
          {item.category && (
            <Badge variant="outline" className="mt-2 text-xs">
              {item.category}
            </Badge>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-2xl font-bold tabular-nums">{item.score}</p>
          {showWinRate && item.winRate !== undefined && (
            <p className="text-xs text-muted-foreground">{item.winRate}% win rate</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Tabs defaultValue="votes" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="votes" data-testid="tab-votes">
          <TrendingUp className="mr-2 h-4 w-4" />
          Top by Votes
        </TabsTrigger>
        <TabsTrigger value="winrate" data-testid="tab-winrate">
          <Trophy className="mr-2 h-4 w-4" />
          Top by Win Rate
        </TabsTrigger>
        <TabsTrigger value="ranking" data-testid="tab-ranking">
          <Award className="mr-2 h-4 w-4" />
          Final Ranking
        </TabsTrigger>
      </TabsList>

      <TabsContent value="votes" className="mt-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Items with Most Votes</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {topByVotes.map((item, index) => renderItem(item, index))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="winrate" className="mt-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Highest Win Rates</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {topByWinRate.map((item, index) => renderItem(item, index, true))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ranking" className="mt-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Aggregated Rankings (Borda Count)</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {finalRanking.map((item, index) => renderItem(item, index))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
