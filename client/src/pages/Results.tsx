import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Trophy, Award, Target, TrendingUp, Download, Mail } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { PersonalizedResult, Organization, Space, Participant } from "@shared/schema";
import { useEffect } from "react";
import { generatePersonalizedResultsPDF } from "@/lib/pdfGenerator";

export default function Results() {
  const { org, space: spaceId } = useParams() as { org: string; space: string };
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Nebula - Results | The Synozur Alliance";
  }, []);

  // Fetch organization
  const { data: organization } = useQuery<Organization>({
    queryKey: [`/api/organizations/${org}`],
    enabled: !!org,
  });

  // Fetch space
  const { data: space } = useQuery<Space>({
    queryKey: [`/api/spaces/${spaceId}`],
    enabled: !!spaceId,
  });

  // Fetch personalized results for the participant
  const { data: personalizedResults, isLoading, error } = useQuery<PersonalizedResult>({
    queryKey: [`/api/spaces/${spaceId}/results/personalized`],
    retry: false,
    enabled: !!spaceId,
  });

  // Fetch participant data for PDF generation
  const { data: participant } = useQuery<Participant>({
    queryKey: [`/api/participants/${personalizedResults?.participantId}`],
    enabled: !!personalizedResults?.participantId,
  });

  // Download results as branded PDF
  const handleDownload = async () => {
    if (!personalizedResults || !organization || !space || !participant) {
      toast({
        variant: "destructive",
        title: "Cannot download PDF",
        description: "Results, workspace, organization, or participant data not yet loaded",
      });
      return;
    }

    try {
      await generatePersonalizedResultsPDF(
        personalizedResults,
        {
          orgName: organization.name,
          orgLogo: organization.logoUrl || undefined,
          primaryColor: organization.primaryColor || undefined,
        },
        participant.displayName,
        space.name
      );
      toast({
        title: "PDF Downloaded",
        description: "Your personalized results have been downloaded as a branded PDF",
      });
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast({
        variant: "destructive",
        title: "Failed to generate PDF",
        description: "Please try again later",
      });
    }
  };

  // Email results mutation
  const emailResultsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/spaces/${spaceId}/results/email`, {});
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Your personalized results have been emailed to you",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to send email",
        description: error.message || "Please try again later",
      });
    },
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
                Nebula
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
                Nebula
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

  // Check if error is 401 (not a participant)
  const isNotParticipant = error && (error as any).message?.includes("No participant session");

  if (error && !personalizedResults) {
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
                Nebula
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
              <CardTitle>Personalized Results</CardTitle>
              <CardDescription>
                {isNotParticipant 
                  ? "This page is for workspace participants only."
                  : "Failed to load results. Please try again later."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isNotParticipant ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    To view personalized results, you need to join this workspace as a participant. 
                    If you're a facilitator or admin, you can view cohort results from the facilitator workspace.
                  </p>
                  <Button
                    onClick={() => window.location.href = `/o/${org}/s/${spaceId}/facilitate`}
                    variant="outline"
                    data-testid="button-go-to-facilitator"
                  >
                    View Cohort Results
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Unable to load your personalized results. Please try refreshing the page.
                </p>
              )}
            </CardContent>
          </Card>
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
      <style>
        {`
          @media print {
            header {
              display: none !important;
            }
            .print-hide {
              display: none !important;
            }
          }
        `}
      </style>
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
              Nebula
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
          {personalizedResults.insights && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Personalized Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert space-y-4">
                  {personalizedResults.insights.split('\n\n').filter(p => p.trim()).map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-wrap leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
                <div className="prose prose-sm max-w-none dark:prose-invert space-y-4">
                  {personalizedResults.recommendations.split('\n\n').filter(p => p.trim()).map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-wrap leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Download and Email Actions */}
          <div className="flex flex-wrap gap-3 pt-4 print-hide">
            <Button
              onClick={handleDownload}
              variant="default"
              data-testid="button-download-results"
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button
              onClick={() => emailResultsMutation.mutate()}
              variant="outline"
              disabled={emailResultsMutation.isPending}
              data-testid="button-email-results"
            >
              {emailResultsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Email Me
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
