import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, GripVertical, Trophy } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import BrandHeader from "@/components/BrandHeader";
import type { Note } from "@shared/schema";

interface SortableNoteProps {
  note: Note;
  rank: number;
}

function SortableNote({ note, rank }: SortableNoteProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="p-4 mb-3 cursor-move hover-elevate"
      data-testid={`ranking-item-${note.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-1 min-w-[40px]">
          <div className="text-2xl font-bold text-primary">
            #{rank}
          </div>
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`drag-handle-${note.id}`}
          >
            <GripVertical className="h-5 w-5" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          {note.category && (
            <Badge variant="secondary" className="mb-2 text-xs">
              {note.category}
            </Badge>
          )}
          <p className="text-base leading-relaxed">
            {note.content}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function StackRanking() {
  const params = useParams<{ org: string; space: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  
  // Get participant ID from session storage (consistent with WaitingRoom/ParticipantView)
  const participantId = sessionStorage.getItem("participantId");

  const { data: notesData, isLoading } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${params.space}/notes`],
    enabled: !!participantId,
  });

  const { data: existingRankings } = useQuery<Array<{ noteId: string; rank: number }>>({
    queryKey: [`/api/spaces/${params.space}/participants/${participantId}/rankings`],
    enabled: !!participantId,
    select: (data: any) => data.map((r: any) => ({ noteId: r.noteId, rank: r.rank })),
  });

  // Initialize notes in ranked order (or default order if no existing rankings)
  const [rankedNotes, setRankedNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (notesData) {
      // Filter to only show notes visible in ranking (defaults to true)
      const visibleNotes = notesData.filter(note => note.visibleInRanking !== false);
      
      if (existingRankings && existingRankings.length > 0) {
        // Sort notes by existing rank
        const sorted = [...visibleNotes].sort((a, b) => {
          const rankA = existingRankings.find(r => r.noteId === a.id)?.rank || 9999;
          const rankB = existingRankings.find(r => r.noteId === b.id)?.rank || 9999;
          return rankA - rankB;
        });
        setRankedNotes(sorted);
      } else {
        // No existing rankings, use default order
        setRankedNotes([...visibleNotes]);
      }
    }
  }, [notesData, existingRankings]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const submitRankingMutation = useMutation({
    mutationFn: async (rankings: Array<{ noteId: string; rank: number }>) => {
      const response = await apiRequest("POST", "/api/rankings/bulk", {
        participantId,
        spaceId: params.space,
        rankings,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/participants/${participantId}/rankings`] });
      toast({
        title: "Rankings Submitted",
        description: "Your rankings have been saved successfully",
      });
      // Navigate back to participate page
      navigate(`/o/${params.org}/s/${params.space}/participate`);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Failed to submit rankings",
      });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRankedNotes((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function handleSubmit() {
    const rankings = rankedNotes.map((note, index) => ({
      noteId: note.id,
      rank: index + 1,
    }));
    submitRankingMutation.mutate(rankings);
  }

  if (!participantId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <p className="text-muted-foreground">Please join the workspace first</p>
          <Button onClick={() => navigate(`/o/${params.org}/s/${params.space}`)} className="mt-4">
            Go to Workspace
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8">
          <p className="text-muted-foreground">Loading notes...</p>
        </Card>
      </div>
    );
  }

  if (!notesData || notesData.length === 0) {
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
            <Trophy className="h-24 w-24 text-muted-foreground mx-auto" />
            <div>
              <h1 className="text-3xl font-bold mb-2">No Notes to Rank</h1>
              <p className="text-lg text-muted-foreground">
                There are no notes available for ranking at this time.
              </p>
            </div>
            <Button onClick={() => navigate(`/o/${params.org}/s/${params.space}/participate`)}>
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
      
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold" data-testid="heading-stack-ranking">
              Stack Ranking
            </h1>
            <p className="text-lg text-muted-foreground">
              Drag and drop to rank ideas from most important (top) to least important (bottom)
            </p>
          </div>

          {/* Instructions Card */}
          <Card className="p-6 bg-primary/5 border-primary/20">
            <h2 className="font-semibold mb-2 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              How to Rank
            </h2>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Drag notes using the grip icon to reorder them</li>
              <li>• #1 should be the MOST important idea</li>
              <li>• Lower numbers = higher priority</li>
              <li>• You must rank all {rankedNotes.length} ideas before submitting</li>
            </ul>
          </Card>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span data-testid="text-ranking-count">Ranking {rankedNotes.length} ideas</span>
              <span>Ready to submit</span>
            </div>
            <Progress value={100} className="h-2" />
          </div>

          {/* Sortable List */}
          <div data-testid="sortable-list">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={rankedNotes.map(n => n.id)}
                strategy={verticalListSortingStrategy}
              >
                {rankedNotes.map((note, index) => (
                  <SortableNote key={note.id} note={note} rank={index + 1} />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button
              size="lg"
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitRankingMutation.isPending}
              data-testid="button-submit-ranking"
            >
              {submitRankingMutation.isPending ? "Submitting..." : "Submit Rankings"}
              {!submitRankingMutation.isPending && <CheckCircle2 className="ml-2 h-5 w-5" />}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate(`/o/${params.org}/s/${params.space}/participate`)}
              data-testid="button-cancel-ranking"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
