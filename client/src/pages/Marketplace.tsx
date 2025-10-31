import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Coins, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import BrandHeader from "@/components/BrandHeader";
import type { Note } from "@shared/schema";

const DEFAULT_COIN_BUDGET = 100;

interface NoteAllocation {
  noteId: string;
  coins: number;
}

export default function Marketplace() {
  const params = useParams<{ org: string; space: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  
  useEffect(() => {
    document.title = "Nebula - Marketplace Allocation | The Synozur Alliance";
  }, []);
  
  // Get participant ID from session storage
  const participantId = sessionStorage.getItem("participantId");

  const { data: notesData, isLoading } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${params.space}/notes`],
    enabled: !!participantId,
  });

  const { data: existingAllocations } = useQuery<Array<{ noteId: string; coinsAllocated: number }>>({
    queryKey: [`/api/spaces/${params.space}/participants/${participantId}/marketplace-allocations`],
    enabled: !!participantId,
    select: (data: any) => data.map((a: any) => ({ noteId: a.noteId, coinsAllocated: a.coinsAllocated })),
  });

  const { data: budgetData } = useQuery<{ totalBudget: number; remainingBudget: number; allocatedBudget: number }>({
    queryKey: [`/api/spaces/${params.space}/participants/${participantId}/marketplace-budget`],
    enabled: !!participantId,
  });

  const coinBudget = budgetData?.totalBudget || DEFAULT_COIN_BUDGET;

  // Initialize allocations (map noteId -> coins)
  const [allocations, setAllocations] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (existingAllocations && notesData) {
      // Filter to only show notes visible in marketplace (defaults to true)
      const visibleNotes = notesData.filter(note => note.visibleInMarketplace !== false);
      
      const allocationMap = new Map<string, number>();
      existingAllocations.forEach(a => {
        allocationMap.set(a.noteId, a.coinsAllocated);
      });
      // Initialize all visible notes with 0 if not already allocated
      visibleNotes.forEach(note => {
        if (!allocationMap.has(note.id)) {
          allocationMap.set(note.id, 0);
        }
      });
      setAllocations(allocationMap);
    } else if (notesData) {
      // Filter to only show notes visible in marketplace (defaults to true)
      const visibleNotes = notesData.filter(note => note.visibleInMarketplace !== false);
      
      // No existing allocations, initialize all visible notes with 0
      const allocationMap = new Map<string, number>();
      visibleNotes.forEach(note => {
        allocationMap.set(note.id, 0);
      });
      setAllocations(allocationMap);
    }
  }, [notesData, existingAllocations]);

  const totalAllocated = Array.from(allocations.values()).reduce((sum, coins) => sum + coins, 0);
  const remainingBudget = coinBudget - totalAllocated;
  const isOverBudget = totalAllocated > coinBudget;

  const submitAllocationMutation = useMutation({
    mutationFn: async (allocationData: Array<{ noteId: string; coins: number }>) => {
      const response = await apiRequest("POST", "/api/marketplace-allocations/bulk", {
        spaceId: params.space,
        allocations: allocationData,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/participants/${participantId}/marketplace-allocations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/participants/${participantId}/marketplace-budget`] });
      toast({
        title: "Allocations Submitted",
        description: "Your coin allocations have been saved successfully",
      });
      // Navigate back to participate page
      navigate(`/o/${params.org}/s/${params.space}/participate`);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Failed to submit allocations",
      });
    },
  });

  function handleAllocationChange(noteId: string, value: string) {
    const coins = parseInt(value) || 0;
    const newAllocations = new Map(allocations);
    newAllocations.set(noteId, Math.max(0, coins));
    setAllocations(newAllocations);
  }

  function handleQuickAdd(noteId: string, amount: number) {
    const currentCoins = allocations.get(noteId) || 0;
    const newCoins = Math.max(0, currentCoins + amount);
    const newAllocations = new Map(allocations);
    newAllocations.set(noteId, newCoins);
    setAllocations(newAllocations);
  }

  function handleSubmit() {
    if (isOverBudget) {
      toast({
        variant: "destructive",
        title: "Over Budget",
        description: `You have allocated ${totalAllocated} coins but only have ${coinBudget} available`,
      });
      return;
    }

    const allocationData = Array.from(allocations.entries()).map(([noteId, coins]) => ({
      noteId,
      coins,
    }));
    
    submitAllocationMutation.mutate(allocationData);
  }

  if (!participantId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <p className="text-muted-foreground">Please join the workspace first</p>
          <Button onClick={() => navigate(`/o/${params.org}/s/${params.space}`)} className="mt-4" data-testid="button-go-to-workspace">
            Go to Workspace
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading || !notesData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading ideas...</p>
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
              Nebula
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated && <UserProfileMenu />}
          </div>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Marketplace Allocation</h1>
          <p className="text-muted-foreground mb-6">
            Distribute your {coinBudget} coins among the ideas below. Allocate more coins to ideas you value most.
          </p>

          <Card className="p-6 mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  <span className="font-medium">Budget Status</span>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${isOverBudget ? 'text-destructive' : 'text-primary'}`}>
                    {remainingBudget} / {coinBudget}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Coins Remaining
                  </div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Allocated: {totalAllocated}</span>
                  <span>{Math.round((totalAllocated / coinBudget) * 100)}%</span>
                </div>
                <Progress value={(totalAllocated / coinBudget) * 100} className="h-2" />
              </div>

              {isOverBudget && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>You've exceeded your budget by {totalAllocated - coinBudget} coins</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4 mb-8">
          {notesData
            .filter(note => note.visibleInMarketplace !== false)
            .map((note) => {
            const coins = allocations.get(note.id) || 0;
            return (
              <Card key={note.id} className="p-4" data-testid={`allocation-item-${note.id}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {note.category && (
                      <Badge variant="secondary" className="mb-2 text-xs">
                        {note.category}
                      </Badge>
                    )}
                    <p className="text-base leading-relaxed mb-3">
                      {note.content}
                    </p>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickAdd(note.id, 5)}
                        disabled={submitAllocationMutation.isPending}
                        data-testid={`button-quick-add-5-${note.id}`}
                      >
                        +5
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickAdd(note.id, 10)}
                        disabled={submitAllocationMutation.isPending}
                        data-testid={`button-quick-add-10-${note.id}`}
                      >
                        +10
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickAdd(note.id, -5)}
                        disabled={submitAllocationMutation.isPending || coins === 0}
                        data-testid={`button-quick-subtract-5-${note.id}`}
                      >
                        -5
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min="0"
                        value={coins}
                        onChange={(e) => handleAllocationChange(note.id, e.target.value)}
                        className="w-20 text-center"
                        disabled={submitAllocationMutation.isPending}
                        data-testid={`input-coins-${note.id}`}
                      />
                    </div>
                    {coins > 0 && (
                      <Badge variant="default" className="text-xs">
                        {Math.round((coins / coinBudget) * 100)}% of budget
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-4 sticky bottom-4 bg-background/95 backdrop-blur p-4 rounded-lg border">
          <Button
            variant="outline"
            onClick={() => navigate(`/o/${params.org}/s/${params.space}/participate`)}
            disabled={submitAllocationMutation.isPending}
            className="flex-1"
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitAllocationMutation.isPending || isOverBudget}
            className="flex-1"
            data-testid="button-submit"
          >
            {submitAllocationMutation.isPending ? (
              <>Submitting...</>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Submit Allocations
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
