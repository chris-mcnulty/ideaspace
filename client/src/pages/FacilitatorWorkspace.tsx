import { useState, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import BrandHeader from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Merge,
  PlayCircle,
  PauseCircle,
  XCircle,
  Users,
  StickyNote,
} from "lucide-react";
import type { Organization, Space, Note, Participant } from "@shared/schema";

export default function FacilitatorWorkspace() {
  const params = useParams() as { org: string; space: string };
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [mergedNoteContent, setMergedNoteContent] = useState("");

  // WebSocket connection for real-time updates
  const handleWebSocketMessage = useCallback((message: { type: string; data: any }) => {
    console.log('[FacilitatorWorkspace] WebSocket message:', message);
    
    switch (message.type) {
      case 'note_created':
      case 'note_updated':
      case 'note_deleted':
      case 'notes_deleted':
        // Invalidate notes query to refetch latest data
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
        break;
      case 'participant_joined':
      case 'participant_left':
        // Invalidate participants query
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/participants`] });
        break;
    }
  }, [params.space]);

  useWebSocket({
    spaceId: params.space,
    onMessage: handleWebSocketMessage,
    onOpen: () => console.log('[FacilitatorWorkspace] WebSocket connected'),
    onClose: () => console.log('[FacilitatorWorkspace] WebSocket disconnected'),
    enabled: !!params.space,
  });

  // Fetch organization
  const { data: org } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  // Fetch space
  const { data: space, isLoading: spaceLoading } = useQuery<Space>({
    queryKey: [`/api/spaces/${params.space}`],
  });

  // Fetch notes
  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${params.space}/notes`],
    enabled: !!params.space,
  });

  // Fetch participants
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: [`/api/spaces/${params.space}/participants`],
    enabled: !!params.space,
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      // Create a facilitator participant if needed, or use existing
      // For MVP, we'll use the first participant or create a system one
      let facilitatorParticipantId = participants.find(p => !p.isGuest)?.id;
      
      if (!facilitatorParticipantId && participants.length > 0) {
        facilitatorParticipantId = participants[0].id;
      }
      
      // If still no participant, create a system participant
      if (!facilitatorParticipantId) {
        const systemParticipantResponse = await apiRequest("POST", "/api/participants", {
          spaceId: params.space,
          userId: null,
          displayName: "Facilitator",
          isGuest: false,
          isOnline: true,
          profileData: { role: "facilitator" },
        });
        const systemParticipant = await systemParticipantResponse.json();
        facilitatorParticipantId = systemParticipant.id;
      }
      
      const response = await apiRequest("POST", "/api/notes", {
        spaceId: params.space,
        participantId: facilitatorParticipantId,
        content,
        category: null,
        isAiCategory: false,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      setIsAddNoteDialogOpen(false);
      setNewNoteContent("");
      toast({
        title: "Note added",
        description: "The note has been preloaded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to add note",
        description: error.message,
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      toast({
        title: "Note deleted",
        description: "The note has been removed",
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

  // Update space status mutation
  const updateSpaceStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("PATCH", `/api/spaces/${params.space}`, {
        status,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}`] });
      toast({
        title: "Session updated",
        description: "The session status has been changed",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update session",
        description: error.message,
      });
    },
  });

  // Filter notes based on search
  const filteredNotes = notes.filter((note) =>
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle note selection
  const toggleNoteSelection = (noteId: string) => {
    const newSelected = new Set(selectedNotes);
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId);
    } else {
      newSelected.add(noteId);
    }
    setSelectedNotes(newSelected);
  };

  // Bulk delete selected notes
  const handleBulkDelete = async () => {
    if (selectedNotes.size === 0) return;
    
    for (const noteId of Array.from(selectedNotes)) {
      await deleteNoteMutation.mutateAsync(noteId);
    }
    setSelectedNotes(new Set());
  };

  // Handle merge notes
  const handleMergeNotes = () => {
    if (selectedNotes.size < 2) {
      toast({
        variant: "destructive",
        title: "Select at least 2 notes",
        description: "You need to select at least 2 notes to merge",
      });
      return;
    }

    // Get selected note contents
    const selectedNoteContents = notes
      .filter(note => selectedNotes.has(note.id))
      .map(note => note.content);
    
    // Pre-fill merged content
    setMergedNoteContent(selectedNoteContents.join(" • "));
    setIsMergeDialogOpen(true);
  };

  // Merge mutation - create merged note and delete originals
  const mergeNotesMutation = useMutation({
    mutationFn: async () => {
      // Get facilitator participant ID
      let facilitatorParticipantId = participants.find(p => !p.isGuest)?.id;
      
      if (!facilitatorParticipantId && participants.length > 0) {
        facilitatorParticipantId = participants[0].id;
      }
      
      if (!facilitatorParticipantId) {
        const systemParticipantResponse = await apiRequest("POST", "/api/participants", {
          spaceId: params.space,
          userId: null,
          displayName: "Facilitator",
          isGuest: false,
          isOnline: true,
          profileData: { role: "facilitator" },
        });
        const systemParticipant = await systemParticipantResponse.json();
        facilitatorParticipantId = systemParticipant.id;
      }
      
      // Create the merged note
      const noteResponse = await apiRequest("POST", "/api/notes", {
        spaceId: params.space,
        participantId: facilitatorParticipantId,
        content: mergedNoteContent,
        category: null,
        isAiCategory: false,
      });
      await noteResponse.json();
      
      // Delete the original notes
      for (const noteId of Array.from(selectedNotes)) {
        await apiRequest("DELETE", `/api/notes/${noteId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      setIsMergeDialogOpen(false);
      setMergedNoteContent("");
      setSelectedNotes(new Set());
      toast({
        title: "Notes merged",
        description: `Combined ${selectedNotes.size} notes into one`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to merge notes",
        description: error.message,
      });
    },
  });

  if (spaceLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  if (!space || !org) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg font-medium">Space not found</p>
      </div>
    );
  }

  const onlineParticipants = participants.filter((p) => p.isOnline);

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader
        orgName={org.name}
        orgLogo={org.logoUrl || undefined}
        userName="Facilitator"
        userRole="facilitator"
      />

      {/* Header Section */}
      <section className="border-b bg-gradient-to-br from-background via-primary/5 to-background">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight">{space.name}</h1>
              <p className="mt-2 text-base text-muted-foreground">{space.purpose}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {onlineParticipants.length} online
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <StickyNote className="h-3 w-3" />
                  {notes.length} notes
                </Badge>
                <Badge variant={space.status === "open" ? "default" : "secondary"}>
                  {space.status}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {space.status === "draft" && (
                <Button
                  onClick={() => updateSpaceStatusMutation.mutate("open")}
                  data-testid="button-start-session"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Start Session
                </Button>
              )}
              {space.status === "open" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => updateSpaceStatusMutation.mutate("draft")}
                    data-testid="button-pause-session"
                  >
                    <PauseCircle className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateSpaceStatusMutation.mutate("closed")}
                    data-testid="button-close-session"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Close Session
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="notes" className="w-full">
          <TabsList>
            <TabsTrigger value="notes" data-testid="tab-notes">
              Notes ({notes.length})
            </TabsTrigger>
            <TabsTrigger value="participants" data-testid="tab-participants">
              Participants ({participants.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-6 space-y-6">
            {/* Notes Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-notes"
                />
              </div>
              <div className="flex gap-2">
                {selectedNotes.size > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleBulkDelete}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete ({selectedNotes.size})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleMergeNotes}
                      data-testid="button-bulk-merge"
                    >
                      <Merge className="mr-2 h-4 w-4" />
                      Merge ({selectedNotes.size})
                    </Button>
                  </>
                )}
                <Dialog open={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-note">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Note
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Preload Note</DialogTitle>
                      <DialogDescription>
                        Add a note to the session before participants start brainstorming
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="note-content">Note Content</Label>
                        <Textarea
                          id="note-content"
                          placeholder="Enter note content..."
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          rows={4}
                          data-testid="textarea-note-content"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsAddNoteDialogOpen(false)}
                        data-testid="button-cancel-add-note"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => addNoteMutation.mutate(newNoteContent)}
                        disabled={!newNoteContent.trim() || addNoteMutation.isPending}
                        data-testid="button-save-note"
                      >
                        Add Note
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Merge Notes Dialog */}
                <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Merge {selectedNotes.size} Notes</DialogTitle>
                      <DialogDescription>
                        Combine the selected notes into a single note. Edit the merged content below.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="merged-content">Merged Content</Label>
                        <Textarea
                          id="merged-content"
                          value={mergedNoteContent}
                          onChange={(e) => setMergedNoteContent(e.target.value)}
                          rows={6}
                          data-testid="textarea-merged-content"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsMergeDialogOpen(false)}
                        data-testid="button-cancel-merge"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => mergeNotesMutation.mutate()}
                        disabled={!mergedNoteContent.trim() || mergeNotesMutation.isPending}
                        data-testid="button-save-merge"
                      >
                        Merge Notes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Notes List */}
            {notesLoading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <p className="text-muted-foreground">Loading notes...</p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
                <div className="text-center">
                  <StickyNote className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">
                    {searchQuery ? "No notes found" : "No notes yet"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {searchQuery
                      ? "Try a different search term"
                      : "Preload notes or wait for participants to add ideas"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredNotes.map((note) => (
                  <Card
                    key={note.id}
                    className={`cursor-pointer transition-all hover-elevate ${
                      selectedNotes.has(note.id) ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => toggleNoteSelection(note.id)}
                    data-testid={`note-card-${note.id}`}
                  >
                    <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                      <CardTitle className="text-sm font-medium line-clamp-2">
                        {note.content}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {note.category && (
                        <Badge variant="secondary" className="text-xs">
                          {note.category}
                        </Badge>
                      )}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast({ title: "Edit feature", description: "Coming soon..." });
                          }}
                          data-testid={`button-edit-note-${note.id}`}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNoteMutation.mutate(note.id);
                          }}
                          data-testid={`button-delete-note-${note.id}`}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="participants" className="mt-6">
            {participants.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
                <div className="text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">No participants yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Waiting for participants to join the session
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {participants.map((participant) => (
                  <Card key={participant.id} data-testid={`participant-card-${participant.id}`}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            participant.isOnline ? "bg-green-500" : "bg-gray-300"
                          }`}
                        />
                        <CardTitle className="text-base">{participant.displayName}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Status: {participant.isOnline ? "Online" : "Offline"}</p>
                        <p>Type: {participant.isGuest ? "Guest" : "Registered"}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
