import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import BrandHeader from "@/components/BrandHeader";
import StickyNote from "@/components/StickyNote";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Users, User, Clock, Vote, ListOrdered, Coins, ClipboardList } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { isPhaseActive } from "@/lib/phaseUtils";
import type { Organization, Space, Note, Participant, Category } from "@shared/schema";

export default function ParticipantView() {
  const params = useParams() as { org: string; space: string };
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [noteContent, setNoteContent] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editContent, setEditContent] = useState("");
  
  // Get participant ID from session storage (set by waiting room)
  const participantId = sessionStorage.getItem("participantId");
  
  // Redirect to waiting room if no participant ID (user hasn't joined through waiting room)
  useEffect(() => {
    if (!participantId && !isAuthenticated) {
      toast({
        title: "Please join the session first",
        description: "You need to join through the waiting room to participate.",
      });
      navigate(`/o/${params.org}/s/${params.space}`);
    }
  }, [participantId, isAuthenticated, params.org, params.space, navigate, toast]);

  // Fetch organization and space
  const { data: org } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  const { data: space } = useQuery<Space>({
    queryKey: [`/api/spaces/${params.space}`],
  });

  // Set page title dynamically
  useEffect(() => {
    if (org && space) {
      document.title = `Nebula - ${org.name} ${space.name} | The Synozur Alliance`;
    } else {
      document.title = "Nebula - Participant View | The Synozur Alliance";
    }
  }, [org, space]);

  // Fetch notes
  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${params.space}/notes`],
    enabled: !!params.space,
  });

  // Fetch participants
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: [`/api/spaces/${params.space}/participants`],
    enabled: !!params.space,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: [`/api/spaces/${params.space}/categories`],
    enabled: !!params.space,
  });

  // WebSocket connection
  const { isConnected } = useWebSocket({
    spaceId: params.space,
    onMessage: (message) => {
      // Handle different message types
      if (message.type === 'note:created' || message.type === 'note:updated' || message.type === 'note:deleted') {
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      }
      if (message.type === 'participant:joined' || message.type === 'participant:left') {
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/participants`] });
      }
      if (message.type === 'category_created' || message.type === 'category_updated' || message.type === 'category_deleted') {
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/categories`] });
      }
      // Handle phase navigation from facilitator
      if (message.type === 'navigate_to_phase') {
        const { phase, spaceId } = message.data;
        
        // Only navigate if this message is for our workspace
        if (spaceId === params.space) {
          const phaseRoutes = {
            vote: `/o/${params.org}/s/${params.space}/vote`,
            rank: `/o/${params.org}/s/${params.space}/rank`,
            marketplace: `/o/${params.org}/s/${params.space}/marketplace`,
            survey: `/o/${params.org}/s/${params.space}/survey`,
            'priority-matrix': `/o/${params.org}/s/${params.space}/priority-matrix`,
            staircase: `/o/${params.org}/s/${params.space}/staircase`,
            ideate: `/o/${params.org}/s/${params.space}/participate`,
            results: `/o/${params.org}/s/${params.space}/results`,
          };
          
          if (phaseRoutes[phase as keyof typeof phaseRoutes]) {
            toast({
              title: "Phase Change",
              description: `Navigating to ${phase === 'results' ? 'results page' : phase.replace('-', ' ') + ' phase'}...`,
            });
            navigate(phaseRoutes[phase as keyof typeof phaseRoutes]);
          }
        }
      }
    },
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!participantId) {
        throw new Error("No participant ID found. Please rejoin the session.");
      }
      return await apiRequest("POST", "/api/notes", {
        spaceId: params.space,
        participantId: participantId,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      setNoteContent("");
      setShowNoteForm(false);
    },
  });

  // Edit note mutation
  const editNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      // ParticipantId is verified server-side via session
      return await apiRequest("PATCH", `/api/notes/${noteId}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      setEditingNote(null);
      setEditContent("");
      toast({
        title: "Note updated",
        description: "Your note has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update note",
        description: error.message,
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      // ParticipantId is verified server-side via session
      return await apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      toast({
        title: "Note deleted",
        description: "Your note has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete note",
        description: error.message,
      });
    },
  });

  const handleCreateNote = () => {
    if (!noteContent.trim()) return;
    createNoteMutation.mutate(noteContent);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setEditContent(note.content);
  };

  const handleSaveEdit = () => {
    if (!editingNote || !editContent.trim()) return;
    editNoteMutation.mutate({ noteId: editingNote.id, content: editContent });
  };

  const handleDeleteNote = (noteId: string) => {
    if (confirm("Are you sure you want to delete this note?")) {
      deleteNoteMutation.mutate(noteId);
    }
  };

  const onlineCount = participants.filter(p => p.isOnline).length;
  const currentParticipant = participants.find(p => p.id === participantId);

  // Group notes by category
  const groupedNotes = notes.reduce((acc, note) => {
    let categoryName = "Uncategorized";
    
    if (note.manualCategoryId) {
      const matchedCategory = categories.find(c => c.id === note.manualCategoryId);
      if (matchedCategory) {
        categoryName = matchedCategory.name;
      }
    }
    
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  const categoryNames = Object.keys(groupedNotes).sort((a, b) => {
    // Sort: Uncategorized last, others alphabetically
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });

  // Generate consistent colors for category badges with dark mode support
  const getCategoryColor = (category: string): string => {
    const colors = [
      "bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border border-blue-300 dark:border-blue-700",
      "bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100 border border-purple-300 dark:border-purple-700",
      "bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 border border-green-300 dark:border-green-700",
      "bg-orange-100 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100 border border-orange-300 dark:border-orange-700",
      "bg-pink-100 dark:bg-pink-900/40 text-pink-900 dark:text-pink-100 border border-pink-300 dark:border-pink-700",
      "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-100 border border-cyan-300 dark:border-cyan-700",
    ];
    if (category === "Uncategorized") {
      return "bg-gray-100 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700";
    }
    const index = category.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Dark Header */}
      <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-8 w-auto object-contain" data-testid="img-org-logo" />
            ) : (
              <img 
                src="/logos/synozur-horizontal-color.png" 
                alt="Synozur Alliance" 
                className="h-8 w-auto object-contain"
                data-testid="img-default-logo"
              />
            )}
            {org?.name && (
              <>
                <div className="h-6 w-px bg-border/40" />
                <span className="text-lg font-semibold" data-testid="text-org-name">
                  {org.name}
                </span>
              </>
            )}
            <div className="h-6 w-px bg-border/40" />
            <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Nebula
            </span>
          </div>
          <div className="flex items-center gap-3">
            {currentParticipant && !isAuthenticated && (
              <Badge variant="outline" className="gap-1" data-testid="badge-current-participant">
                <User className="h-3 w-3" />
                {currentParticipant.displayName}
              </Badge>
            )}
            <ThemeToggle />
            {isAuthenticated && <UserProfileMenu />}
          </div>
        </div>
      </header>

      {/* Dark Top Bar with Session Info */}
      <div className="border-b bg-card px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" data-testid="text-space-name">
              {space?.name}
            </h1>
            <p className="text-sm text-muted-foreground">{space?.purpose}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2" data-testid="status-participants">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {onlineCount} online
              </span>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"} data-testid="status-connection">
              <div className={`mr-1 h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>
      </div>

      {/* WHITEBOARD AREA - with proper dark mode support */}
      <main className="flex-1 overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="h-full overflow-auto p-8">
          <div className="mx-auto max-w-7xl">
            {/* Create Note Button (floating on white) - Only show when ideation is active */}
            {!showNoteForm && space && isPhaseActive(space, "ideation") && (
              <Button
                onClick={() => setShowNoteForm(true)}
                className="mb-6"
                data-testid="button-create-note"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Idea
              </Button>
            )}
            
            {/* Ideation closed message */}
            {!showNoteForm && space && !isPhaseActive(space, "ideation") && (
              <div className="mb-6 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                <Clock className="mr-2 inline-block h-4 w-4" />
                Ideation phase is not currently active. New ideas cannot be added at this time.
              </div>
            )}

            {/* Note Creation Form */}
            {showNoteForm && (
              <Card className="mb-6 max-w-md border-2 border-primary/20 bg-white dark:bg-gray-800 p-4">
                <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Create New Idea</h3>
                <Textarea
                  placeholder="What's your idea or insight?"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="mb-3 min-h-24 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  data-testid="input-note-content"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateNote}
                    disabled={!noteContent.trim() || createNoteMutation.isPending}
                    data-testid="button-submit-note"
                  >
                    {createNoteMutation.isPending ? "Adding..." : "Add to Board"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNoteForm(false);
                      setNoteContent("");
                    }}
                    data-testid="button-cancel-note"
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            )}

            {/* Notes Grid (sticky notes on whiteboard) */}
            {notes.length === 0 && !showNoteForm && (
              <div className="py-12 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  No ideas yet. Be the first to add one!
                </p>
              </div>
            )}

            {/* Grouped by Category */}
            {notes.length > 0 && (
              <div className="space-y-8">
                {categoryNames.map((categoryName) => (
                  <div key={categoryName} className="space-y-4">
                    {/* Category Header */}
                    <div className="flex items-center gap-3">
                      <Badge 
                        className={`px-3 py-1.5 text-sm font-semibold ${getCategoryColor(categoryName)}`}
                        data-testid={`badge-category-${categoryName}`}
                      >
                        {categoryName}
                      </Badge>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {groupedNotes[categoryName].length} {groupedNotes[categoryName].length === 1 ? 'idea' : 'ideas'}
                      </span>
                    </div>

                    {/* Notes in this category */}
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {groupedNotes[categoryName].map((note) => {
                        // Check if participant can edit/delete this note
                        const isOwner = note.participantId === participantId;
                        const canEdit = isOwner && space?.status === "open";
                        const canDelete = isOwner && space?.status === "open";

                        return (
                          <StickyNote
                            key={note.id}
                            id={note.id}
                            content={note.content}
                            author={participants.find(p => p.id === note.participantId)?.displayName}
                            timestamp={new Date(note.createdAt)}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            onEdit={() => handleEditNote(note)}
                            onDelete={() => handleDeleteNote(note.id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Dark Footer with Navigation */}
      <footer className="border-t bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Status: {space?.status}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {notes.length} {notes.length === 1 ? 'idea' : 'ideas'} shared
            </div>
          </div>
          
          {/* Navigation Buttons - Only show when phases are active */}
          <div className="flex items-center gap-3">
            {space && isPhaseActive(space, "voting") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/o/${params.org}/s/${params.space}/vote`)}
                className="gap-2"
                data-testid="button-go-to-voting"
              >
                <Vote className="h-4 w-4" />
                Pairwise Voting
              </Button>
            )}
            {space && isPhaseActive(space, "ranking") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/o/${params.org}/s/${params.space}/rank`)}
                className="gap-2"
                data-testid="button-go-to-ranking"
              >
                <ListOrdered className="h-4 w-4" />
                Stack Ranking
              </Button>
            )}
            {space && isPhaseActive(space, "marketplace") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/o/${params.org}/s/${params.space}/marketplace`)}
                className="gap-2"
                data-testid="button-go-to-marketplace"
              >
                <Coins className="h-4 w-4" />
                Marketplace
              </Button>
            )}
            {space && isPhaseActive(space, "survey") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/o/${params.org}/s/${params.space}/survey`)}
                className="gap-2"
                data-testid="button-go-to-survey"
              >
                <ClipboardList className="h-4 w-4" />
                Survey
              </Button>
            )}
          </div>
        </div>
      </footer>

      {/* Edit Note Dialog */}
      <Dialog open={editingNote !== null} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Make changes to your note. The same category will be preserved.
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            placeholder="Enter your updated note content..."
            data-testid="input-edit-note-content"
            className="resize-none"
          />

          {editingNote?.category && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Category:</span>
              <Badge variant="secondary">{editingNote.category}</Badge>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingNote(null)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editContent.trim() || editNoteMutation.isPending}
              data-testid="button-save-edit"
            >
              {editNoteMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
