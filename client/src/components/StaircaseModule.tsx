import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings2, TrendingUp, BarChart2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Idea, StaircaseModule, StaircasePosition, Category } from '@shared/schema';

interface StaircaseModuleProps {
  spaceId: string;
  moduleRunId?: string;
  isReadOnly?: boolean;
}

interface DraggedIdea {
  id: string;
  ideaId: string;
  startY: number;
  currentY: number;
  // Calculated step index for visual positioning along the staircase
  currentStepIndex: number;
}

export default function StaircaseModule({ 
  spaceId, 
  moduleRunId,
  isReadOnly = false 
}: StaircaseModuleProps) {
  const { toast } = useToast();
  const canvasRef = useRef<SVGSVGElement>(null);
  const [draggedIdea, setDraggedIdea] = useState<DraggedIdea | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [minLabel, setMinLabel] = useState('Lowest');
  const [maxLabel, setMaxLabel] = useState('Highest');
  const [stepCount, setStepCount] = useState(11);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  // Fetch ideas
  const { data: ideas = [], isLoading: ideasLoading } = useQuery<Idea[]>({
    queryKey: [`/api/spaces/${spaceId}/ideas`],
    staleTime: 0,
  });

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: [`/api/spaces/${spaceId}/categories`],
    enabled: !!spaceId,
  });

  // Fetch staircase configuration
  const { data: staircase, isLoading: staircaseLoading } = useQuery<StaircaseModule>({
    queryKey: [`/api/spaces/${spaceId}/staircase`],
    enabled: !!spaceId,
  });

  // Fetch positions
  const { data: positions = [], isLoading: positionsLoading } = useQuery<StaircasePosition[]>({
    queryKey: [`/api/spaces/${spaceId}/staircase-positions`],
    enabled: !!spaceId,
    staleTime: 0,
  });

  // Create/update staircase config
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

  // Update position mutation
  const updatePositionMutation = useMutation({
    mutationFn: (data: { ideaId: string; score: number; slotOffset?: number }) =>
      apiRequest('POST', `/api/spaces/${spaceId}/staircase-positions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/staircase-positions`] });
    },
    onError: () => {
      toast({
        title: 'Position Update Failed',
        description: 'Failed to save idea position. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Initialize labels and config from staircase data
  useEffect(() => {
    if (staircase) {
      setMinLabel(staircase.minLabel);
      setMaxLabel(staircase.maxLabel);
      setStepCount(staircase.stepCount);
    }
  }, [staircase]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined' || !spaceId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?spaceId=${spaceId}`);
    
    ws.onopen = () => {
      console.log('[StaircaseModule] WebSocket connected');
      // Send join message to register this connection with the space
      ws.send(JSON.stringify({ type: 'join', data: { spaceId } }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'staircase_position_updated') {
          // Invalidate positions query to get fresh data
          queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/staircase-positions`] });
        }
      } catch (error) {
        console.error('[StaircaseModule] WebSocket message error:', error);
        toast({
          title: 'Real-time Update Error',
          description: 'Failed to process real-time update. Please refresh the page.',
          variant: 'destructive',
        });
      }
    };

    ws.onerror = (error) => {
      console.error('[StaircaseModule] WebSocket error:', error);
      toast({
        title: 'Connection Error',
        description: 'Real-time collaboration may not be working. Changes will still be saved.',
        variant: 'destructive',
      });
    };

    ws.onclose = () => {
      console.log('[StaircaseModule] WebSocket disconnected');
    };

    setWsConnection(ws);

    return () => {
      ws.close();
    };
  }, [spaceId, toast]);

  // Calculate staircase dimensions and positions
  const canvasWidth = 800;
  const canvasHeight = 600;
  const margin = 60;
  const stepWidth = (canvasWidth - 2 * margin) / stepCount;
  const stepHeight = (canvasHeight - 2 * margin) / stepCount;

  // Group positions by score for slot offset calculation
  const positionsByScore = new Map<number, StaircasePosition[]>();
  positions.forEach(pos => {
    const score = Number(pos.score);
    if (!positionsByScore.has(score)) {
      positionsByScore.set(score, []);
    }
    positionsByScore.get(score)?.push(pos);
  });

  // Get category color with fallback to AI category
  const getCategoryColor = (manualCategoryId?: string | null, aiCategoryId?: string | null) => {
    const categoryId = manualCategoryId || aiCategoryId;
    if (!categoryId) return 'hsl(var(--muted))';
    const category = categories.find(c => c.id === categoryId);
    return category?.color || 'hsl(var(--muted))';
  };

  // Handle drag start - works with or without existing position
  const handleDragStart = (e: React.PointerEvent, idea: Idea, position?: StaircasePosition) => {
    if (isReadOnly) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    // Calculate initial step index
    const stepIndex = Math.floor((canvasHeight - margin - y) / stepHeight);
    const clampedStep = Math.max(0, Math.min(stepCount - 1, stepIndex));
    
    setDraggedIdea({
      id: position?.id || `new-${idea.id}`,
      ideaId: idea.id,
      startY: y,
      currentY: y,
      currentStepIndex: clampedStep,
    });
    
    (e.target as Element).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  // Handle drag move
  const handleDragMove = (e: React.PointerEvent) => {
    if (!draggedIdea) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    // Calculate step index for staircase positioning
    const stepIndex = Math.floor((canvasHeight - margin - y) / stepHeight);
    const clampedStep = Math.max(0, Math.min(stepCount - 1, stepIndex));
    
    setDraggedIdea(prev => prev ? { ...prev, currentY: y, currentStepIndex: clampedStep } : null);
  };

  // Handle drag end
  const handleDragEnd = (e: React.PointerEvent) => {
    if (!draggedIdea || !staircase) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Calculate which step the idea was dropped on
    const stepIndex = Math.floor((canvasHeight - margin - draggedIdea.currentY) / stepHeight);
    const clampedStep = Math.max(0, Math.min(stepCount - 1, stepIndex));
    
    // Calculate score from step
    const scoreRange = staircase.maxScore - staircase.minScore;
    const score = staircase.minScore + (clampedStep / (stepCount - 1)) * scoreRange;
    
    // Calculate slot offset for this score
    const existingAtScore = positionsByScore.get(score) || [];
    const slotOffset = existingAtScore.filter(p => p.ideaId !== draggedIdea.ideaId).length;
    
    // Update position
    updatePositionMutation.mutate({
      ideaId: draggedIdea.ideaId,
      score,
      slotOffset,
    });
    
    setDraggedIdea(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  // Calculate score distribution for histogram
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

  const isLoading = ideasLoading || categoriesLoading || staircaseLoading || positionsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Staircase Rating Module
            </CardTitle>
            {!isReadOnly && (
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
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex gap-6">
            {/* Staircase Canvas */}
            <div className="flex-1">
              <svg
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                className="border rounded-lg bg-muted/10"
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerLeave={handleDragEnd}
                data-testid="staircase-canvas"
              >
                {/* Draw staircase steps */}
                {Array.from({ length: stepCount }).map((_, i) => {
                  const x = margin + i * stepWidth;
                  const y = canvasHeight - margin - i * stepHeight;
                  
                  return (
                    <g key={i}>
                      {/* Step line */}
                      <line
                        x1={x}
                        y1={y}
                        x2={x + stepWidth}
                        y2={y}
                        stroke="hsl(var(--border))"
                        strokeWidth="2"
                      />
                      {/* Vertical line to next step */}
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
                      {/* Step label */}
                      <text
                        x={x + stepWidth / 2}
                        y={canvasHeight - margin + 20}
                        textAnchor="middle"
                        className="fill-muted-foreground text-xs"
                      >
                        {i}
                      </text>
                    </g>
                  );
                })}
                
                {/* Axis labels */}
                <text
                  x={margin}
                  y={canvasHeight - margin + 40}
                  textAnchor="start"
                  className="fill-foreground font-semibold"
                >
                  {minLabel}
                </text>
                <text
                  x={canvasWidth - margin}
                  y={margin - 10}
                  textAnchor="end"
                  className="fill-foreground font-semibold"
                >
                  {maxLabel}
                </text>
                
                {/* Render all ideas */}
                {ideas.map((idea) => {
                  const position = positions.find(p => p.ideaId === idea.id);
                  
                  // Use default position (middle) if no position exists
                  const score = position ? Number(position.score) : ((staircase?.minScore || 0) + (staircase?.maxScore || 10)) / 2;
                  const stepIndex = Math.round((score - (staircase?.minScore || 0)) / 
                    ((staircase?.maxScore || 10) - (staircase?.minScore || 0)) * (stepCount - 1));
                  
                  const baseX = margin + stepIndex * stepWidth + stepWidth / 2;
                  const baseY = canvasHeight - margin - stepIndex * stepHeight - stepHeight / 2;
                  
                  // Apply slot offset for multiple ideas at same score
                  const offsetX = (position?.slotOffset || 0) * 40;
                  const x = baseX + offsetX;
                  const y = baseY;
                  
                  const isDragging = draggedIdea?.ideaId === idea.id;
                  
                  // When dragging, position along the staircase path based on current step
                  let displayX = x;
                  let displayY = y;
                  if (isDragging) {
                    const dragStepIndex = draggedIdea.currentStepIndex;
                    displayX = margin + dragStepIndex * stepWidth + stepWidth / 2;
                    displayY = canvasHeight - margin - dragStepIndex * stepHeight - stepHeight / 2;
                  }
                  
                  return (
                    <g
                      key={position?.id || idea.id}
                      transform={`translate(${displayX}, ${displayY})`}
                      onPointerDown={(e) => handleDragStart(e, idea, position)}
                      className={isReadOnly ? '' : 'cursor-grab'}
                      style={{ opacity: isDragging ? 0.7 : 1, touchAction: 'none' }}
                      data-testid={`staircase-idea-${idea.id}`}
                    >
                      <rect
                        x={-45}
                        y={-20}
                        width={90}
                        height={40}
                        rx={6}
                        fill={getCategoryColor(idea.manualCategoryId)}
                        stroke={isDragging ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                        strokeWidth={isDragging ? 2 : 1}
                      />
                      <text
                        x={0}
                        y={5}
                        textAnchor="middle"
                        className="fill-foreground text-sm font-medium"
                        style={{ pointerEvents: 'none' }}
                      >
                        {(idea.content || '').length > 12 
                          ? (idea.content || '').substring(0, 12) + '...' 
                          : (idea.content || '')}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            
            {/* Score Distribution */}
            {staircase?.showDistribution && (
              <Card className="w-64">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" />
                    Score Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Array.from(scoreDistribution.entries())
                    .sort((a, b) => b[0] - a[0])
                    .map(([score, count]) => {
                      const maxCount = Math.max(...Array.from(scoreDistribution.values()));
                      return (
                        <div key={score} className="flex items-center gap-2">
                          <span className="text-sm w-12 text-right">{score}</span>
                          <div className="flex-1 bg-muted rounded-full h-4 relative">
                            <div
                              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8">{count}</span>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Settings Dialog */}
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