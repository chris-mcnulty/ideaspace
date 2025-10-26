import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import BrandHeader from "@/components/BrandHeader";
import StickyNote from "@/components/StickyNote";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Clock } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Organization, Space, Note, Participant } from "@shared/schema";

export default function ParticipantView() {
  const params = useParams() as { org: string; space: string };
  const [noteContent, setNoteContent] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  
  // Get participant ID from session storage (set by waiting room)
  const participantId = sessionStorage.getItem("participantId");

  // Fetch organization and space
  const { data: org } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  const { data: space } = useQuery<Space>({
    queryKey: [`/api/spaces/${params.space}`],
  });

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

  const handleCreateNote = () => {
    if (!noteContent.trim()) return;
    createNoteMutation.mutate(noteContent);
  };

  const onlineCount = participants.filter(p => p.isOnline).length;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Dark Header */}
      {org && (
        <BrandHeader
          orgName={org.name}
          orgLogo={org.logoUrl || undefined}
          userName="Participant"
          userRole="participant"
        />
      )}

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

      {/* WHITE WHITEBOARD AREA */}
      <main className="flex-1 overflow-hidden bg-white">
        <div className="h-full overflow-auto p-8">
          <div className="mx-auto max-w-7xl">
            {/* Create Note Button (floating on white) */}
            {!showNoteForm && (
              <Button
                onClick={() => setShowNoteForm(true)}
                className="mb-6"
                data-testid="button-create-note"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Idea
              </Button>
            )}

            {/* Note Creation Form (on white background) */}
            {showNoteForm && (
              <Card className="mb-6 max-w-md border-2 border-primary/20 bg-white p-4">
                <h3 className="mb-3 text-sm font-bold text-gray-900">Create New Idea</h3>
                <Textarea
                  placeholder="What's your idea or insight?"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="mb-3 min-h-24 resize-none bg-white text-gray-900"
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

            {/* Notes Grid (sticky notes on white board) */}
            {notes.length === 0 && !showNoteForm && (
              <div className="py-12 text-center">
                <p className="text-gray-500">
                  No ideas yet. Be the first to add one!
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {notes.map((note) => (
                <StickyNote
                  key={note.id}
                  id={note.id}
                  content={note.content}
                  author={participants.find(p => p.id === note.participantId)?.displayName}
                  timestamp={new Date(note.createdAt)}
                  category={note.category || undefined}
                  isAiCategory={note.isAiCategory}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Dark Footer */}
      <footer className="border-t bg-card px-6 py-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Session Status: {space?.status}</span>
          </div>
          <div>
            {notes.length} {notes.length === 1 ? 'idea' : 'ideas'} shared
          </div>
        </div>
      </footer>
    </div>
  );
}
