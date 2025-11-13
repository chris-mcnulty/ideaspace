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
import type { Idea, PriorityMatrix, PriorityMatrixPosition, Category } from '@shared/schema';

interface PriorityMatrixProps {
  spaceId: string;
  moduleRunId?: string;
  isReadOnly?: boolean;
}

interface Position {
  x: number;  // 0-100 percentage
  y: number;  // 0-100 percentage
}

interface DraggedIdea {
  id: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function PriorityMatrix({ 
  spaceId, 
  moduleRunId,
  isReadOnly = false 
}: PriorityMatrixProps) {
  const { toast } = useToast();
  const matrixRef = useRef<HTMLDivElement>(null);
  const [draggedIdea, setDraggedIdea] = useState<DraggedIdea | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [xAxisLabel, setXAxisLabel] = useState('Impact');
  const [yAxisLabel, setYAxisLabel] = useState('Effort');
  const [localPositions, setLocalPositions] = useState<Map<string, Position>>(new Map());
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  // Fetch ideas
  const { data: ideas = [], isLoading: ideasLoading } = useQuery<Idea[]>({
    queryKey: [`/api/spaces/${spaceId}/ideas`],
    staleTime: 0, // Always refetch for real-time updates
  });

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: [`/api/spaces/${spaceId}/categories`],
    enabled: !!spaceId,
  });

  // Fetch matrix configuration
  const { data: matrix, isLoading: matrixLoading } = useQuery<PriorityMatrix>({
    queryKey: [`/api/spaces/${spaceId}/priority-matrix`],
    enabled: !!spaceId,
  });

  // Fetch positions
  const { data: positions = [], isLoading: positionsLoading } = useQuery<PriorityMatrixPosition[]>({
    queryKey: [`/api/spaces/${spaceId}/priority-matrix/positions`],
    enabled: !!spaceId,
    staleTime: 0,
  });

  // Create/update matrix config
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

  // Update position mutation
  const updatePositionMutation = useMutation({
    mutationFn: (data: { ideaId: string; xCoord: number; yCoord: number }) =>
      apiRequest('PUT', `/api/spaces/${spaceId}/priority-matrix/positions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/priority-matrix/positions`] });
    },
    onError: () => {
      toast({
        title: 'Position Update Failed',
        description: 'Failed to save idea position. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Initialize axis labels from matrix data
  useEffect(() => {
    if (matrix) {
      setXAxisLabel(matrix.xAxisLabel);
      setYAxisLabel(matrix.yAxisLabel);
    }
  }, [matrix]);

  // Initialize local positions from fetched positions
  useEffect(() => {
    const posMap = new Map<string, Position>();
    positions.forEach(pos => {
      posMap.set(pos.ideaId, { x: pos.xCoord, y: pos.yCoord });
    });
    setLocalPositions(posMap);
  }, [positions]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (isReadOnly) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'join-matrix',
        spaceId,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'matrix-position-update' && data.spaceId === spaceId) {
        // Update local position without refetching
        setLocalPositions(prev => {
          const newPositions = new Map(prev);
          newPositions.set(data.ideaId, { x: data.xCoord, y: data.yCoord });
          return newPositions;
        });
      }
    };

    setWsConnection(ws);

    return () => {
      ws.close();
    };
  }, [spaceId, isReadOnly]);

  // Handle mouse down on idea
  const handleMouseDown = (e: React.MouseEvent, ideaId: string) => {
    if (isReadOnly) return;
    
    const rect = matrixRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentPos = localPositions.get(ideaId) || { x: 50, y: 50 };
    
    setDraggedIdea({
      id: ideaId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: currentPos.x,
      currentY: currentPos.y,
    });

    e.preventDefault();
  };

  // Handle mouse move
  useEffect(() => {
    if (!draggedIdea) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = matrixRef.current?.getBoundingClientRect();
      if (!rect) return;

      const deltaX = ((e.clientX - draggedIdea.startX) / rect.width) * 100;
      const deltaY = ((e.clientY - draggedIdea.startY) / rect.height) * 100;

      const newX = Math.max(0, Math.min(100, draggedIdea.currentX + deltaX));
      const newY = Math.max(0, Math.min(100, draggedIdea.currentY + deltaY));

      setLocalPositions(prev => {
        const newPositions = new Map(prev);
        newPositions.set(draggedIdea.id, { x: newX, y: newY });
        return newPositions;
      });

      // Send real-time update via WebSocket
      if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
          type: 'matrix-position-update',
          spaceId,
          ideaId: draggedIdea.id,
          xCoord: newX,
          yCoord: newY,
        }));
      }
    };

    const handleMouseUp = () => {
      if (draggedIdea) {
        // Get the final position using a callback to ensure we have the latest state
        setLocalPositions(prev => {
          const finalPos = prev.get(draggedIdea.id);
          if (finalPos) {
            // Save to backend
            updatePositionMutation.mutate({
              ideaId: draggedIdea.id,
              xCoord: finalPos.x,
              yCoord: finalPos.y,
            });
          }
          return prev;
        });
      }
      setDraggedIdea(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedIdea, wsConnection, spaceId]);

  // Handle settings save
  const handleSaveSettings = () => {
    updateMatrixMutation.mutate({ xAxisLabel, yAxisLabel });
  };

  const isLoading = ideasLoading || categoriesLoading || matrixLoading || positionsLoading;

  if (isLoading) {
    return (
      <Card className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid className="h-5 w-5" />
          <h2 className="text-xl font-semibold">2x2 Priority Matrix</h2>
        </div>
        
        {!isReadOnly && (
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

      {/* Matrix Grid */}
      <Card className="flex-1 relative overflow-hidden">
        <CardContent className="p-0 h-full">
          <div 
            ref={matrixRef}
            className="relative w-full h-full min-h-[500px]"
            style={{ cursor: draggedIdea ? 'grabbing' : 'default' }}
            data-testid="matrix-grid"
          >
            {/* Axis Labels */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-2">
              <span className="text-sm font-medium text-muted-foreground">
                High {yAxisLabel}
              </span>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-2">
              <span className="text-sm font-medium text-muted-foreground">
                Low {yAxisLabel}
              </span>
            </div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2">
              <span className="text-sm font-medium text-muted-foreground">
                Low {xAxisLabel}
              </span>
            </div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-2">
              <span className="text-sm font-medium text-muted-foreground">
                High {xAxisLabel}
              </span>
            </div>

            {/* Grid Lines */}
            <div className="absolute inset-0">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-border" />
            </div>

            {/* Quadrant Labels */}
            <div className="absolute top-2 left-2 text-xs text-muted-foreground">
              Low {xAxisLabel} / High {yAxisLabel}
            </div>
            <div className="absolute top-2 right-2 text-xs text-muted-foreground">
              High {xAxisLabel} / High {yAxisLabel}
            </div>
            <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">
              Low {xAxisLabel} / Low {yAxisLabel}
            </div>
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              High {xAxisLabel} / Low {yAxisLabel}
            </div>

            {/* Ideas */}
            {ideas.map((idea) => {
              const position = localPositions.get(idea.id) || { x: 50, y: 50 };
              const isDragging = draggedIdea?.id === idea.id;
              const category = idea.manualCategoryId 
                ? categories.find(c => c.id === idea.manualCategoryId) 
                : null;
              
              // Use contentPlain if available, otherwise strip HTML from content
              const displayText = idea.contentPlain || idea.content.replace(/<[^>]*>?/gm, '');

              return (
                <div
                  key={idea.id}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                    isDragging ? 'z-50' : 'z-10'
                  } ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  style={{
                    left: `${position.x}%`,
                    top: `${100 - position.y}%`, // Invert Y axis (top = high)
                    transition: isDragging ? 'none' : 'all 0.2s ease',
                  }}
                  onMouseDown={(e) => handleMouseDown(e, idea.id)}
                  data-testid={`idea-${idea.id}`}
                >
                  <div className={`
                    bg-card border rounded-lg p-2 shadow-sm
                    ${isDragging ? 'shadow-lg scale-105' : 'hover:shadow-md'}
                    ${!isReadOnly ? 'hover:border-primary/50' : ''}
                    min-w-[100px] max-w-[200px]
                  `}>
                    <p className="text-sm font-medium line-clamp-2">{displayText}</p>
                    {category && (
                      <Badge variant="secondary" className="mt-1 text-xs">
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

      {/* Settings Dialog */}
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

      {/* Helper text */}
      {!isReadOnly && ideas.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Drag and drop ideas to position them on the matrix. Changes are saved automatically.
        </div>
      )}

      {ideas.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No ideas available. Add ideas to start positioning them on the matrix.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}