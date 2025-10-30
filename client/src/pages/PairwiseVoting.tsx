import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BrandHeader from "@/components/BrandHeader";
import DuelCard from "@/components/DuelCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { Note, Organization, Space } from "@shared/schema";

interface NotePair {
  noteA: Note;
  noteB: Note;
}

interface VotingProgress {
  totalPairs: number;
  completedPairs: number;
  percentComplete: number;
  isComplete: boolean;
}

interface NextPairResponse {
  pair: NotePair | null;
  progress: VotingProgress;
  message?: string;
}

export default function PairwiseVoting() {
  const params = useParams<{ org: string; space: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [participantId, setParticipantId] = useState<string | null>(null);

  // Get participantId from sessionStorage
  useEffect(() => {
    const storedId = sessionStorage.getItem("participantId");
    if (!storedId) {
      toast({
        variant: "destructive",
        title: "Session Required",
        description: "Please join the session first",
      });
      navigate(`/o/${params.org}/s/${params.space}/join`);
      return;
    }
    setParticipantId(storedId);
  }, [params.org, params.space, navigate, toast]);

  // Fetch organization data
  const { data: org } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  // Fetch workspace data
  const { data: space } = useQuery<Space>({
    queryKey: [`/api/spaces/${params.space}`],
  });

  // Fetch next pair
  const { data, isLoading, error, refetch } = useQuery<NextPairResponse>({
    queryKey: [`/api/spaces/${params.space}/participants/${participantId}/next-pair`],
    enabled: !!participantId,
    refetchOnWindowFocus: false,
  });

  // Record vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ winnerId, loserId }: { winnerId: string; loserId: string }) => {
      const response = await apiRequest("POST", "/api/votes", {
        spaceId: params.space,
        participantId,
        winnerNoteId: winnerId,
        loserNoteId: loserId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/participants/${participantId}/next-pair`] });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Vote Failed",
        description: error.message,
      });
    },
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (voteMutation.isPending || !data?.pair) return;
      
      if (e.key === "1") {
        voteMutation.mutate({
          winnerId: data.pair.noteA.id,
          loserId: data.pair.noteB.id,
        });
      } else if (e.key === "2") {
        voteMutation.mutate({
          winnerId: data.pair.noteB.id,
          loserId: data.pair.noteA.id,
        });
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [data?.pair, voteMutation]);

  const handleChoose = (winnerId: string, loserId: string) => {
    voteMutation.mutate({ winnerId, loserId });
  };

  if (isLoading || !participantId) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-full items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <img 
                src="/logos/synozur-horizontal-color.png" 
                alt="Synozur Alliance" 
                className="h-8 w-auto object-contain"
              />
              <div className="h-6 w-px bg-border/40" />
              <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Aurora
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {isAuthenticated && <UserProfileMenu />}
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-full items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <img 
                src="/logos/synozur-horizontal-color.png" 
                alt="Synozur Alliance" 
                className="h-8 w-auto object-contain"
              />
              <div className="h-6 w-px bg-border/40" />
              <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Aurora
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {isAuthenticated && <UserProfileMenu />}
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="p-8 max-w-md text-center">
            <p className="text-destructive">Failed to load voting data</p>
            <Button onClick={() => refetch()} className="mt-4">
              Try Again
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const progress = data?.progress || { totalPairs: 0, completedPairs: 0, percentComplete: 0, isComplete: false };

  // Completion state
  if (data?.progress?.isComplete || !data?.pair) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-full items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <img 
                src="/logos/synozur-horizontal-color.png" 
                alt="Synozur Alliance" 
                className="h-8 w-auto object-contain"
              />
              <div className="h-6 w-px bg-border/40" />
              <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Aurora
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {isAuthenticated && <UserProfileMenu />}
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="p-12 max-w-2xl text-center space-y-6">
            {org && space && (
              <div className="space-y-1 pb-4 border-b">
                <p className="text-sm text-muted-foreground">{org.name}</p>
                <h2 className="text-lg font-semibold">{space.name}</h2>
              </div>
            )}
            <CheckCircle2 className="h-24 w-24 text-primary mx-auto" />
            <div>
              <h1 className="text-3xl font-bold mb-2">Voting Complete!</h1>
              <p className="text-lg text-muted-foreground">
                You've compared all {progress.totalPairs} pairs of ideas
              </p>
            </div>
            <p className="text-muted-foreground">
              {data?.message || "Thank you for your participation. Your input helps prioritize the most important ideas."}
            </p>
            <Button 
              onClick={() => navigate(`/o/${params.org}/s/${params.space}/participate`)}
              size="lg"
              data-testid="button-return-to-space"
            >
              Return to Space
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img 
              src="/logos/synozur-horizontal-color.png" 
              alt="Synozur Alliance" 
              className="h-8 w-auto object-contain"
            />
            <div className="h-6 w-px bg-border/40" />
            <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Aurora
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated && <UserProfileMenu />}
          </div>
        </div>
      </header>
      
      <main className="flex-1 p-8 space-y-8">
        {/* Workspace Info Section */}
        {org && space && (
          <div className="max-w-4xl mx-auto text-center space-y-2">
            <p className="text-sm text-muted-foreground">{org.name}</p>
            <h2 className="text-xl font-semibold">{space.name}</h2>
            {space.purpose && (
              <p className="text-base text-muted-foreground max-w-2xl mx-auto">
                {space.purpose}
              </p>
            )}
          </div>
        )}

        {/* Progress Section */}
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Pairwise Voting</h1>
              <p className="text-muted-foreground">
                Choose the more important idea from each pair
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Progress</div>
              <div className="text-2xl font-bold">
                {progress.completedPairs} / {progress.totalPairs}
              </div>
            </div>
          </div>
          
          <Progress 
            value={progress.percentComplete} 
            className="h-3"
            data-testid="voting-progress-bar"
          />
          
          <p className="text-sm text-muted-foreground text-center">
            {progress.totalPairs - progress.completedPairs} pairs remaining
          </p>
        </div>

        {/* Voting Cards */}
        <div className="py-8">
          <DuelCard
            noteA={data.pair.noteA}
            noteB={data.pair.noteB}
            onChoose={handleChoose}
            isLoading={voteMutation.isPending}
          />
        </div>

        {/* Keyboard Hint */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Tip: Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">1</kbd> or <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">2</kbd> to vote quickly</p>
        </div>
      </main>
    </div>
  );
}
