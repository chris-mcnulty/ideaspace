import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Upload, Download, Trash2, Edit2, Save, X, 
  Image, FileText, Hash, Users, Calendar, Search,
  FolderPlus, Tag, MoreVertical, Check, ArrowRight, StickyNote
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Idea, Category, Note, Participant } from '@shared/schema';

interface IdeasHubProps {
  spaceId: string;
  categories: Category[];
}

export default function IdeasHub({ spaceId, categories }: IdeasHubProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [selectedIdeas, setSelectedIdeas] = useState<Set<string>>(new Set());
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState<'delete' | 'categorize' | null>(null);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'ideas' | 'notes'>('ideas');
  
  // Form state for new idea
  const [newIdea, setNewIdea] = useState({
    content: '',
    contentType: 'text' as const,
    category: ''
  });
  
  // Import state
  const [importData, setImportData] = useState('');
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv');
  
  // Fetch ideas
  const { data: ideas = [], isLoading, refetch } = useQuery<Idea[]>({
    queryKey: [`/api/spaces/${spaceId}/ideas`],
    enabled: !!spaceId
  });
  
  // Fetch session notes (participant-created content)
  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${spaceId}/notes`],
    enabled: !!spaceId
  });
  
  // Fetch participants for note author lookup
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: [`/api/spaces/${spaceId}/participants`],
    enabled: !!spaceId
  });
  
  // Mutations
  const createIdeaMutation = useMutation({
    mutationFn: async (ideaData: any) => {
      const response = await apiRequest('POST', `/api/spaces/${spaceId}/ideas`, ideaData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/ideas`] });
      setNewIdea({ content: '', contentType: 'text', category: '' });
      setShowAddDialog(false);
      toast({ title: "Idea added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add idea", variant: "destructive" });
    }
  });
  
  const updateIdeaMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await apiRequest('PATCH', `/api/ideas/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/ideas`] });
      setEditingIdea(null);
      toast({ title: "Idea updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update idea", variant: "destructive" });
    }
  });
  
  const deleteIdeaMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/ideas/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/ideas`] });
      toast({ title: "Idea deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete idea", variant: "destructive" });
    }
  });
  
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ideaIds: string[]) => {
      const response = await apiRequest('DELETE', '/api/ideas/bulk', { spaceId, ideaIds });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/ideas`] });
      setSelectedIdeas(new Set());
      setBulkAction(null);
      toast({ title: `${selectedIdeas.size} ideas deleted successfully` });
    },
    onError: () => {
      toast({ title: "Failed to delete ideas", variant: "destructive" });
    }
  });
  
  const bulkCategorizeMutation = useMutation({
    mutationFn: async ({ ideaIds, categoryId }: { ideaIds: string[]; categoryId: string | null }) => {
      const response = await apiRequest('POST', '/api/ideas/bulk-categorize', { spaceId, ideaIds, categoryId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/ideas`] });
      setSelectedIdeas(new Set());
      setBulkAction(null);
      setBulkCategoryId('');
      toast({ title: `${selectedIdeas.size} ideas categorized successfully` });
    },
    onError: () => {
      toast({ title: "Failed to categorize ideas", variant: "destructive" });
    }
  });
  
  const importIdeasMutation = useMutation({
    mutationFn: async (ideas: any[]) => {
      const response = await apiRequest('POST', '/api/ideas/import', { spaceId, ideas });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/ideas`] });
      setImportData('');
      setShowImportDialog(false);
      toast({ title: `${data.length} ideas imported successfully` });
    },
    onError: () => {
      toast({ title: "Failed to import ideas", variant: "destructive" });
    }
  });
  
  // Promote notes to ideas mutation
  const promoteNotesMutation = useMutation({
    mutationFn: async (noteIds: string[]) => {
      const response = await apiRequest('POST', `/api/spaces/${spaceId}/ideas/from-notes`, { noteIds });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/ideas`] });
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/notes`] });
      setSelectedNotes(new Set());
      toast({ title: `${data.count || data.length || 'Notes'} promoted to ideas successfully` });
    },
    onError: () => {
      toast({ title: "Failed to promote notes to ideas", variant: "destructive" });
    }
  });
  
  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('spaceId', spaceId);
      
      const response = await fetch('/api/ideas/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/ideas`] });
      setShowAddDialog(false);
      toast({ title: "Image uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to upload image", variant: "destructive" });
    }
  });
  
  // Filter ideas
  const filteredIdeas = ideas.filter((idea: Idea) => {
    const matchesSearch = idea.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || 
      (filterCategory === 'uncategorized' ? !idea.manualCategoryId : idea.manualCategoryId === filterCategory);
    const matchesSource = filterSource === 'all' || idea.sourceType === filterSource;
    return matchesSearch && matchesCategory && matchesSource;
  });
  
  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIdeas(new Set(filteredIdeas.map((i: Idea) => i.id)));
    } else {
      setSelectedIdeas(new Set());
    }
  };
  
  // Handle idea selection
  const handleSelectIdea = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIdeas);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIdeas(newSelected);
  };
  
  // Handle bulk actions
  const handleBulkDelete = () => {
    if (selectedIdeas.size === 0) return;
    bulkDeleteMutation.mutate(Array.from(selectedIdeas));
  };
  
  const handleBulkCategorize = () => {
    if (selectedIdeas.size === 0) return;
    bulkCategorizeMutation.mutate({
      ideaIds: Array.from(selectedIdeas),
      categoryId: bulkCategoryId || null
    });
  };
  
  // Parse import data
  const parseImportData = (): any[] => {
    try {
      if (importFormat === 'json') {
        return JSON.parse(importData);
      } else {
        // Parse CSV
        const lines = importData.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header] = values[i];
          });
          return obj;
        });
      }
    } catch (error) {
      toast({ title: "Invalid import format", variant: "destructive" });
      return [];
    }
  };
  
  // Handle import
  const handleImport = () => {
    const parsedData = parseImportData();
    if (parsedData.length > 0) {
      importIdeasMutation.mutate(parsedData);
    }
  };
  
  // Export ideas
  const handleExport = (format: 'csv' | 'json') => {
    const dataToExport = selectedIdeas.size > 0 
      ? filteredIdeas.filter((i: Idea) => selectedIdeas.has(i.id))
      : filteredIdeas;
    
    let content: string;
    let filename: string;
    let mimeType: string;
    
    if (format === 'json') {
      content = JSON.stringify(dataToExport, null, 2);
      filename = `ideas-${spaceId}-${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      // Create CSV
      const headers = ['id', 'content', 'contentType', 'category', 'source', 'createdAt'];
      const rows = dataToExport.map((idea: Idea) => [
        idea.id,
        `"${idea.content.replace(/"/g, '""')}"`,
        idea.contentType,
        idea.manualCategoryId || '',
        idea.sourceType,
        new Date(idea.createdAt).toISOString()
      ]);
      
      content = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
      filename = `ideas-${spaceId}-${Date.now()}.csv`;
      mimeType = 'text/csv';
    }
    
    // Download file
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: `Exported ${dataToExport.length} ideas` });
  };
  
  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type.startsWith('image/')) {
      uploadImageMutation.mutate(file);
    } else {
      toast({ title: "Please select an image file", variant: "destructive" });
    }
  };
  
  // Source type labels
  const sourceTypeLabels: Record<string, string> = {
    participant: 'Participant',
    facilitator: 'Facilitator',
    preloaded: 'Preloaded',
    imported: 'Imported',
    ai_generated: 'AI Generated'
  };
  
  // Get category by ID
  const getCategoryById = (id: string | null) => {
    if (!id) return null;
    return categories.find(c => c.id === id);
  };
  
  // Get participant by ID for note author lookup
  const getParticipantById = (id: string | null) => {
    if (!id) return null;
    return participants.find(p => p.id === id);
  };
  
  // Handle note selection
  const handleSelectNote = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedNotes);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedNotes(newSelected);
  };
  
  // Handle select all notes
  const handleSelectAllNotes = (checked: boolean) => {
    if (checked) {
      setSelectedNotes(new Set(notes.map((n: Note) => n.id)));
    } else {
      setSelectedNotes(new Set());
    }
  };
  
  // Handle promote notes to ideas
  const handlePromoteNotes = () => {
    if (selectedNotes.size === 0) return;
    promoteNotesMutation.mutate(Array.from(selectedNotes));
  };
  
  // Handle promote all notes
  const handlePromoteAllNotes = () => {
    if (notes.length === 0) return;
    promoteNotesMutation.mutate(notes.map((n: Note) => n.id));
  };
  
  return (
    <div className="space-y-4" data-testid="ideas-hub">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5" />
              Ideas Hub
            </CardTitle>
            <CardDescription>
              Manage all ideas and session notes
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {ideas.length} ideas
            </Badge>
            <Badge variant="outline">
              {notes.length} session notes
            </Badge>
            {activeTab === 'ideas' && selectedIdeas.size > 0 && (
              <Badge variant="default">
                {selectedIdeas.size} selected
              </Badge>
            )}
            {activeTab === 'notes' && selectedNotes.size > 0 && (
              <Badge variant="default">
                {selectedNotes.size} selected
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Tab Navigation */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ideas' | 'notes')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="ideas" data-testid="tab-ideas">
                <FolderPlus className="w-4 h-4 mr-2" />
                Ideas ({ideas.length})
              </TabsTrigger>
              <TabsTrigger value="notes" data-testid="tab-notes">
                <StickyNote className="w-4 h-4 mr-2" />
                Session Notes ({notes.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="ideas" className="mt-0">
          {/* Toolbar */}
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                onClick={() => setShowAddDialog(true)}
                size="sm"
                data-testid="button-add-idea"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Idea
              </Button>
              
              <Button 
                onClick={() => setShowImportDialog(true)}
                size="sm"
                variant="outline"
                data-testid="button-import-ideas"
              >
                <Upload className="w-4 h-4 mr-1" />
                Import
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-export-ideas">
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {selectedIdeas.size > 0 && (
                <>
                  <Button 
                    onClick={() => setBulkAction('categorize')}
                    size="sm"
                    variant="outline"
                    data-testid="button-bulk-categorize"
                  >
                    <Tag className="w-4 h-4 mr-1" />
                    Categorize ({selectedIdeas.size})
                  </Button>
                  
                  <Button 
                    onClick={() => setBulkAction('delete')}
                    size="sm"
                    variant="destructive"
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete ({selectedIdeas.size})
                  </Button>
                </>
              )}
            </div>
            
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search ideas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                  data-testid="input-search-ideas"
                />
              </div>
              
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[150px]" data-testid="select-filter-source">
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {Object.entries(sourceTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Ideas List */}
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">Loading ideas...</div>
              </div>
            ) : filteredIdeas.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">No ideas found</div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Select All */}
                <div className="flex items-center gap-2 p-2 border-b">
                  <Checkbox
                    checked={selectedIdeas.size === filteredIdeas.length && filteredIdeas.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all {filteredIdeas.length} ideas
                  </span>
                </div>
                
                {/* Ideas */}
                {filteredIdeas.map((idea: Idea) => {
                  const category = getCategoryById(idea.manualCategoryId);
                  const isEditing = editingIdea?.id === idea.id;
                  
                  return (
                    <div 
                      key={idea.id}
                      className="flex items-start gap-2 p-3 border rounded-lg hover-elevate"
                      data-testid={`card-idea-${idea.id}`}
                    >
                      <Checkbox
                        checked={selectedIdeas.has(idea.id)}
                        onCheckedChange={(checked) => handleSelectIdea(idea.id, !!checked)}
                        data-testid={`checkbox-idea-${idea.id}`}
                      />
                      
                      <div className="flex-1 space-y-2">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingIdea.content}
                              onChange={(e) => setEditingIdea({
                                ...editingIdea,
                                content: e.target.value
                              })}
                              className="min-h-[60px]"
                              data-testid={`textarea-edit-${idea.id}`}
                            />
                            <Select
                              value={editingIdea.manualCategoryId || ''}
                              onValueChange={(val) => setEditingIdea({
                                ...editingIdea,
                                manualCategoryId: val || null
                              })}
                            >
                              <SelectTrigger data-testid={`select-category-${idea.id}`}>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">No category</SelectItem>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateIdeaMutation.mutate(editingIdea)}
                                data-testid={`button-save-${idea.id}`}
                              >
                                <Save className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingIdea(null)}
                                data-testid={`button-cancel-${idea.id}`}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start gap-2">
                              {idea.contentType === 'image' && (
                                <Image className="w-4 h-4 text-muted-foreground mt-0.5" />
                              )}
                              <p className="text-sm flex-1" data-testid={`text-content-${idea.id}`}>
                                {idea.content}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                              {category && (
                                <Badge variant="secondary" className="text-xs">
                                  {category.name}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {sourceTypeLabels[idea.sourceType] || idea.sourceType}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(idea.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {!isEditing && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              data-testid={`button-menu-${idea.id}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => setEditingIdea(idea)}
                              data-testid={`menuitem-edit-${idea.id}`}
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => deleteIdeaMutation.mutate(idea.id)}
                              className="text-destructive"
                              data-testid={`menuitem-delete-${idea.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
            </TabsContent>
            
            <TabsContent value="notes" className="mt-0">
              {/* Notes Toolbar */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {notes.length > 0 && (
                  <>
                    <Button 
                      onClick={handlePromoteAllNotes}
                      size="sm"
                      disabled={promoteNotesMutation.isPending}
                      data-testid="button-promote-all-notes"
                    >
                      <ArrowRight className="w-4 h-4 mr-1" />
                      Promote All to Ideas
                    </Button>
                    {selectedNotes.size > 0 && (
                      <Button 
                        onClick={handlePromoteNotes}
                        size="sm"
                        variant="outline"
                        disabled={promoteNotesMutation.isPending}
                        data-testid="button-promote-selected-notes"
                      >
                        <ArrowRight className="w-4 h-4 mr-1" />
                        Promote Selected ({selectedNotes.size})
                      </Button>
                    )}
                  </>
                )}
              </div>
              
              {/* Notes List */}
              <ScrollArea className="h-[500px]">
                {notesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-muted-foreground">Loading session notes...</div>
                  </div>
                ) : notes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <StickyNote className="w-12 h-12 text-muted-foreground mb-2" />
                    <div className="text-muted-foreground">No session notes yet</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Participant notes will appear here during ideation
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Select All Notes */}
                    <div className="flex items-center gap-2 p-2 border-b">
                      <Checkbox
                        id="select-all-notes"
                        checked={notes.length > 0 && selectedNotes.size === notes.length}
                        onCheckedChange={handleSelectAllNotes}
                        data-testid="checkbox-select-all-notes"
                      />
                      <label htmlFor="select-all-notes" className="text-sm text-muted-foreground">
                        Select all session notes
                      </label>
                    </div>
                    
                    {/* Note Items - Enhanced legibility */}
                    {notes.map((note: Note) => {
                      const participant = getParticipantById(note.participantId);
                      return (
                        <div 
                          key={note.id}
                          className="flex items-start gap-4 p-4 border-2 rounded-lg hover-elevate bg-card"
                          data-testid={`note-item-${note.id}`}
                        >
                          <Checkbox
                            checked={selectedNotes.has(note.id)}
                            onCheckedChange={(checked) => handleSelectNote(note.id, checked === true)}
                            className="mt-1"
                            data-testid={`checkbox-note-${note.id}`}
                          />
                          
                          <div className="flex-1 space-y-2">
                            <p className="text-base font-medium leading-relaxed" data-testid={`text-note-content-${note.id}`}>
                              {note.content}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge 
                                variant="secondary" 
                                className="text-xs font-semibold"
                              >
                                <Users className="w-3 h-3 mr-1" />
                                {participant?.displayName || 'Anonymous'}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">
                                {new Date(note.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => promoteNotesMutation.mutate([note.id])}
                            disabled={promoteNotesMutation.isPending}
                            data-testid={`button-promote-note-${note.id}`}
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Add Idea Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Idea</DialogTitle>
            <DialogDescription>
              Create a new idea or upload an image
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="text">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="image">Image</TabsTrigger>
            </TabsList>
            
            <TabsContent value="text" className="space-y-4">
              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={newIdea.content}
                  onChange={(e) => setNewIdea({ ...newIdea, content: e.target.value })}
                  placeholder="Enter idea content..."
                  className="min-h-[100px]"
                  data-testid="textarea-new-idea"
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category (optional)</Label>
                <Select
                  value={newIdea.category}
                  onValueChange={(val) => setNewIdea({ ...newIdea, category: val })}
                >
                  <SelectTrigger data-testid="select-new-idea-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No category</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                  data-testid="button-cancel-add"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createIdeaMutation.mutate({
                    content: newIdea.content,
                    contentType: 'text',
                    manualCategoryId: newIdea.category || null
                  })}
                  disabled={!newIdea.content.trim()}
                  data-testid="button-save-new-idea"
                >
                  Add Idea
                </Button>
              </DialogFooter>
            </TabsContent>
            
            <TabsContent value="image" className="space-y-4">
              <div>
                <Label htmlFor="image-upload">Select Image</Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  data-testid="input-image-upload"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supported formats: JPG, PNG, GIF, SVG (max 5MB)
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Ideas</DialogTitle>
            <DialogDescription>
              Import ideas from CSV or JSON format
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Format</Label>
              <Select value={importFormat} onValueChange={(v: 'csv' | 'json') => setImportFormat(v)}>
                <SelectTrigger data-testid="select-import-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="import-data">Data</Label>
              <Textarea
                id="import-data"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder={
                  importFormat === 'csv'
                    ? 'content,category,source\n"First idea",Category1,imported\n"Second idea",Category2,imported'
                    : '[{"content": "First idea", "category": "Category1"}, ...]'
                }
                className="min-h-[200px] font-mono text-xs"
                data-testid="textarea-import-data"
              />
            </div>
            
            <Alert>
              <AlertDescription>
                {importFormat === 'csv' 
                  ? 'CSV format: First row should contain headers (content, category, source). Each subsequent row is an idea.'
                  : 'JSON format: Array of objects with content, category (optional), and source (optional) fields.'
                }
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportData('');
              }}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importData.trim()}
              data-testid="button-import"
            >
              Import Ideas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Categorize Dialog */}
      {bulkAction === 'categorize' && (
        <Dialog open onOpenChange={() => setBulkAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Categorize {selectedIdeas.size} Ideas</DialogTitle>
              <DialogDescription>
                Select a category to apply to all selected ideas
              </DialogDescription>
            </DialogHeader>
            
            <div>
              <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                <SelectTrigger data-testid="select-bulk-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Remove category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setBulkAction(null);
                  setBulkCategoryId('');
                }}
                data-testid="button-cancel-bulk-categorize"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkCategorize}
                data-testid="button-apply-bulk-categorize"
              >
                Apply Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Bulk Delete Confirmation */}
      {bulkAction === 'delete' && (
        <Dialog open onOpenChange={() => setBulkAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {selectedIdeas.size} Ideas</DialogTitle>
              <DialogDescription>
                This action cannot be undone. Are you sure you want to delete these ideas?
              </DialogDescription>
            </DialogHeader>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setBulkAction(null)}
                data-testid="button-cancel-bulk-delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                data-testid="button-confirm-bulk-delete"
              >
                Delete Ideas
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}