import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, Save, RotateCcw, GripVertical, 
  FileText, Vote, TrendingUp, ShoppingCart, 
  Grid3x3, ClipboardList, ChevronUp, ChevronDown,
  Info, Lock
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { WorkspaceModule } from '@shared/schema';

interface ModuleConfigurationProps {
  spaceId: string;
}

// Module metadata with icons and descriptions
const MODULE_METADATA: Record<string, {
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  configurable: boolean;
  config?: Record<string, any>;
}> = {
  'ideation': {
    name: 'Ideation',
    icon: FileText,
    description: 'Collect and manage ideas from participants',
    configurable: true,
    config: {
      maxIdeasPerParticipant: 10,
      allowAnonymous: false,
      requireCategory: false
    }
  },
  'pairwise-voting': {
    name: 'Pairwise Voting',
    icon: Vote,
    description: 'Compare ideas head-to-head in randomized pairs',
    configurable: true,
    config: {
      roundsPerParticipant: 20,
      showProgress: true,
      allowSkip: true
    }
  },
  'stack-ranking': {
    name: 'Stack Ranking',
    icon: TrendingUp,
    description: 'Rank ideas from best to worst using Borda Count',
    configurable: true,
    config: {
      maxRankings: 10,
      showScores: false,
      allowTies: false
    }
  },
  'marketplace': {
    name: 'Marketplace',
    icon: ShoppingCart,
    description: 'Allocate virtual coins to favorite ideas',
    configurable: true,
    config: {
      coinsPerParticipant: 100,
      maxCoinsPerIdea: 50,
      showLeaderboard: true
    }
  },
  'priority-matrix': {
    name: '2x2 Priority Matrix',
    icon: Grid3x3,
    description: 'Position ideas on a customizable 2x2 grid',
    configurable: true,
    config: {
      xAxisLabel: 'Impact',
      yAxisLabel: 'Effort',
      collaborative: true
    }
  },
  'survey': {
    name: 'Survey',
    icon: ClipboardList,
    description: 'Rate ideas on custom 1-5 scale questions',
    configurable: true,
    config: {
      questionsPerIdea: 3,
      randomizeOrder: false,
      showAverage: true
    }
  }
};

// Sortable module item component
function SortableModuleItem({ 
  module, 
  metadata,
  onToggle,
  onConfigure 
}: { 
  module: WorkspaceModule;
  metadata: typeof MODULE_METADATA[string];
  onToggle: (enabled: boolean) => void;
  onConfigure: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = metadata.icon;

  return (
    <Card 
      ref={setNodeRef} 
      style={style}
      className={`${isDragging ? 'z-50' : ''} ${module.enabled ? '' : 'opacity-60'}`}
      data-testid={`card-module-${module.moduleType}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              {...attributes}
              {...listeners}
              className="cursor-move touch-none"
              data-testid={`handle-module-${module.moduleType}`}
            >
              <GripVertical className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <Icon className="w-5 h-5" />
            
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                {metadata.name}
                {module.enabled && (
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {metadata.description}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {metadata.configurable && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={onConfigure}
                      disabled={!module.enabled}
                      data-testid={`button-configure-${module.moduleType}`}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Configure module settings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            <Switch
              checked={module.enabled}
              onCheckedChange={onToggle}
              data-testid={`switch-module-${module.moduleType}`}
            />
          </div>
        </div>
      </CardHeader>
      
      {module.config && typeof module.config === 'object' && Object.keys(module.config as Record<string, any>).length > 0 && (
        <CardContent className="pt-0">
          <div className="text-xs text-muted-foreground">
            <div className="flex items-start gap-1">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              <div>
                Current configuration: {Object.entries(module.config as Record<string, any>).map(([key, value]) => (
                  <span key={key} className="inline-block mr-2">
                    <strong>{key}:</strong> {String(value)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function ModuleConfiguration({ spaceId }: ModuleConfigurationProps) {
  const { toast } = useToast();
  const [configuringModule, setConfiguringModule] = useState<WorkspaceModule | null>(null);
  const [moduleConfig, setModuleConfig] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Fetch workspace modules
  const { data: modules = [], isLoading, refetch } = useQuery<WorkspaceModule[]>({
    queryKey: ['/api/workspace-modules', spaceId],
    enabled: !!spaceId
  });
  
  // Update module mutation
  const updateModuleMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<WorkspaceModule> & { id: string }) => {
      const response = await apiRequest('PATCH', `/api/workspace-modules/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspace-modules', spaceId] });
      setHasChanges(false);
      toast({ title: "Module configuration updated" });
    },
    onError: () => {
      toast({ title: "Failed to update module", variant: "destructive" });
    }
  });
  
  // Create module mutation (for missing modules)
  const createModuleMutation = useMutation({
    mutationFn: async (moduleData: any) => {
      const response = await apiRequest('POST', '/api/workspace-modules', moduleData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspace-modules', spaceId] });
      toast({ title: "Module added to workspace" });
    },
    onError: () => {
      toast({ title: "Failed to add module", variant: "destructive" });
    }
  });
  
  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }
    
    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    
    const reorderedModules = arrayMove(modules, oldIndex, newIndex);
    
    // Update order indexes
    reorderedModules.forEach((module, index) => {
      updateModuleMutation.mutate({
        id: module.id,
        orderIndex: index
      });
    });
    
    setHasChanges(true);
  };
  
  // Handle module toggle
  const handleModuleToggle = (moduleId: string, enabled: boolean) => {
    const module = modules.find(m => m.id === moduleId);
    if (!module) return;
    
    updateModuleMutation.mutate({
      id: moduleId,
      enabled
    });
    
    setHasChanges(true);
  };
  
  // Handle module configuration
  const handleConfigureModule = (module: WorkspaceModule) => {
    setConfiguringModule(module);
    setModuleConfig(module.config || MODULE_METADATA[module.moduleType]?.config || {});
  };
  
  // Save module configuration
  const handleSaveConfiguration = () => {
    if (!configuringModule) return;
    
    updateModuleMutation.mutate({
      id: configuringModule.id,
      config: moduleConfig
    });
    
    setConfiguringModule(null);
    setModuleConfig({});
  };
  
  // Add missing modules
  const handleAddMissingModule = (moduleId: string) => {
    createModuleMutation.mutate({
      spaceId,
      moduleType: moduleId,  // Map the moduleId to moduleType for the API
      enabled: false,
      orderIndex: modules.length,
      config: MODULE_METADATA[moduleId]?.config || {}
    });
  };
  
  // Check for missing modules
  const existingModuleIds = new Set(modules.map(m => m.moduleType));
  const missingModules = Object.keys(MODULE_METADATA).filter(id => !existingModuleIds.has(id));
  
  // Sort modules by orderIndex
  const sortedModules = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
  
  // Reset all modules to default
  const handleResetAll = () => {
    modules.forEach((module) => {
      const defaultConfig = MODULE_METADATA[module.moduleType]?.config || {};
      updateModuleMutation.mutate({
        id: module.id,
        enabled: false,
        config: defaultConfig
      });
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading module configuration...</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6" data-testid="module-configuration">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Module Configuration
            </CardTitle>
            <CardDescription>
              Enable modules and customize the journey for your workspace
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="default">Unsaved changes</Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetAll}
              data-testid="button-reset-modules"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset All
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Active Modules */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                Active Journey
                <Badge variant="secondary">{sortedModules.filter(m => m.enabled).length} modules</Badge>
              </h3>
              
              {sortedModules.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sortedModules.map(m => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {sortedModules.map((module) => {
                        const metadata = MODULE_METADATA[module.moduleType];
                        if (!metadata) return null;
                        
                        return (
                          <SortableModuleItem
                            key={module.id}
                            module={module}
                            metadata={metadata}
                            onToggle={(enabled) => handleModuleToggle(module.id, enabled)}
                            onConfigure={() => handleConfigureModule(module)}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No modules configured. Add modules below to get started.
                </div>
              )}
            </div>
            
            {/* Available Modules */}
            {missingModules.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  Available Modules
                  <Badge variant="outline">{missingModules.length} available</Badge>
                </h3>
                
                <div className="grid gap-2">
                  {missingModules.map((moduleId) => {
                    const metadata = MODULE_METADATA[moduleId];
                    if (!metadata) return null;
                    
                    const Icon = metadata.icon;
                    
                    return (
                      <Card 
                        key={moduleId}
                        className="opacity-60"
                        data-testid={`card-available-${moduleId}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <Icon className="w-5 h-5" />
                              
                              <div className="flex-1">
                                <CardTitle className="text-base">
                                  {metadata.name}
                                </CardTitle>
                                <CardDescription className="text-xs mt-0.5">
                                  {metadata.description}
                                </CardDescription>
                              </div>
                            </div>
                            
                            <Button
                              size="sm"
                              onClick={() => handleAddMissingModule(moduleId)}
                              data-testid={`button-add-${moduleId}`}
                            >
                              Add to Workspace
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Journey Preview */}
            <div>
              <h3 className="text-sm font-medium mb-3">Journey Preview</h3>
              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {sortedModules
                    .filter(m => m.enabled)
                    .map((module, index) => {
                      const metadata = MODULE_METADATA[module.moduleType];
                      if (!metadata) return null;
                      
                      const Icon = metadata.icon;
                      
                      return (
                        <div key={module.id} className="flex items-center gap-2">
                          <Badge variant="secondary" className="gap-1.5">
                            <span className="text-xs font-medium">{index + 1}</span>
                            <Icon className="w-3 h-3" />
                            {metadata.name}
                          </Badge>
                          {index < sortedModules.filter(m => m.enabled).length - 1 && (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      );
                    })}
                  {sortedModules.filter(m => m.enabled).length === 0 && (
                    <span className="text-muted-foreground text-sm">
                      No modules enabled. Enable modules above to create a journey.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Configuration Dialog */}
      <Dialog open={!!configuringModule} onOpenChange={() => setConfiguringModule(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Configure {configuringModule && MODULE_METADATA[configuringModule.moduleType]?.name}
            </DialogTitle>
            <DialogDescription>
              Customize settings for this module
            </DialogDescription>
          </DialogHeader>
          
          {configuringModule && (
            <div className="space-y-4">
              {Object.entries(moduleConfig).map(([key, value]) => (
                <div key={key}>
                  <Label htmlFor={key}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Label>
                  {typeof value === 'boolean' ? (
                    <Switch
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => 
                        setModuleConfig({ ...moduleConfig, [key]: checked })
                      }
                    />
                  ) : typeof value === 'number' ? (
                    <Input
                      id={key}
                      type="number"
                      value={value}
                      onChange={(e) => 
                        setModuleConfig({ ...moduleConfig, [key]: parseInt(e.target.value) })
                      }
                      className="mt-1"
                    />
                  ) : (
                    <Input
                      id={key}
                      value={value}
                      onChange={(e) => 
                        setModuleConfig({ ...moduleConfig, [key]: e.target.value })
                      }
                      className="mt-1"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConfiguringModule(null)}
              data-testid="button-cancel-config"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfiguration}
              data-testid="button-save-config"
            >
              <Save className="w-4 h-4 mr-1" />
              Save Configuration
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Import for missing icon
import { ChevronRight } from 'lucide-react';