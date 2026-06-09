import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAnnouncer } from '@/components/LiveAnnouncer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings2, Rocket as StarshipIcon, Plus, X, Globe, Flame, CircleDot } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { STARSHIP_ZONES, type StarshipZone } from '@shared/schema';
import type { Note, Starship, StarshipPosition, Category } from '@shared/schema';

interface StarshipModuleProps {
  spaceId: string;
  participantId?: string;
  isReadOnly?: boolean;
  isFacilitator?: boolean;
}

interface PlacedPosition {
  zone: StarshipZone;
  x: number; // 0-100 (from left)
  y: number; // 0-100 (from top)
}

interface DraggedNote {
  id: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const ZONE_META: Record<StarshipZone, { icon: typeof Globe; color: string; helper: string }> = {
  thrust: { icon: Flame, color: '#3B82F6', helper: "What's propelling us forward" },
  destination: { icon: Globe, color: '#10B981', helper: "Where we're headed" },
  drag: { icon: CircleDot, color: '#EF4444', helper: "What's dragging us down" },
};

// Partition the canvas into three non-overlapping zones that evoke the starship
// metaphor (the ship travels left to right): destinations lie ahead (right
// strip), propulsion drives from behind (upper-left), and black holes drag the
// ship down below (lower-left).
function zoneFromPoint(x: number, y: number): StarshipZone {
  if (x >= 60) return 'destination';
  if (y < 60) return 'thrust';
  return 'drag';
}

const NOTE_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16',
];

export default function StarshipModule({
  spaceId,
  participantId,
  isReadOnly = false,
  isFacilitator = false,
}: StarshipModuleProps) {
  const { toast } = useToast();
  const { announce } = useAnnouncer();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [localPositions, setLocalPositions] = useState<Map<string, PlacedPosition>>(new Map());
  const localPositionsRef = useRef<Map<string, PlacedPosition>>(new Map());
  const [draggedNote, setDraggedNote] = useState<DraggedNote | null>(null);
  const draggedNoteRef = useRef<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [destinationLabel, setDestinationLabel] = useState('Destinations');
  const [thrustLabel, setThrustLabel] = useState('Propulsion');
  const [dragLabel, setDragLabel] = useState('Black Holes');
  const [newIdea, setNewIdea] = useState('');

  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${spaceId}/notes`],
    staleTime: 0,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: [`/api/spaces/${spaceId}/categories`],
    enabled: !!spaceId,
  });

  const { data: starship, isLoading: starshipLoading } = useQuery<Starship>({
    queryKey: [`/api/spaces/${spaceId}/starship`],
    enabled: !!spaceId,
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery<StarshipPosition[]>({
    queryKey: [`/api/spaces/${spaceId}/starship/positions`],
    enabled: !!spaceId,
    staleTime: 0,
  });

  const starshipId = starship?.id;
  useEffect(() => {
    if (!starship) return;
    setDestinationLabel(starship.destinationLabel);
    setThrustLabel(starship.thrustLabel);
    setDragLabel(starship.dragLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starshipId]);

  const labels: Record<StarshipZone, string> = {
    destination: starship?.destinationLabel ?? destinationLabel,
    thrust: starship?.thrustLabel ?? thrustLabel,
    drag: starship?.dragLabel ?? dragLabel,
  };

  // Sync server positions into local state.
  const positionsKey = positions.map(p => `${p.noteId}:${p.zone}:${p.xCoord}:${p.yCoord}`).join('|');
  useEffect(() => {
    const posMap = new Map<string, PlacedPosition>();
    positions.forEach(pos => {
      const x = pos.xCoord <= 1 ? pos.xCoord * 100 : pos.xCoord;
      const y = pos.yCoord <= 1 ? pos.yCoord * 100 : pos.yCoord;
      posMap.set(pos.noteId, { zone: pos.zone, x, y });
    });
    setLocalPositions(posMap);
    localPositionsRef.current = posMap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey]);

  // Real-time updates from other participants / the facilitator.
  useEffect(() => {
    if (isReadOnly) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?spaceId=${spaceId}`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'starship_position_updated' && data.data?.noteId) {
          const p = data.data;
          const x = typeof p.xCoord === 'number' ? (p.xCoord <= 1 ? p.xCoord * 100 : p.xCoord) : 50;
          const y = typeof p.yCoord === 'number' ? (p.yCoord <= 1 ? p.yCoord * 100 : p.yCoord) : 50;
          setLocalPositions(prev => {
            const next = new Map(prev);
            next.set(p.noteId, { zone: p.zone, x, y });
            localPositionsRef.current = next;
            return next;
          });
          queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/notes`] });
          queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/categories`] });
        } else if (data.type === 'starship_position_removed' && data.data?.noteId) {
          setLocalPositions(prev => {
            const next = new Map(prev);
            next.delete(data.data.noteId);
            localPositionsRef.current = next;
            return next;
          });
        } else if (data.type === 'note_created') {
          queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/notes`] });
        }
      } catch (error) {
        console.error('[StarshipModule] WebSocket message error:', error);
      }
    };
    return () => ws.close();
  }, [spaceId, isReadOnly]);

  const updateConfigMutation = useMutation({
    mutationFn: (data: { destinationLabel: string; thrustLabel: string; dragLabel: string }) =>
      apiRequest('PUT', `/api/spaces/${spaceId}/starship`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/starship`] });
      toast({ title: 'Starship Updated', description: 'Zone labels have been saved.' });
      setShowSettings(false);
    },
    onError: () => {
      toast({ title: 'Update Failed', description: 'Could not save zone labels.', variant: 'destructive' });
    },
  });

  const updatePositionMutation = useMutation({
    mutationFn: (data: { noteId: string; zone: StarshipZone; xCoord: number; yCoord: number }) =>
      apiRequest('PUT', `/api/spaces/${spaceId}/starship/positions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/starship/positions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/notes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/categories`] });
    },
    onError: () => {
      toast({ title: 'Save Failed', description: 'Could not save placement. Please try again.', variant: 'destructive' });
    },
  });

  const removePositionMutation = useMutation({
    mutationFn: (noteId: string) =>
      apiRequest('DELETE', `/api/spaces/${spaceId}/starship/positions/${noteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/starship/positions`] });
    },
  });

  const addIdeaMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest('POST', '/api/notes', { spaceId, content, participantId }),
    onSuccess: () => {
      setNewIdea('');
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/notes`] });
      toast({ title: 'Idea Added', description: 'Drag or tap it onto the starship.' });
    },
    onError: () => {
      toast({ title: 'Could Not Add Idea', description: 'New ideas can only be added while the workspace is open.', variant: 'destructive' });
    },
  });

  const persistPlacement = (noteId: string, pos: PlacedPosition) => {
    setLocalPositions(prev => {
      const next = new Map(prev);
      next.set(noteId, pos);
      localPositionsRef.current = next;
      return next;
    });
    updatePositionMutation.mutate({ noteId, zone: pos.zone, xCoord: pos.x, yCoord: pos.y });
  };

  // Tap-to-place / tap-to-move: select a note, then click a spot on the canvas.
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isReadOnly || !selectedNoteId) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const zone = zoneFromPoint(x, y);
    persistPlacement(selectedNoteId, { zone, x, y });
    announce(`Placed in ${labels[zone]}.`, 'polite');
    setSelectedNoteId(null);
  };

  // Pointer dragging of an already-placed note within the canvas.
  const handleNotePointerDown = (e: React.PointerEvent, noteId: string) => {
    if (isReadOnly) return;
    const pos = localPositions.get(noteId);
    if (!pos) {
      // Unplaced note in the tray — fall back to select-then-click placement.
      setSelectedNoteId(prev => (prev === noteId ? null : noteId));
      return;
    }
    draggedNoteRef.current = noteId;
    setDraggedNote({
      id: noteId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
    if (canvasRef.current) canvasRef.current.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggedNote) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = ((e.clientX - draggedNote.startClientX) / rect.width) * 100;
    const dy = ((e.clientY - draggedNote.startClientY) / rect.height) * 100;
    const newX = Math.max(0, Math.min(100, draggedNote.startX + dx));
    const newY = Math.max(0, Math.min(100, draggedNote.startY + dy));
    setLocalPositions(prev => {
      const next = new Map(prev);
      const existing = next.get(draggedNote.id);
      next.set(draggedNote.id, { zone: existing?.zone ?? zoneFromPoint(newX, newY), x: newX, y: newY });
      localPositionsRef.current = next;
      return next;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const id = draggedNoteRef.current;
    if (!id) return;
    const pos = localPositionsRef.current.get(id);
    if (pos) {
      const zone = zoneFromPoint(pos.x, pos.y);
      persistPlacement(id, { ...pos, zone });
    }
    draggedNoteRef.current = null;
    setDraggedNote(null);
    if (canvasRef.current) {
      try { canvasRef.current.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    }
  };

  const handleTrayKeyDown = (e: React.KeyboardEvent, noteId: string) => {
    if (isReadOnly) return;
    // Keyboard placement: 1 = propulsion, 2 = destination, 3 = black hole (centered in the zone).
    const centers: Record<string, PlacedPosition> = {
      '1': { zone: 'thrust', x: 30, y: 30 },
      '2': { zone: 'destination', x: 80, y: 50 },
      '3': { zone: 'drag', x: 30, y: 80 },
    };
    if (centers[e.key]) {
      e.preventDefault();
      const pos = centers[e.key];
      persistPlacement(noteId, pos);
      announce(`Placed in ${labels[pos.zone]}.`, 'polite');
    }
  };

  const handleAddIdea = () => {
    const text = newIdea.trim();
    if (!text) return;
    addIdeaMutation.mutate(text);
  };

  const noteColor = (note: Note): string => {
    const category = note.manualCategoryId ? categories.find(c => c.id === note.manualCategoryId) : null;
    if (category?.color) return category.color;
    const hash = note.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return NOTE_COLORS[hash % NOTE_COLORS.length];
  };

  const isLoading = notesLoading || starshipLoading || positionsLoading;
  if (isLoading) {
    return (
      <Card className="w-full h-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  const unplacedNotes = notes.filter(n => !localPositions.has(n.id));
  const placedCount = notes.length - unplacedNotes.length;

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <StarshipIcon className="h-5 w-5" />
          <h2 className="text-lg sm:text-xl font-semibold">Starship</h2>
          <Badge variant="secondary" data-testid="badge-starship-placed">{placedCount}/{notes.length} placed</Badge>
        </div>
        {isFacilitator && (
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} data-testid="button-starship-settings">
            <Settings2 className="h-4 w-4 mr-2" />
            Configure Zones
          </Button>
        )}
      </div>

      {!isReadOnly && !isFacilitator && (
        <div className="flex items-center gap-2" data-testid="starship-add-idea">
          <Input
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddIdea(); }}
            placeholder="Add a new idea…"
            data-testid="input-starship-new-idea"
          />
          <Button onClick={handleAddIdea} disabled={addIdeaMutation.isPending || !newIdea.trim()} data-testid="button-starship-add-idea">
            {addIdeaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Add idea</span>
          </Button>
        </div>
      )}

      {selectedNoteId && !isReadOnly && (
        <div className="text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-md p-3" data-testid="text-starship-hint">
          Tap a zone on the starship to place the selected idea (or press 1 = propulsion, 2 = destination, 3 = black hole).
        </div>
      )}

      {/* Idea tray */}
      {!isReadOnly && unplacedNotes.length > 0 && (
        <div className="rounded-md border p-3" data-testid="starship-tray">
          <p className="text-xs font-medium text-muted-foreground mb-2">Ideas to place</p>
          <div className="flex flex-wrap gap-2">
            {unplacedNotes.map(note => {
              const text = note.content.replace(/<[^>]*>?/gm, '');
              const color = noteColor(note);
              const isSelected = selectedNoteId === note.id;
              return (
                <button
                  key={note.id}
                  type="button"
                  className={`text-left rounded-md bg-card px-2 py-1 text-sm shadow-sm max-w-[220px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  style={{ borderWidth: '2px', borderStyle: 'solid', borderColor: color }}
                  onPointerDown={(e) => handleNotePointerDown(e, note.id)}
                  onKeyDown={(e) => handleTrayKeyDown(e, note.id)}
                  aria-label={`${text}. Press 1 for ${labels.thrust}, 2 for ${labels.destination}, 3 for ${labels.drag}.`}
                  data-testid={`tray-note-${note.id}`}
                >
                  <span className="line-clamp-2">{text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Starship canvas */}
      <Card className="flex-1 relative overflow-hidden">
        <CardContent className="p-0 h-full overflow-hidden">
          <div
            ref={canvasRef}
            className="relative w-full h-full min-h-[440px] sm:min-h-[560px]"
            style={{
              cursor: draggedNote ? 'grabbing' : (selectedNoteId ? 'crosshair' : 'default'),
              touchAction: draggedNote ? 'none' : 'auto',
              background: 'radial-gradient(ellipse at 30% 95%, hsl(280 70% 40% / 0.35) 0%, transparent 55%), linear-gradient(to bottom, hsl(var(--muted)/0.45) 0%, hsl(var(--muted)/0.35) 55%, hsl(270 50% 25% / 0.30) 100%)',
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={handleCanvasClick}
            data-testid="starship-canvas"
          >
            {/* Zone dividers */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-[60%] top-0 bottom-0 w-px bg-border" />
              <div className="absolute left-0 top-[60%] w-[60%] h-px bg-border" />
            </div>

            {/* Decorative starship sketch, nosed right (the ship travels left to right) */}
            <svg
              className="absolute pointer-events-none opacity-30"
              style={{ left: '22%', top: '36%', width: '36%', height: '26%' }}
              viewBox="0 0 220 120"
              fill="none"
              aria-hidden="true"
            >
              {/* exhaust */}
              <path d="M40 50 L8 60 L40 70 Z" fill="currentColor" opacity="0.45" />
              {/* fins */}
              <path d="M70 50 L46 30 L86 50 Z" fill="currentColor" opacity="0.5" />
              <path d="M70 70 L46 90 L86 70 Z" fill="currentColor" opacity="0.5" />
              {/* body */}
              <rect x="40" y="48" width="120" height="24" rx="12" fill="currentColor" opacity="0.6" />
              {/* nose cone */}
              <path d="M160 44 L160 76 L205 60 Z" fill="currentColor" opacity="0.7" />
              {/* window */}
              <circle cx="120" cy="60" r="6" fill="hsl(var(--background))" opacity="0.9" />
            </svg>

            {/* Zone labels */}
            {STARSHIP_ZONES.map((zone) => {
              const meta = ZONE_META[zone];
              const ZoneIcon = meta.icon;
              const placement: Record<StarshipZone, React.CSSProperties> = {
                thrust: { left: '2%', top: '2%' },
                destination: { right: '2%', top: '2%' },
                drag: { left: '2%', bottom: '2%' },
              };
              return (
                <div
                  key={zone}
                  className="absolute pointer-events-none flex items-center gap-1.5 rounded-md px-2 py-1"
                  style={{ ...placement[zone], backgroundColor: `${meta.color}1A`, color: meta.color }}
                  data-testid={`starship-zone-label-${zone}`}
                >
                  <ZoneIcon className="h-4 w-4" />
                  <div className="leading-tight">
                    <div className="text-xs sm:text-sm font-semibold">{labels[zone]}</div>
                    <div className="text-[10px] sm:text-xs opacity-80">{meta.helper}</div>
                  </div>
                </div>
              );
            })}

            {/* Placed notes */}
            {notes.map((note) => {
              const pos = localPositions.get(note.id);
              if (!pos) return null;
              const text = note.content.replace(/<[^>]*>?/gm, '');
              const color = noteColor(note);
              const isDragging = draggedNote?.id === note.id;
              const isSelected = selectedNoteId === note.id;
              return (
                <div
                  key={note.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isDragging ? 'z-50' : 'z-10'} ${isReadOnly ? '' : 'cursor-grab active:cursor-grabbing'} ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transition: isDragging ? 'none' : 'all 0.2s ease' }}
                  onPointerDown={(e) => handleNotePointerDown(e, note.id)}
                  onClick={(e) => e.stopPropagation()}
                  tabIndex={isReadOnly ? -1 : 0}
                  role={isReadOnly ? undefined : 'button'}
                  aria-label={`${text}. In ${labels[pos.zone]}.`}
                  data-testid={`starship-note-${note.id}`}
                >
                  <div
                    className={`relative bg-card rounded-lg p-2 shadow-sm min-w-[100px] max-w-[180px] min-h-[44px] ${isDragging ? 'shadow-lg scale-105' : 'hover:shadow-md'}`}
                    style={{ borderWidth: '2px', borderStyle: 'solid', borderColor: color }}
                  >
                    <p className="text-sm font-medium line-clamp-3 pr-4">{text}</p>
                    {!isReadOnly && (
                      <button
                        type="button"
                        className="absolute top-0.5 right-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); removePositionMutation.mutate(note.id); }}
                        aria-label={`Remove ${text} from the starship`}
                        data-testid={`button-remove-${note.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {notes.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No ideas yet. Add ideas above, then plot them on the starship as propulsion, destinations, or black holes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Facilitator zone-label settings */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Starship Zones</DialogTitle>
            <DialogDescription>
              Customize the labels for the three zones of the starship.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="thrust-label">Propulsion (rockets / warp drives, upper-left)</Label>
              <Input id="thrust-label" value={thrustLabel} onChange={(e) => setThrustLabel(e.target.value)} data-testid="input-thrust-label" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination-label">Destinations (planets ahead, upper-right)</Label>
              <Input id="destination-label" value={destinationLabel} onChange={(e) => setDestinationLabel(e.target.value)} data-testid="input-destination-label" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drag-label">Black Holes (dragging you down, bottom)</Label>
              <Input id="drag-label" value={dragLabel} onChange={(e) => setDragLabel(e.target.value)} data-testid="input-drag-label" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)} data-testid="button-cancel-starship-settings">Cancel</Button>
            <Button
              onClick={() => updateConfigMutation.mutate({ destinationLabel, thrustLabel, dragLabel })}
              disabled={updateConfigMutation.isPending}
              data-testid="button-save-starship-settings"
            >
              {updateConfigMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
