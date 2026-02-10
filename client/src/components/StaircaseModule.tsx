import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings2, TrendingUp, BarChart2, GripVertical, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Note, StaircaseModule, StaircasePosition, Category } from '@shared/schema';

interface StaircaseModuleProps {
  spaceId: string;
  moduleRunId?: string;
  isReadOnly?: boolean;
  isFacilitator?: boolean;
}

interface DraggedNote {
  id: string;
  noteId: string;
  startY: number;
  currentY: number;
  currentStepIndex: number;
  fromSidebar: boolean;
}

export default function StaircaseModule({ 
  spaceId, 
  moduleRunId,
  isReadOnly = false,
  isFacilitator = false,
}: StaircaseModuleProps) {
  const { toast } = useToast();
  const canvasRef = useRef<SVGSVGElement>(null);
  const [draggedNote, setDraggedNote] = useState<DraggedNote | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [minLabel, setMinLabel] = useState('Lowest');
  const [maxLabel, setMaxLabel] = useState('Highest');
  const [stepCount, setStepCount] = useState(11);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${spaceId}/notes`],
    staleTime: 0,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: [`/api/spaces/${spaceId}/categories`],
    enabled: !!spaceId,
  });

  const { data: staircase, isLoading: staircaseLoading } = useQuery<StaircaseModule>({
    queryKey: [`/api/spaces/${spaceId}/staircase`],
    enabled: !!spaceId,
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery<StaircasePosition[]>({
    queryKey: [`/api/spaces/${spaceId}/staircase-positions`],
    enabled: !!spaceId,
    staleTime: 0,
  });

  const updateStaircaseMutation = useMutation({
    mutationFn: (data: { minLabel: string; maxLabel: string; stepCount: number }) =>
      apiRequest('PUT', `/api/spaces/${spaceId}/staircase`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/staircase`] });
      toast({
        title: 'Staircase Updated',
        description: 'Configuration has been updated successfully.',
      });
      setShowSettings(false);
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'Failed to update staircase configuration.',
        variant: 'destructive',
      });
    },
  });

  const updatePositionMutation = useMutation({
    mutationFn: (data: { noteId: string; score: number; slotOffset?: number }) =>
      apiRequest('POST', `/api/spaces/${spaceId}/staircase-positions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/staircase-positions`] });
    },
    onError: () => {
      toast({
        title: 'Position Update Failed',
        description: 'Failed to save position. Please try again.',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (staircase) {
      setMinLabel(staircase.minLabel);
      setMaxLabel(staircase.maxLabel);
      setStepCount(staircase.stepCount);
    }
  }, [staircase]);

  useEffect(() => {
    if (typeof window === 'undefined' || !spaceId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?spaceId=${spaceId}`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', data: { spaceId } }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'staircase_position_updated') {
          queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/staircase-positions`] });
        }
      } catch (error) {
        console.error('[StaircaseModule] WebSocket message error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[StaircaseModule] WebSocket error:', error);
    };

    ws.onclose = () => {};

    setWsConnection(ws);

    return () => {
      ws.close();
    };
  }, [spaceId]);

  const canvasWidth = 800;
  const canvasHeight = 600;
  const margin = 60;
  const stepWidth = (canvasWidth - 2 * margin) / stepCount;
  const stepHeight = (canvasHeight - 2 * margin) / stepCount;

  const positionsByScore = new Map<number, StaircasePosition[]>();
  positions.forEach(pos => {
    const score = Number(pos.score);
    if (!positionsByScore.has(score)) {
      positionsByScore.set(score, []);
    }
    positionsByScore.get(score)?.push(pos);
  });

  const placedNoteIds = new Set(positions.map(p => p.noteId));
  const unplacedNotes = notes.filter(note => !placedNoteIds.has(note.id));
  const placedNotes = notes.filter(note => placedNoteIds.has(note.id));

  const noteColors = [
    '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16',
  ];
  
  const getCategoryColor = (manualCategoryId?: string | null, aiCategoryId?: string | null, noteId?: string) => {
    const categoryId = manualCategoryId || aiCategoryId;
    if (categoryId) {
      const category = categories.find(c => c.id === categoryId);
      if (category?.color) return category.color;
    }
    if (noteId) {
      const hash = noteId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      return noteColors[hash % noteColors.length];
    }
    return noteColors[0];
  };

  const handleQuickPlace = (note: Note, stepIndex: number) => {
    if (isReadOnly || !staircase) return;
    const scoreRange = staircase.maxScore - staircase.minScore;
    const score = staircase.minScore + (stepIndex / (stepCount - 1)) * scoreRange;
    const existingAtScore = positionsByScore.get(score) || [];
    const slotOffset = existingAtScore.length;
    updatePositionMutation.mutate({ noteId: note.id, score, slotOffset });
  };

  const handleDragStart = (e: React.PointerEvent, note: Note, position?: StaircasePosition) => {
    if (isReadOnly) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    const stepIndex = Math.floor((canvasHeight - margin - y) / stepHeight);
    const clampedStep = Math.max(0, Math.min(stepCount - 1, stepIndex));
    
    setDraggedNote({
      id: position?.id || `new-${note.id}`,
      noteId: note.id,
      startY: y,
      currentY: y,
      currentStepIndex: clampedStep,
      fromSidebar: false,
    });
    
    (e.target as Element).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!draggedNote) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    const stepIndex = Math.floor((canvasHeight - margin - y) / stepHeight);
    const clampedStep = Math.max(0, Math.min(stepCount - 1, stepIndex));
    
    setDraggedNote(prev => prev ? { ...prev, currentY: y, currentStepIndex: clampedStep } : null);
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    if (!draggedNote || !staircase) return;
    
    const stepIndex = Math.floor((canvasHeight - margin - draggedNote.currentY) / stepHeight);
    const clampedStep = Math.max(0, Math.min(stepCount - 1, stepIndex));
    
    const scoreRange = staircase.maxScore - staircase.minScore;
    const score = staircase.minScore + (clampedStep / (stepCount - 1)) * scoreRange;
    
    const existingAtScore = positionsByScore.get(score) || [];
    const slotOffset = existingAtScore.filter(p => p.noteId !== draggedNote.noteId).length;
    
    updatePositionMutation.mutate({
      noteId: draggedNote.noteId,
      score,
      slotOffset,
    });
    
    setDraggedNote(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const scoreDistribution = new Map<number, number>();
  if (staircase) {
    for (let i = 0; i < stepCount; i++) {
      const score = staircase.minScore + (i / (stepCount - 1)) * (staircase.maxScore - staircase.minScore);
      scoreDistribution.set(score, 0);
    }
    positions.forEach(pos => {
      const score = Number(pos.score);
      scoreDistribution.set(score, (scoreDistribution.get(score) || 0) + 1);
    });
  }

  const isLoading = notesLoading || categoriesLoading || staircaseLoading || positionsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (notes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Staircase Rating Module
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No notes available yet. Participants need to create notes during ideation before they can be rated on the staircase.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Staircase Rating Module
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" data-testid="badge-placed-count">
                {placedNotes.length}/{notes.length} placed
              </Badge>
              {isFacilitator && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  data-testid="button-staircase-settings"
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex gap-6">
            <div className="w-64 shrink-0" data-testid="staircase-unplaced-panel">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {unplacedNotes.length > 0 ? `Notes to Place (${unplacedNotes.length})` : 'All Notes Placed'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {unplacedNotes.length > 0
                    ? 'Click a step number to place each note on the staircase'
                    : 'Drag notes on the staircase to change their position'}
                </p>
              </div>
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {unplacedNotes.map(note => {
                  const displayText = note.content.replace(/<[^>]*>?/gm, '');
                  return (
                    <Card
                      key={note.id}
                      className="p-3"
                      data-testid={`unplaced-note-${note.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-3 h-3 rounded-full mt-1 shrink-0"
                          style={{ backgroundColor: getCategoryColor(note.manualCategoryId, null, note.id) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-tight break-words">
                            {displayText.length > 80
                              ? displayText.substring(0, 80) + '...'
                              : displayText}
                          </p>
                          {!isReadOnly && (
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              <span className="text-xs text-muted-foreground mr-1">Step:</span>
                              {[0, Math.floor(stepCount / 4), Math.floor(stepCount / 2), Math.floor(3 * stepCount / 4), stepCount - 1].map(step => (
                                <Button
                                  key={step}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => handleQuickPlace(note, step)}
                                  disabled={updatePositionMutation.isPending}
                                  data-testid={`button-place-${note.id}-step-${step}`}
                                >
                                  {step}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {placedNotes.length > 0 && unplacedNotes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    All {placedNotes.length} notes have been placed on the staircase. Drag them on the canvas to adjust their positions.
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <svg
                ref={canvasRef}
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                className="w-full border rounded-lg bg-muted/10"
                style={{ maxHeight: '600px' }}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerLeave={handleDragEnd}
                data-testid="staircase-canvas"
              >
                {Array.from({ length: stepCount }).map((_, i) => {
                  const x = margin + i * stepWidth;
                  const y = canvasHeight - margin - i * stepHeight;
                  
                  return (
                    <g key={i}>
                      <line
                        x1={x}
                        y1={y}
                        x2={x + stepWidth}
                        y2={y}
                        stroke="hsl(var(--border))"
                        strokeWidth="2"
                      />
                      {i < stepCount - 1 && (
                        <line
                          x1={x + stepWidth}
                          y1={y}
                          x2={x + stepWidth}
                          y2={y - stepHeight}
                          stroke="hsl(var(--border))"
                          strokeWidth="2"
                        />
                      )}
                      <text
                        x={x + stepWidth / 2}
                        y={canvasHeight - margin + 20}
                        textAnchor="middle"
                        fill="hsl(var(--muted-foreground))"
                        fontSize="12"
                      >
                        {i}
                      </text>
                    </g>
                  );
                })}
                
                <text
                  x={margin}
                  y={canvasHeight - margin + 40}
                  textAnchor="start"
                  fill="hsl(var(--foreground))"
                  fontWeight="600"
                  fontSize="14"
                >
                  {minLabel}
                </text>
                <text
                  x={canvasWidth - margin}
                  y={margin - 10}
                  textAnchor="end"
                  fill="hsl(var(--foreground))"
                  fontWeight="600"
                  fontSize="14"
                >
                  {maxLabel}
                </text>
                
                {placedNotes.map((note) => {
                  const position = positions.find(p => p.noteId === note.id);
                  if (!position) return null;
                  
                  const score = Number(position.score);
                  const stepIndex = Math.round((score - (staircase?.minScore || 0)) / 
                    ((staircase?.maxScore || 10) - (staircase?.minScore || 0)) * (stepCount - 1));
                  
                  const baseX = margin + stepIndex * stepWidth + stepWidth / 2;
                  const baseY = canvasHeight - margin - stepIndex * stepHeight - stepHeight / 2;
                  
                  const offsetY = (position.slotOffset || 0) * 44;
                  const x = baseX;
                  const y = baseY - offsetY;
                  
                  const isDragging = draggedNote?.noteId === note.id;
                  
                  let displayX = x;
                  let displayY = y;
                  if (isDragging) {
                    const dragStepIndex = draggedNote.currentStepIndex;
                    displayX = margin + dragStepIndex * stepWidth + stepWidth / 2;
                    displayY = canvasHeight - margin - dragStepIndex * stepHeight - stepHeight / 2;
                  }
                  
                  const displayText = note.content.replace(/<[^>]*>?/gm, '');
                  
                  return (
                    <g
                      key={position.id || note.id}
                      transform={`translate(${displayX}, ${displayY})`}
                      onPointerDown={(e) => handleDragStart(e, note, position)}
                      className={isReadOnly ? '' : 'cursor-grab'}
                      style={{ opacity: isDragging ? 0.7 : 1, touchAction: 'none' }}
                      data-testid={`staircase-note-${note.id}`}
                    >
                      <rect
                        x={-45}
                        y={-20}
                        width={90}
                        height={40}
                        rx={6}
                        fill={getCategoryColor(note.manualCategoryId, null, note.id)}
                        stroke={isDragging ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                        strokeWidth={isDragging ? 2 : 1}
                      />
                      <text
                        x={0}
                        y={5}
                        textAnchor="middle"
                        fill="white"
                        fontSize="12"
                        fontWeight="500"
                        style={{ pointerEvents: 'none' }}
                      >
                        {displayText.length > 12 
                          ? displayText.substring(0, 12) + '...' 
                          : displayText}
                      </text>
                    </g>
                  );
                })}

                {placedNotes.length === 0 && (
                  <text
                    x={canvasWidth / 2}
                    y={canvasHeight / 2}
                    textAnchor="middle"
                    fill="hsl(var(--muted-foreground))"
                    fontSize="14"
                  >
                    Place notes from the panel on the left
                  </text>
                )}
              </svg>
            </div>
            
            {staircase?.showDistribution && positions.length > 0 && (
              <Card className="w-56 shrink-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />
                    Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Array.from(scoreDistribution.entries())
                    .sort((a, b) => b[0] - a[0])
                    .map(([score, count]) => {
                      const maxCount = Math.max(...Array.from(scoreDistribution.values()), 1);
                      return (
                        <div key={score} className="flex items-center gap-2">
                          <span className="text-sm w-8 text-right">{score}</span>
                          <div className="flex-1 bg-muted rounded-full h-3 relative">
                            <div
                              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-6">{count}</span>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent data-testid="staircase-settings-dialog">
          <DialogHeader>
            <DialogTitle>Configure Staircase</DialogTitle>
            <DialogDescription>
              Customize the staircase rating scale and labels.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min-label">Minimum Label</Label>
                <Input
                  id="min-label"
                  value={minLabel}
                  onChange={(e) => setMinLabel(e.target.value)}
                  placeholder="e.g., Lowest"
                  data-testid="input-min-label"
                />
              </div>
              <div>
                <Label htmlFor="max-label">Maximum Label</Label>
                <Input
                  id="max-label"
                  value={maxLabel}
                  onChange={(e) => setMaxLabel(e.target.value)}
                  placeholder="e.g., Highest"
                  data-testid="input-max-label"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="step-count">Number of Steps</Label>
              <Input
                id="step-count"
                type="number"
                min="5"
                max="21"
                value={stepCount}
                onChange={(e) => setStepCount(parseInt(e.target.value) || 11)}
                data-testid="input-step-count"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                updateStaircaseMutation.mutate({
                  minLabel,
                  maxLabel,
                  stepCount,
                });
              }}
              data-testid="button-save-staircase-settings"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
