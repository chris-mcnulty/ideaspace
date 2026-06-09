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
import { Loader2, Settings2, Sailboat as SailboatIcon, Plus, X, Flag, Wind, Anchor } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SAILBOAT_ZONES, type SailboatZone } from '@shared/schema';
import type { Note, Sailboat, SailboatPosition, Category } from '@shared/schema';

interface SailboatModuleProps {
  spaceId: string;
  participantId?: string;
  isReadOnly?: boolean;
  isFacilitator?: boolean;
}

interface PlacedPosition {
  zone: SailboatZone;
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

const ZONE_META: Record<SailboatZone, { icon: typeof Flag; color: string; helper: string }> = {
  goal: { icon: Flag, color: '#10B981', helper: "What we're sailing toward" },
  wind: { icon: Wind, color: '#3B82F6', helper: "What's pushing us forward" },
  anchor: { icon: Anchor, color: '#EF4444', helper: "What's holding us back" },
};

// Partition the canvas into three non-overlapping zones that evoke the
// sailboat metaphor: the destination is ahead (right strip), the wind drives
// from behind the sail (upper-left), and the anchor holds back below (lower-left).
function zoneFromPoint(x: number, y: number): SailboatZone {
  if (x >= 60) return 'goal';
  if (y < 60) return 'wind';
  return 'anchor';
}

const NOTE_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16',
];

export default function SailboatModule({
  spaceId,
  participantId,
  isReadOnly = false,
  isFacilitator = false,
}: SailboatModuleProps) {
  const { toast } = useToast();
  const { announce } = useAnnouncer();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [localPositions, setLocalPositions] = useState<Map<string, PlacedPosition>>(new Map());
  const localPositionsRef = useRef<Map<string, PlacedPosition>>(new Map());
  const [draggedNote, setDraggedNote] = useState<DraggedNote | null>(null);
  const draggedNoteRef = useRef<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [goalLabel, setGoalLabel] = useState('Goal / Destination');
  const [windLabel, setWindLabel] = useState('Driving Forces');
  const [anchorLabel, setAnchorLabel] = useState('Anchors / Holding Back');
  const [newIdea, setNewIdea] = useState('');

  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${spaceId}/notes`],
    staleTime: 0,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: [`/api/spaces/${spaceId}/categories`],
    enabled: !!spaceId,
  });

  const { data: sailboat, isLoading: sailboatLoading } = useQuery<Sailboat>({
    queryKey: [`/api/spaces/${spaceId}/sailboat`],
    enabled: !!spaceId,
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery<SailboatPosition[]>({
    queryKey: [`/api/spaces/${spaceId}/sailboat/positions`],
    enabled: !!spaceId,
    staleTime: 0,
  });

  const sailboatId = sailboat?.id;
  useEffect(() => {
    if (!sailboat) return;
    setGoalLabel(sailboat.goalLabel);
    setWindLabel(sailboat.windLabel);
    setAnchorLabel(sailboat.anchorLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sailboatId]);

  const labels: Record<SailboatZone, string> = {
    goal: sailboat?.goalLabel ?? goalLabel,
    wind: sailboat?.windLabel ?? windLabel,
    anchor: sailboat?.anchorLabel ?? anchorLabel,
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
        if (data.type === 'sailboat_position_updated' && data.data?.noteId) {
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
        } else if (data.type === 'sailboat_position_removed' && data.data?.noteId) {
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
        console.error('[SailboatModule] WebSocket message error:', error);
      }
    };
    return () => ws.close();
  }, [spaceId, isReadOnly]);

  const updateConfigMutation = useMutation({
    mutationFn: (data: { goalLabel: string; windLabel: string; anchorLabel: string }) =>
      apiRequest('PUT', `/api/spaces/${spaceId}/sailboat`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/sailboat`] });
      toast({ title: 'Sailboat Updated', description: 'Zone labels have been saved.' });
      setShowSettings(false);
    },
    onError: () => {
      toast({ title: 'Update Failed', description: 'Could not save zone labels.', variant: 'destructive' });
    },
  });

  const updatePositionMutation = useMutation({
    mutationFn: (data: { noteId: string; zone: SailboatZone; xCoord: number; yCoord: number }) =>
      apiRequest('PUT', `/api/spaces/${spaceId}/sailboat/positions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/sailboat/positions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/notes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/categories`] });
    },
    onError: () => {
      toast({ title: 'Save Failed', description: 'Could not save placement. Please try again.', variant: 'destructive' });
    },
  });

  const removePositionMutation = useMutation({
    mutationFn: (noteId: string) =>
      apiRequest('DELETE', `/api/spaces/${spaceId}/sailboat/positions/${noteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/sailboat/positions`] });
    },
  });

  const addIdeaMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest('POST', '/api/notes', { spaceId, content, participantId }),
    onSuccess: () => {
      setNewIdea('');
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/notes`] });
      toast({ title: 'Idea Added', description: 'Drag or tap it onto the sailboat.' });
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
    // Keyboard placement: 1 = goal, 2 = wind, 3 = anchor (centered in the zone).
    const centers: Record<string, PlacedPosition> = {
      '1': { zone: 'goal', x: 80, y: 50 },
      '2': { zone: 'wind', x: 30, y: 30 },
      '3': { zone: 'anchor', x: 30, y: 80 },
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

  const isLoading = notesLoading || sailboatLoading || positionsLoading;
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
          <SailboatIcon className="h-5 w-5" />
          <h2 className="text-lg sm:text-xl font-semibold">Sailboat</h2>
          <Badge variant="secondary" data-testid="badge-sailboat-placed">{placedCount}/{notes.length} placed</Badge>
        </div>
        {isFacilitator && (
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} data-testid="button-sailboat-settings">
            <Settings2 className="h-4 w-4 mr-2" />
            Configure Zones
          </Button>
        )}
      </div>

      {!isReadOnly && !isFacilitator && (
        <div className="flex items-center gap-2" data-testid="sailboat-add-idea">
          <Input
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddIdea(); }}
            placeholder="Add a new idea…"
            data-testid="input-sailboat-new-idea"
          />
          <Button onClick={handleAddIdea} disabled={addIdeaMutation.isPending || !newIdea.trim()} data-testid="button-sailboat-add-idea">
            {addIdeaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Add idea</span>
          </Button>
        </div>
      )}

      {selectedNoteId && !isReadOnly && (
        <div className="text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-md p-3" data-testid="text-sailboat-hint">
          Tap a zone on the sailboat to place the selected idea (or press 1 = goal, 2 = wind, 3 = anchor).
        </div>
      )}

      {/* Idea tray */}
      {!isReadOnly && unplacedNotes.length > 0 && (
        <div className="rounded-md border p-3" data-testid="sailboat-tray">
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
                  aria-label={`${text}. Press 1 for ${labels.goal}, 2 for ${labels.wind}, 3 for ${labels.anchor}.`}
                  data-testid={`tray-note-${note.id}`}
                >
                  <span className="line-clamp-2">{text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sailboat canvas */}
      <Card className="flex-1 relative overflow-hidden">
        <CardContent className="p-0 h-full overflow-hidden">
          <div
            ref={canvasRef}
            className="relative w-full h-full min-h-[440px] sm:min-h-[560px]"
            style={{
              cursor: draggedNote ? 'grabbing' : (selectedNoteId ? 'crosshair' : 'default'),
              touchAction: draggedNote ? 'none' : 'auto',
              background: 'linear-gradient(to bottom, hsl(var(--muted)/0.4) 0%, hsl(var(--muted)/0.4) 60%, hsl(217 60% 50% / 0.18) 60%, hsl(217 70% 40% / 0.28) 100%)',
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={handleCanvasClick}
            data-testid="sailboat-canvas"
          >
            {/* Zone dividers */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-[60%] top-0 bottom-0 w-px bg-border" />
              <div className="absolute left-0 top-[60%] w-[60%] h-px bg-border" />
            </div>

            {/* Decorative sailboat sketch (center-left) */}
            <svg
              className="absolute pointer-events-none opacity-30"
              style={{ left: '14%', top: '14%', width: '34%', height: '52%' }}
              viewBox="0 0 200 220"
              fill="none"
              aria-hidden="true"
            >
              <line x1="100" y1="20" x2="100" y2="160" stroke="currentColor" strokeWidth="4" />
              <path d="M100 24 L100 150 L30 150 Z" fill="currentColor" opacity="0.5" />
              <path d="M104 30 L160 140 L104 140 Z" fill="currentColor" opacity="0.35" />
              <path d="M40 160 L160 160 L140 195 L60 195 Z" fill="currentColor" opacity="0.7" />
            </svg>

            {/* Zone labels */}
            {SAILBOAT_ZONES.map((zone) => {
              const meta = ZONE_META[zone];
              const ZoneIcon = meta.icon;
              const placement: Record<SailboatZone, React.CSSProperties> = {
                wind: { left: '2%', top: '2%' },
                goal: { right: '2%', top: '2%' },
                anchor: { left: '2%', bottom: '2%' },
              };
              return (
                <div
                  key={zone}
                  className="absolute pointer-events-none flex items-center gap-1.5 rounded-md px-2 py-1"
                  style={{ ...placement[zone], backgroundColor: `${meta.color}1A`, color: meta.color }}
                  data-testid={`sailboat-zone-label-${zone}`}
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
                  data-testid={`sailboat-note-${note.id}`}
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
                        aria-label={`Remove ${text} from the sailboat`}
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
              No ideas yet. Add ideas above, then place them on the sailboat as goals, driving forces, or anchors.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Facilitator zone-label settings */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Sailboat Zones</DialogTitle>
            <DialogDescription>
              Customize the labels for the three zones of the sailboat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goal-label">Goal (destination ahead)</Label>
              <Input id="goal-label" value={goalLabel} onChange={(e) => setGoalLabel(e.target.value)} data-testid="input-goal-label" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wind-label">Wind (driving forces)</Label>
              <Input id="wind-label" value={windLabel} onChange={(e) => setWindLabel(e.target.value)} data-testid="input-wind-label" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anchor-label">Anchor (holding back)</Label>
              <Input id="anchor-label" value={anchorLabel} onChange={(e) => setAnchorLabel(e.target.value)} data-testid="input-anchor-label" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)} data-testid="button-cancel-sailboat-settings">Cancel</Button>
            <Button
              onClick={() => updateConfigMutation.mutate({ goalLabel, windLabel, anchorLabel })}
              disabled={updateConfigMutation.isPending}
              data-testid="button-save-sailboat-settings"
            >
              {updateConfigMutation.isPending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>) : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
