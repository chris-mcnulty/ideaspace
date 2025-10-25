import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Upload, 
  Download, 
  Edit2, 
  Trash2, 
  Merge, 
  Sparkles,
  Play,
  Square,
  ChevronRight,
  Settings,
  Users
} from "lucide-react";
import { useState } from "react";
import StickyNote from "./StickyNote";
import Zone from "./Zone";
import ParticipantList from "./ParticipantList";
import TimerBar from "./TimerBar";

interface Note {
  id: string;
  content: string;
  author: string;
  category?: string;
  isAiCategory?: boolean;
}

interface FacilitatorWorkspaceProps {
  spaceName: string;
  sessionStatus: "draft" | "open" | "closed";
  currentPhase: "ideation" | "categorization" | "voting" | "ranking" | "results";
  participants: Array<{ id: string; name: string; isOnline: boolean }>;
  notes: Note[];
  onAddNote?: (content: string, category?: string) => void;
  onEditNote?: (noteId: string, content: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onMergeNotes?: (noteIds: string[], newContent: string) => void;
  onPreloadNotes?: (notes: Note[]) => void;
  onStartSession?: () => void;
  onEndSession?: () => void;
  onNextPhase?: () => void;
  onTriggerAI?: () => void;
}

export default function FacilitatorWorkspace({
  spaceName,
  sessionStatus,
  currentPhase,
  participants,
  notes,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onMergeNotes,
  onPreloadNotes,
  onStartSession,
  onEndSession,
  onNextPhase,
  onTriggerAI,
}: FacilitatorWorkspaceProps) {
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteCategory, setNewNoteCategory] = useState("");
  const [preloadText, setPreloadText] = useState("");
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergedContent, setMergedContent] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const toggleNoteSelection = (noteId: string) => {
    const newSelection = new Set(selectedNotes);
    if (newSelection.has(noteId)) {
      newSelection.delete(noteId);
    } else {
      newSelection.add(noteId);
    }
    setSelectedNotes(newSelection);
  };

  const handlePreloadNotes = () => {
    const lines = preloadText.split("\n").filter(line => line.trim());
    const newNotes: Note[] = lines.map((line, index) => ({
      id: `preload-${Date.now()}-${index}`,
      content: line.trim(),
      author: "Facilitator",
    }));
    onPreloadNotes?.(newNotes);
    setPreloadText("");
  };

  const handleMergeNotes = () => {
    if (selectedNotes.size > 1) {
      const selectedNotesList = notes.filter(n => selectedNotes.has(n.id));
      const combined = selectedNotesList.map(n => n.content).join("\n\n");
      setMergedContent(combined);
      setMergeDialogOpen(true);
    }
  };

  const confirmMerge = () => {
    onMergeNotes?.(Array.from(selectedNotes), mergedContent);
    setSelectedNotes(new Set());
    setMergeDialogOpen(false);
    setMergedContent("");
  };

  const handleDeleteSelected = () => {
    selectedNotes.forEach(noteId => {
      onDeleteNote?.(noteId);
    });
    setSelectedNotes(new Set());
  };

  const categories = Array.from(new Set(notes.map(n => n.category).filter(Boolean)));

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold">{spaceName}</h1>
            <p className="text-xs text-muted-foreground">
              Facilitator View • {currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)} Phase
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ParticipantList participants={participants} />
            <Badge variant={sessionStatus === "open" ? "default" : "outline"}>
              {sessionStatus.toUpperCase()}
            </Badge>
          </div>
        </div>
      </header>

      {/* Timer */}
      {sessionStatus === "open" && (
        <TimerBar
          timeRemaining={timeRemaining}
          totalTime={300}
          isRunning={isTimerRunning}
          onToggle={() => setIsTimerRunning(!isTimerRunning)}
          onReset={() => setTimeRemaining(300)}
          isFacilitator
        />
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Controls */}
        <aside className="w-80 border-r bg-muted/30 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Session Controls */}
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Session Controls</h3>
              </CardHeader>
              <CardContent className="space-y-2">
                {sessionStatus === "draft" && (
                  <Button 
                    className="w-full" 
                    onClick={onStartSession}
                    data-testid="button-start-session"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Session
                  </Button>
                )}
                {sessionStatus === "open" && (
                  <>
                    <Button 
                      className="w-full" 
                      onClick={onNextPhase}
                      data-testid="button-next-phase"
                    >
                      <ChevronRight className="mr-2 h-4 w-4" />
                      Next Phase
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="w-full" 
                      onClick={onEndSession}
                      data-testid="button-end-session"
                    >
                      <Square className="mr-2 h-4 w-4" />
                      End Session
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedNotes.size > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-semibold">
                    {selectedNotes.size} Selected
                  </h3>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleMergeNotes}
                    disabled={selectedNotes.size < 2}
                    data-testid="button-merge-notes"
                  >
                    <Merge className="mr-2 h-4 w-4" />
                    Merge Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleDeleteSelected}
                    data-testid="button-delete-selected"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedNotes(new Set())}
                  >
                    Clear Selection
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Actions</h3>
              </CardHeader>
              <CardContent className="space-y-2">
                <Tabs defaultValue="add">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="add">Add</TabsTrigger>
                    <TabsTrigger value="preload">Preload</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="add" className="space-y-3 mt-3">
                    <Textarea
                      placeholder="Enter note content..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      rows={3}
                      data-testid="input-new-note"
                    />
                    <Input
                      placeholder="Category (optional)"
                      value={newNoteCategory}
                      onChange={(e) => setNewNoteCategory(e.target.value)}
                      data-testid="input-note-category"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        if (newNoteContent.trim()) {
                          onAddNote?.(newNoteContent, newNoteCategory || undefined);
                          setNewNoteContent("");
                          setNewNoteCategory("");
                        }
                      }}
                      data-testid="button-add-note"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Note
                    </Button>
                  </TabsContent>

                  <TabsContent value="preload" className="space-y-3 mt-3">
                    <Textarea
                      placeholder="Paste notes (one per line)..."
                      value={preloadText}
                      onChange={(e) => setPreloadText(e.target.value)}
                      rows={6}
                      data-testid="input-preload"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handlePreloadNotes}
                      disabled={!preloadText.trim()}
                      data-testid="button-preload-notes"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Preload Notes
                    </Button>
                  </TabsContent>
                </Tabs>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onTriggerAI}
                  data-testid="button-trigger-ai"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Categorize
                </Button>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Statistics</h3>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Notes:</span>
                  <span className="font-semibold">{notes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Categories:</span>
                  <span className="font-semibold">{categories.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Participants:</span>
                  <span className="font-semibold">
                    {participants.filter(p => p.isOnline).length} / {participants.length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Main Whiteboard Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {notes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <h3 className="text-lg font-semibold">No notes yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add notes manually or preload them to get started
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <Zone key={category} name={category || "Uncategorized"}>
                    {notes
                      .filter((n) => (n.category || "Uncategorized") === (category || "Uncategorized"))
                      .map((note) => (
                        <div key={note.id} className="relative">
                          <StickyNote
                            id={note.id}
                            content={note.content}
                            author={note.author}
                            category={note.category}
                            isAiCategory={note.isAiCategory}
                            selected={selectedNotes.has(note.id)}
                            onClick={() => toggleNoteSelection(note.id)}
                          />
                          <div className="absolute -right-2 -top-2 flex gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="h-6 w-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingNote(note);
                                  }}
                                  data-testid={`button-edit-${note.id}`}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit Note</DialogTitle>
                                </DialogHeader>
                                <Textarea
                                  defaultValue={note.content}
                                  rows={4}
                                  onChange={(e) => {
                                    setEditingNote({ ...note, content: e.target.value });
                                  }}
                                  data-testid="input-edit-note"
                                />
                                <DialogFooter>
                                  <Button
                                    onClick={() => {
                                      if (editingNote) {
                                        onEditNote?.(editingNote.id, editingNote.content);
                                        setEditingNote(null);
                                      }
                                    }}
                                    data-testid="button-save-edit"
                                  >
                                    Save Changes
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-6 w-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteNote?.(note.id);
                              }}
                              data-testid={`button-delete-${note.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </Zone>
                ))
              ) : (
                <div className="flex flex-wrap gap-4">
                  {notes.map((note) => (
                    <div key={note.id} className="group relative">
                      <StickyNote
                        id={note.id}
                        content={note.content}
                        author={note.author}
                        category={note.category}
                        isAiCategory={note.isAiCategory}
                        selected={selectedNotes.has(note.id)}
                        onClick={() => toggleNoteSelection(note.id)}
                      />
                      <div className="absolute -right-2 -top-2 flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-6 w-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNote(note);
                              }}
                              data-testid={`button-edit-${note.id}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Note</DialogTitle>
                            </DialogHeader>
                            <Textarea
                              defaultValue={note.content}
                              rows={4}
                              onChange={(e) => {
                                setEditingNote({ ...note, content: e.target.value });
                              }}
                              data-testid="input-edit-note"
                            />
                            <DialogFooter>
                              <Button
                                onClick={() => {
                                  if (editingNote) {
                                    onEditNote?.(editingNote.id, editingNote.content);
                                    setEditingNote(null);
                                  }
                                }}
                                data-testid="button-save-edit"
                              >
                                Save Changes
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-6 w-6 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNote?.(note.id);
                          }}
                          data-testid={`button-delete-${note.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Merge {selectedNotes.size} Notes</DialogTitle>
          </DialogHeader>
          <Textarea
            value={mergedContent}
            onChange={(e) => setMergedContent(e.target.value)}
            rows={8}
            placeholder="Edit the merged content..."
            data-testid="input-merge-content"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmMerge} data-testid="button-confirm-merge">
              Merge Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
