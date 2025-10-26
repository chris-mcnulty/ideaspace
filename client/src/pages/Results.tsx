import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Trophy, Award, Target, TrendingUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { useAuth } from "@/hooks/use-auth";
import type { PersonalizedResult } from "@shared/schema";

export default function Results() {
  const { org, space: spaceId } = useParams() as { org: string; space: string };
  const { isAuthenticated } = useAuth();

  // Fetch personalized results for the participant
  const { data: personalizedResults, isLoading, error } = useQuery<PersonalizedResult>({
    queryKey: [`/api/spaces/${spaceId}/results/personalized`],
    retry: false,
  });

  // Mutation to generate personalized results
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/spaces/${spaceId}/results/personalized`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/results/personalized`] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-card sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <img 
                src="/logos/synozur-horizontal-color.png" 
                alt="Synozur Alliance" 
                className="h-8"
                data-testid="img-logo"
              />
              <div className="h-6 w-px bg-border/40" />
              <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Aurora
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {isAuthenticated && <UserProfileMenu />}
            </div>
          </div>
        </header>
        
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading your results...</span>
          </div>
        </div>
      </div>
    );
  }

  // If no results found and not errored, offer to generate
  if (!personalizedResults && !error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-card sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <img 
                src="/logos/synozur-horizontal-color.png" 
                alt="Synozur Alliance" 
                className="h-8"
                data-testid="img-logo"
              />
              <div className="h-6 w-px bg-border/40" />
              <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Aurora
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {isAuthenticated && <UserProfileMenu />}
            </div>
          </div>
        </header>
        
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="max-w-md text-center">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate Your Personalized Results
              </CardTitle>
              <CardDescription>
                Your personalized insights are ready to be generated based on your contributions and engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                size="lg"
                className="w-full"
                data-testid="button-generate-results"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Results...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate My Results
                  </>
                )}
              </Button>
              {generateMutation.error && (
                <p className="text-sm text-destructive mt-4">
                  {(generateMutation.error as any).message || "Failed to generate results"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !personalizedResults) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-card sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <img 
                src="/logos/synozur-horizontal-color.png" 
                alt="Synozur Alliance" 
                className="h-8"
                data-testid="img-logo"
              />
              <div className="h-6 w-px bg-border/40" />
              <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Aurora
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {isAuthenticated && <UserProfileMenu />}
            </div>
          </div>
        </header>
        
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Failed to load results. Please try again later.</p>
        </div>
      </div>
    );
  }

  // Parse top contributions
  const topContributions = personalizedResults.topContributions as Array<{
    noteId: string;
    content: string;
    impact: string;
  }>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img 
              src="/logos/synozur-horizontal-color.png" 
              alt="Synozur Alliance" 
              className="h-8"
              data-testid="img-logo"
            />
            <div className="h-6 w-px bg-border/40" />
            <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Aurora
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated && <UserProfileMenu />}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Your Personalized Results</h1>
          </div>
          <p className="text-muted-foreground">
            Insights tailored to your unique contributions and perspective
          </p>
        </div>

        <div className="space-y-6">
          {/* Alignment Score */}
          {personalizedResults.alignmentScore !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Cohort Alignment Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all"
                        style={{ width: `${personalizedResults.alignmentScore}%` }}
                      />
                    </div>
                  </div>
                  <Badge variant="outline" className="text-lg font-bold px-4">
                    {personalizedResults.alignmentScore}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  This score reflects how aligned your ideas and voting patterns were with the overall cohort consensus
                </p>
              </CardContent>
            </Card>
          )}

          {/* Personal Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Your Journey
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap">{personalizedResults.personalSummary}</p>
              </div>
            </CardContent>
          </Card>

          {/* Top Contributions */}
          {topContributions && topContributions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Your Top Contributions
                </CardTitle>
                <CardDescription>
                  The ideas that made the most impact in this session
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topContributions.map((contribution, index) => (
                  <div key={contribution.noteId} className="space-y-2">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-1">
                        #{index + 1}
                      </Badge>
                      <div className="flex-1">
                        <p className="font-medium">{contribution.content}</p>
                        <p className="text-sm text-muted-foreground mt-1">{contribution.impact}</p>
                      </div>
                    </div>
                    {index < topContributions.length - 1 && <div className="border-t" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Personalized Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap">{personalizedResults.insights}</p>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {personalizedResults.recommendations && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Next Steps & Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap">{personalizedResults.recommendations}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
