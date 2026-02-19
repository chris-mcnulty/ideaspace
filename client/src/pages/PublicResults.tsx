import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Award, Target, TrendingUp, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Organization, Space } from "@shared/schema";
import { useEffect } from "react";
import { SynozurAppSwitcher } from "@/components/SynozurAppSwitcher";

interface CohortResultData {
  id: string;
  spaceId: string;
  summary: string;
  keyThemes: string[];
  topIdeas: Array<{ 
    noteId: string; 
    content: string; 
    category?: string;
    pairwiseWins?: number;
    bordaScore?: number;
    marketplaceCoins?: number;
    matrixPosition?: { x: number; y: number; xLabel?: string; yLabel?: string };
    staircaseScore?: number;
    avgSurveyScore?: number;
    overallRank: number;
  }>;
  surveyAnalysis?: string;
  insights: string[];
  recommendations: string[];
  participantCount: number;
  totalVotes: number;
  generatedAt: string;
}

export default function PublicResults() {
  const params = useParams<{ org: string; space: string }>();

  // Fetch organization data
  const { data: org } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  // Fetch workspace data
  const { data: space } = useQuery<Space>({
    queryKey: [`/api/spaces/${params.space}`],
  });

  // Fetch public cohort results
  const { data: cohortResult, isLoading, error } = useQuery<CohortResultData>({
    queryKey: [`/api/spaces/${params.space}/public-results`],
  });

  // Set page title
  useEffect(() => {
    if (org && space) {
      document.title = `Results - ${space.name} | ${org.name}`;
    } else {
      document.title = "Results | Nebula";
    }
  }, [org, space]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header org={org} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !cohortResult) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header org={org} />
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-md text-center p-8">
            <CardContent>
              <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Results Not Available</h2>
              <p className="text-muted-foreground">
                Results have not been generated yet or public sharing is not enabled for this workspace.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header org={org} />
      
      <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">
        {/* Workspace Header */}
        <div className="text-center mb-8">
          {org && (
            <p className="text-sm text-muted-foreground mb-1">{org.name}</p>
          )}
          {space && (
            <h1 className="text-3xl font-bold mb-2">{space.name}</h1>
          )}
          <p className="text-muted-foreground">Cohort Results Summary</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{cohortResult.participantCount}</p>
              <p className="text-xs text-muted-foreground">Participants</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{cohortResult.totalVotes}</p>
              <p className="text-xs text-muted-foreground">Total Votes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-2xl font-bold">{cohortResult.topIdeas?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Top Ideas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{cohortResult.keyThemes?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Key Themes</p>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        {cohortResult.summary && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{cohortResult.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Key Themes */}
        {cohortResult.keyThemes && cohortResult.keyThemes.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Key Themes</CardTitle>
              <CardDescription>Major themes that emerged from the session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {cohortResult.keyThemes.map((theme, index) => (
                  <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                    {theme}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Ideas */}
        {cohortResult.topIdeas && cohortResult.topIdeas.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top Ideas
              </CardTitle>
              <CardDescription>The highest-ranked ideas from the session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cohortResult.topIdeas.map((idea, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="flex-shrink-0">
                      {index === 0 && <Trophy className="h-6 w-6 text-yellow-500" />}
                      {index === 1 && <Award className="h-6 w-6 text-gray-400" />}
                      {index === 2 && <Award className="h-6 w-6 text-amber-600" />}
                      {index > 2 && (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{idea.content}</h4>
                      {idea.category && (
                        <Badge variant="secondary" className="mt-1">{idea.category}</Badge>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {(idea.pairwiseWins != null && idea.pairwiseWins > 0) && (
                          <span>Pairwise: {idea.pairwiseWins} wins</span>
                        )}
                        {(idea.bordaScore != null && idea.bordaScore > 0) && (
                          <span>Borda: {idea.bordaScore}</span>
                        )}
                        {(idea.marketplaceCoins != null && idea.marketplaceCoins > 0) && (
                          <span>Marketplace: {idea.marketplaceCoins} coins</span>
                        )}
                        {idea.matrixPosition && (
                          <span>
                            Matrix: {idea.matrixPosition.xLabel || 'X'}={idea.matrixPosition.x}%, {idea.matrixPosition.yLabel || 'Y'}={idea.matrixPosition.y}%
                          </span>
                        )}
                        {idea.staircaseScore != null && (
                          <span>Staircase: {idea.staircaseScore}</span>
                        )}
                        {idea.avgSurveyScore != null && (
                          <span>Survey: {Number(idea.avgSurveyScore).toFixed(1)}/5</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Survey Analysis */}
        {cohortResult.surveyAnalysis && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Survey Analysis</CardTitle>
              <CardDescription>Patterns from participant survey ratings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap text-muted-foreground">{cohortResult.surveyAnalysis}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insights */}
        {cohortResult.insights && cohortResult.insights.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
              <CardDescription>Important observations from the data</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {cohortResult.insights.map((insight, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-muted-foreground">{insight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {cohortResult.recommendations && cohortResult.recommendations.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
              <CardDescription>Suggested next steps based on the results</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {cohortResult.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">{index + 1}.</span>
                    <span className="text-muted-foreground">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground mt-8 pb-8">
          <p>Generated on {new Date(cohortResult.generatedAt).toLocaleDateString()}</p>
          <p className="mt-1">Powered by Nebula - The Synozur Alliance</p>
        </div>
      </main>
    </div>
  );
}

function Header({ org }: { org?: Organization }) {
  return (
    <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="h-8 w-auto object-contain" />
          ) : (
            <img 
              src="/logos/synozur-horizontal-color.png" 
              alt="Synozur Alliance" 
              className="h-8 w-auto object-contain"
            />
          )}
          {org?.name && (
            <>
              <div className="h-6 w-px bg-border/40" />
              <span className="text-lg font-semibold">{org.name}</span>
            </>
          )}
          <div className="h-6 w-px bg-border/40" />
          <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Nebula
          </span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
