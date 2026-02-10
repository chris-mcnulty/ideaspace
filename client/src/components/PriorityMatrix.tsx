import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings2, Grid, Move } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Note, PriorityMatrix, PriorityMatrixPosition, Category } from '@shared/schema';

interface PriorityMatrixProps {
  spaceId: string;
  moduleRunId?: string;
  isReadOnly?: boolean;
  isFacilitator?: boolean;
}

interface Position {
  x: number;  // 0-100 percentage
  y: number;  // 0-100 percentage
}

interface DraggedNote {
  id: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function PriorityMatrix({ 
  spaceId, 
  moduleRunId,
  isReadOnly = false,
  isFacilitator = false,
}: PriorityMatrixProps) {
  const { toast } = useToast();
  const matrixRef = useRef<HTMLDivElement>(null);
  const [draggedNote, setDraggedNote] = useState<DraggedNote | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [xAxisLabel, setXAxisLabel] = useState('Impact');
  const [yAxisLabel, setYAxisLabel] = useState('Effort');
  const [localPositions, setLocalPositions] = useState<Map<string, Position>>(new Map());
  const localPositionsRef = useRef<Map<string, Position>>(new Map());

  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${spaceId}/notes`],
    staleTime: 0,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: [`/api/spaces/${spaceId}/categories`],
    enabled: !!spaceId,
  });

  const { data: matrix, isLoading: matrixLoading } = useQuery<PriorityMatrix>({
    queryKey: [`/api/spaces/${spaceId}/priority-matrix`],
    enabled: !!spaceId,
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery<PriorityMatrixPosition[]>({
    queryKey: [`/api/spaces/${spaceId}/priority-matrix/positions`],
    enabled: !!spaceId,
    staleTime: 0,
  });

  const updateMatrixMutation = useMutation({
    mutationFn: (data: { xAxisLabel: string; yAxisLabel: string }) =>
      apiRequest('PUT', `/api/spaces/${spaceId}/priority-matrix`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/priority-matrix`] });
      toast({
        title: 'Matrix Updated',
        description: 'Axis labels have been updated successfully.',
      });
      setShowSettings(false);
    },
    onError: () => {
      toast({
        title: 'Update Failed',
        description: 'Failed to update matrix configuration.',
        variant: 'destructive',
      });
    },
  });

  const updatePositionMutation = useMutation({
    mutationFn: (data: { noteId: string; xCoord: number; yCoord: number }) =>
      apiRequest('PUT', `/api/spaces/${spaceId}/priority-matrix/positions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/priority-matrix/positions`] });
    },
    onError: () => {
      toast({
        title: 'Position Update Failed',
        description: 'Failed to save position. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const matrixId = matrix?.id;
  const matrixXLabel = matrix?.xAxisLabel;
  const matrixYLabel = matrix?.yAxisLabel;
  
  useEffect(() => {
    if (matrixXLabel && matrixXLabel !== xAxisLabel) {
      setXAxisLabel(matrixXLabel);
    }
    if (matrixYLabel && matrixYLabel !== yAxisLabel) {
      setYAxisLabel(matrixYLabel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixId]);

  const positionsKey = positions.map(p => `${p.noteId}:${p.xCoord}:${p.yCoord}`).join('|');
  
  useEffect(() => {
    if (positions.length === 0) return;
    
    const posMap = new Map<string, Position>();
    positions.forEach(pos => {
      posMap.set(pos.noteId, { x: pos.xCoord, y: pos.yCoord });
    });
    setLocalPositions(posMap);
    localPositionsRef.current = posMap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey]);

  useEffect(() => {
    if (isReadOnly) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?spaceId=${spaceId}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'matrix_position_updated') {
          const posData = data.data;
          if (posData?.noteId) {
            const x = typeof posData.xCoord === 'number' ? (posData.xCoord <= 1 ? posData.xCoord * 100 : posData.xCoord) : 50;
            const y = typeof posData.yCoord === 'number' ? (posData.yCoord <= 1 ? posData.yCoord * 100 : posData.yCoord) : 50;
            setLocalPositions(prev => {
              const newPositions = new Map(prev);
              newPositions.set(posData.noteId, { x, y });
              localPositionsRef.current = newPositions;
              return newPositions;
            });
          }
        }
      } catch (error) {
        console.error('[PriorityMatrix] WebSocket message error:', error);
      }
    };

    return () => {
      ws.close();
    };
  }, [spaceId, isReadOnly]);

  const draggedNoteRef = useRef<string | null>(null);

  const handlePointerDown = (e: React.PointerEvent, noteId: string) => {
    if (isReadOnly) return;
    
    const rect = matrixRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentPos = localPositions.get(noteId) || { x: 50, y: 50 };
    
    draggedNoteRef.current = noteId;
    setDraggedNote({
      id: noteId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: currentPos.x,
      currentY: currentPos.y,
    });

    if (matrixRef.current) {
      matrixRef.current.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggedNote) return;
    
    const rect = matrixRef.current?.getBoundingClientRect();
    if (!rect) return;

    const deltaX = ((e.clientX - draggedNote.startX) / rect.width) * 100;
    const deltaY = ((e.clientY - draggedNote.startY) / rect.height) * 100;

    const newX = Math.max(0, Math.min(100, draggedNote.currentX + deltaX));
    const newY = Math.max(0, Math.min(100, draggedNote.currentY - deltaY));

    setLocalPositions(prev => {
      const newPositions = new Map(prev);
      newPositions.set(draggedNote.id, { x: newX, y: newY });
      localPositionsRef.current = newPositions;
      return newPositions;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const currentDraggedId = draggedNoteRef.current;
    if (!currentDraggedId) return;
    
    const finalPos = localPositionsRef.current.get(currentDraggedId);
    if (finalPos) {
      updatePositionMutation.mutate({
        noteId: currentDraggedId,
        xCoord: finalPos.x,
        yCoord: finalPos.y,
      });
    }
    
    draggedNoteRef.current = null;
    setDraggedNote(null);
    
    if (matrixRef.current) {
      try {
        matrixRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer may already be released
      }
    }
  };

  const handleSaveSettings = () => {
    updateMatrixMutation.mutate({ xAxisLabel, yAxisLabel });
  };

  const isLoading = notesLoading || categoriesLoading || matrixLoading || positionsLoading;

  if (isLoading) {
    return (
      <Card className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Grid className="h-5 w-5" />
          <h2 className="text-xl font-semibold">2x2 Priority Matrix</h2>
        </div>
        
        {isFacilitator && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            data-testid="button-matrix-settings"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Configure Axes
          </Button>
        )}
      </div>

      <Card className="flex-1 relative">
        <CardContent className="p-0 h-full">
          <div 
            ref={matrixRef}
            className="relative w-full h-full min-h-[500px]"
            style={{ cursor: draggedNote ? 'grabbing' : 'default', touchAction: 'none' }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            data-testid="matrix-grid"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-2 pointer-events-none">
              <span className="text-sm font-medium text-muted-foreground">
                High {yAxisLabel}
              </span>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-2 pointer-events-none">
              <span className="text-sm font-medium text-muted-foreground">
                Low {yAxisLabel}
              </span>
            </div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 pointer-events-none">
              <span className="text-sm font-medium text-muted-foreground">
                Low {xAxisLabel}
              </span>
            </div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-2 pointer-events-none">
              <span className="text-sm font-medium text-muted-foreground">
                High {xAxisLabel}
              </span>
            </div>

            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-border" />
            </div>

            <div className="absolute top-2 left-2 text-xs text-muted-foreground pointer-events-none">
              Low {xAxisLabel} / High {yAxisLabel}
            </div>
            <div className="absolute top-2 right-2 text-xs text-muted-foreground pointer-events-none">
              High {xAxisLabel} / High {yAxisLabel}
            </div>
            <div className="absolute bottom-2 left-2 text-xs text-muted-foreground pointer-events-none">
              Low {xAxisLabel} / Low {yAxisLabel}
            </div>
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground pointer-events-none">
              High {xAxisLabel} / Low {yAxisLabel}
            </div>

            {notes.map((note) => {
              const position = localPositions.get(note.id) || { x: 50, y: 50 };
              const isDragging = draggedNote?.id === note.id;
              const category = note.manualCategoryId 
                ? categories.find(c => c.id === note.manualCategoryId) 
                : null;
              
              const displayText = note.content.replace(/<[^>]*>?/gm, '');
              
              const noteColors = [
                '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
                '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16',
              ];
              const hash = note.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
              const noteColor = category?.color || noteColors[hash % noteColors.length];

              return (
                <div
                  key={note.id}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                    isDragging ? 'z-50' : 'z-10'
                  } ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  style={{
                    left: `${position.x}%`,
                    top: `${100 - position.y}%`,
                    transition: isDragging ? 'none' : 'all 0.2s ease',
                    touchAction: 'none',
                  }}
                  onPointerDown={(e) => handlePointerDown(e, note.id)}
                  data-testid={`note-${note.id}`}
                >
                  <div 
                    className={`
                      bg-card rounded-lg p-2 shadow-sm
                      ${isDragging ? 'shadow-lg scale-105' : 'hover:shadow-md'}
                      min-w-[100px] max-w-[200px]
                    `}
                    style={{ 
                      borderWidth: '2px', 
                      borderStyle: 'solid',
                      borderColor: noteColor,
                    }}
                  >
                    <p className="text-sm font-medium line-clamp-2">{displayText}</p>
                    {category && (
                      <Badge 
                        variant="secondary" 
                        className="mt-1 text-xs"
                        style={{ backgroundColor: `${noteColor}20`, color: noteColor }}
                      >
                        {category.name}
                      </Badge>
                    )}
                    {!isReadOnly && (
                      <Move className="h-3 w-3 text-muted-foreground absolute bottom-1 right-1" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Matrix Axes</DialogTitle>
            <DialogDescription>
              Customize the labels for the X and Y axes of your priority matrix.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="x-axis">Horizontal Axis (X)</Label>
              <Input
                id="x-axis"
                value={xAxisLabel}
                onChange={(e) => setXAxisLabel(e.target.value)}
                placeholder="e.g., Impact, Value, Importance"
                data-testid="input-x-axis-label"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="y-axis">Vertical Axis (Y)</Label>
              <Input
                id="y-axis"
                value={yAxisLabel}
                onChange={(e) => setYAxisLabel(e.target.value)}
                placeholder="e.g., Effort, Cost, Complexity"
                data-testid="input-y-axis-label"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSettings(false)}
              data-testid="button-cancel-settings"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={updateMatrixMutation.isPending}
              data-testid="button-save-settings"
            >
              {updateMatrixMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isReadOnly && notes.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Drag and drop notes to position them on the matrix. Changes are saved automatically.
        </div>
      )}

      {notes.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No notes available yet. Participants need to create notes during ideation before they can be positioned on the matrix.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
