import { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import BrandHeader from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Merge,
  PlayCircle,
  PauseCircle,
  XCircle,
  Users,
  StickyNote,
  Sparkles,
  ListOrdered,
  BookOpen,
  FileStack,
  Loader2,
  Download,
  Upload,
  Trophy,
  ArrowLeft,
  Coins,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Organization, Space, Note, Participant, Category, User } from "@shared/schema";
import { Leaderboard } from "@/components/Leaderboard";
import { KnowledgeBaseManager } from "@/components/KnowledgeBaseManager";

export default function FacilitatorWorkspace() {
  const params = useParams() as { org: string; space: string };
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [mergedNoteContent, setMergedNoteContent] = useState("");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState("general");
  const [templateDescription, setTemplateDescription] = useState("");
  const [rewriteDialogNote, setRewriteDialogNote] = useState<Note | null>(null);
  const [rewriteVariations, setRewriteVariations] = useState<Array<{ version: number; content: string }>>([]);
  const [editDialogNote, setEditDialogNote] = useState<Note | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#8B5CF6");
  const [isDataManagementDialogOpen, setIsDataManagementDialogOpen] = useState(false);
  const [dataManagementTab, setDataManagementTab] = useState<"export" | "import">("export");

  // WebSocket connection for real-time updates
  const handleWebSocketMessage = useCallback((message: { type: string; data: any }) => {
    console.log('[FacilitatorWorkspace] WebSocket message:', message);
    
    switch (message.type) {
      case 'note_created':
      case 'note_updated':
      case 'note_deleted':
      case 'notes_deleted':
      case 'categories_updated':
        // Invalidate notes query to refetch latest data
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
        if (message.type === 'categories_updated') {
          // Also invalidate categories query since AI may have created new categories
          queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/categories`] });
          toast({
            title: "AI Categorization Complete",
            description: message.data?.summary || "Notes have been organized into categories",
          });
        }
        break;
      case 'category_created':
      case 'category_updated':
      case 'category_deleted':
        // Invalidate categories query to refetch latest data
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/categories`] });
        break;
      case 'participant_joined':
      case 'participant_left':
        // Invalidate participants query
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/participants`] });
        break;
    }
  }, [params.space, toast]);

  useWebSocket({
    spaceId: params.space,
    onMessage: handleWebSocketMessage,
    onOpen: () => console.log('[FacilitatorWorkspace] WebSocket connected'),
    onClose: () => console.log('[FacilitatorWorkspace] WebSocket disconnected'),
    enabled: !!params.space,
  });

  // Fetch organization
  const { data: org } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  // Fetch space
  const { data: space, isLoading: spaceLoading } = useQuery<Space>({
    queryKey: [`/api/spaces/${params.space}`],
  });

  // Fetch notes
  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${params.space}/notes`],
    enabled: !!params.space,
  });

  // Fetch participants
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: [`/api/spaces/${params.space}/participants`],
    enabled: !!params.space,
  });

  // Fetch manual categories
  const { data: manualCategories = [] } = useQuery<Category[]>({
    queryKey: [`/api/spaces/${params.space}/categories`],
    enabled: !!params.space,
  });

  // Fetch votes
  const { data: votes = [] } = useQuery<any[]>({
    queryKey: [`/api/spaces/${params.space}/votes`],
    enabled: !!params.space,
  });

  // Fetch ranking leaderboard
  const { data: leaderboardData } = useQuery<{ leaderboard: any[]; totalNotes: number; totalRankings: number }>({
    queryKey: [`/api/spaces/${params.space}/leaderboard`],
    enabled: !!params.space,
  });
  const leaderboard = leaderboardData?.leaderboard || [];

  // Fetch ranking progress
  const { data: rankingProgress } = useQuery<{ totalParticipants: number; participantsCompleted: number; percentComplete: number; isComplete: boolean }>({
    queryKey: [`/api/spaces/${params.space}/ranking-progress`],
    enabled: !!params.space,
  });

  // Fetch cohort results
  const { data: cohortResults, isLoading: cohortResultsLoading } = useQuery<any>({
    queryKey: [`/api/spaces/${params.space}/results/cohort`],
    enabled: !!params.space,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/spaces/${params.space}/results/cohort`, {
        credentials: "include",
      });
      
      // Treat 404 as "no results yet" rather than an error
      if (res.status === 404) {
        return null;
      }
      
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      
      return await res.json();
    },
  });

  // Generate cohort results mutation
  const generateCohortResultsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/spaces/${params.space}/results/cohort`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/results/cohort`] });
      toast({
        title: "Cohort Results Generated",
        description: "AI-powered summary has been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to generate results",
        description: error.message,
      });
    },
  });

  // Update pairwise scope mutation
  const updatePairwiseScopeMutation = useMutation({
    mutationFn: async (scope: "all" | "within_categories") => {
      const response = await apiRequest("PATCH", `/api/spaces/${params.space}`, {
        pairwiseScope: scope,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}`] });
      toast({
        title: "Voting Scope Updated",
        description: "Pairwise voting settings have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update settings",
        description: error.message,
      });
    },
  });

  // Navigate participants mutation
  const navigateParticipantsMutation = useMutation({
    mutationFn: async (phase: "vote" | "rank" | "marketplace" | "ideate") => {
      const response = await apiRequest("POST", `/api/spaces/${params.space}/navigate-participants`, {
        phase,
      });
      return await response.json();
    },
    onSuccess: (_, phase) => {
      toast({
        title: "Participants Navigated",
        description: `All participants have been directed to the ${phase} phase`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to navigate participants",
        description: error.message,
      });
    },
  });

  // Update workspace settings mutation
  const updateWorkspaceSettings = useMutation({
    mutationFn: async (settings: { aiResultsEnabled?: boolean; marketplaceCoinBudget?: number }) => {
      const response = await apiRequest("PATCH", `/api/spaces/${params.space}`, settings);
      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}`] });
      let description = "";
      if (variables.aiResultsEnabled !== undefined) {
        description = variables.aiResultsEnabled 
          ? "AI personalized results have been enabled for verified participants"
          : "AI personalized results have been disabled";
      } else if (variables.marketplaceCoinBudget !== undefined) {
        description = `Marketplace coin budget updated to ${variables.marketplaceCoinBudget} coins per participant`;
      }
      toast({
        title: "Settings Updated",
        description,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update settings",
        description: error.message,
      });
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      // Create a facilitator participant if needed, or use existing
      // For MVP, we'll use the first participant or create a system one
      let facilitatorParticipantId = participants.find(p => !p.isGuest)?.id;
      
      if (!facilitatorParticipantId && participants.length > 0) {
        facilitatorParticipantId = participants[0].id;
      }
      
      // If still no participant, create a system participant
      if (!facilitatorParticipantId) {
        const systemParticipantResponse = await apiRequest("POST", "/api/participants", {
          spaceId: params.space,
          userId: null,
          displayName: "Facilitator",
          isGuest: false,
          isOnline: true,
          profileData: { role: "facilitator" },
        });
        const systemParticipant = await systemParticipantResponse.json();
        facilitatorParticipantId = systemParticipant.id;
      }
      
      const response = await apiRequest("POST", "/api/notes", {
        spaceId: params.space,
        participantId: facilitatorParticipantId,
        content,
        category: null,
        isAiCategory: false,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      setIsAddNoteDialogOpen(false);
      setNewNoteContent("");
      toast({
        title: "Note added",
        description: "The note has been preloaded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to add note",
        description: error.message,
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      toast({
        title: "Note deleted",
        description: "The note has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete note",
        description: error.message,
      });
    },
  });

  // Update note visibility mutation
  const updateNoteVisibilityMutation = useMutation({
    mutationFn: async ({ noteId, updates }: { noteId: string; updates: { visibleInRanking?: boolean; visibleInMarketplace?: boolean } }) => {
      const response = await apiRequest("PATCH", `/api/notes/${noteId}`, updates);
      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      toast({
        title: "Visibility Updated",
        description: "Note visibility settings have been changed",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update visibility",
        description: error.message,
      });
    },
  });

  // Edit note mutation
  const editNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const response = await apiRequest("PATCH", `/api/notes/${noteId}`, { content });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      setEditDialogNote(null);
      setEditNoteContent("");
      toast({
        title: "Note updated",
        description: "Your changes have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update note",
        description: error.message,
      });
    },
  });

  // Rewrite note mutation (AI-powered variations)
  const rewriteNoteMutation = useMutation({
    mutationFn: async ({ noteId, count }: { noteId: string; count: number }) => {
      const response = await apiRequest("POST", `/api/notes/${noteId}/rewrite`, { count });
      return await response.json() as { 
        original: { id: string; content: string; category: string | null }; 
        variations: Array<{ version: number; content: string }> 
      };
    },
    onSuccess: (data, variables) => {
      setRewriteVariations(data.variations);
      toast({
        title: "AI Rewrites Generated",
        description: `${data.variations.length} variations created`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to generate rewrites",
        description: error.message,
      });
      setRewriteDialogNote(null);
    },
  });

  // Update space status mutation
  const updateSpaceStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const updates: any = { status };
      
      // When starting a session (status = open), automatically enable ideation phase
      if (status === "open") {
        const now = new Date();
        const farFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
        updates.ideationStartsAt = now;
        updates.ideationEndsAt = farFuture;
      }
      
      const response = await apiRequest("PATCH", `/api/spaces/${params.space}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}`] });
      toast({
        title: "Session updated",
        description: "The session status has been changed",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update session",
        description: error.message,
      });
    },
  });

  // AI Categorization mutation
  const categorizeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/spaces/${params.space}/categorize`, {});
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.details || errorData.error || "Categorization failed");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      // Note: WebSocket handler will show the completion toast when categories_updated arrives
      // This ensures UI only updates after server successfully broadcasts the results
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "AI Categorization Failed",
        description: error.message,
      });
    },
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const response = await apiRequest("POST", `/api/spaces/${params.space}/categories`, {
        name,
        color,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/categories`] });
      setIsCategoryDialogOpen(false);
      setCategoryName("");
      setCategoryColor("#8B5CF6");
      toast({
        title: "Category created",
        description: "The category has been added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to create category",
        description: error.message,
      });
    },
  });

  // Update note category mutation
  const updateNoteCategoryMutation = useMutation({
    mutationFn: async ({ noteId, categoryId }: { noteId: string; categoryId: string | null }) => {
      const response = await apiRequest("PATCH", `/api/notes/${noteId}`, {
        manualCategoryId: categoryId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      toast({
        title: "Category updated",
        description: "Note category has been changed",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update category",
        description: error.message,
      });
    },
  });

  // Import data (ideas and categories) from CSV
  const importDataMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/spaces/${params.space}/import/data-csv`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Import failed" }));
        throw new Error(errorData.error || "Failed to import data");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/categories`] });
      setIsDataManagementDialogOpen(false);
      toast({
        title: "Data imported",
        description: `Successfully imported ${data.imported} ideas` + (data.errors ? `. ${data.errors.length} errors occurred.` : ''),
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to import data",
        description: error.message,
      });
    },
  });


  // Filter notes based on search
  const filteredNotes = notes.filter((note) =>
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group notes by category for better organization
  const groupedNotes = filteredNotes.reduce((acc, note) => {
    // Look up category name via manualCategoryId instead of using deprecated category field
    let categoryName = "No Category";
    
    if (note.manualCategoryId) {
      const matchedCategory = manualCategories.find(c => c.id === note.manualCategoryId);
      if (matchedCategory) {
        categoryName = matchedCategory.name;
      }
    }
    
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(note);
    return acc;
  }, {} as Record<string, Note[]>);

  const categories = Object.keys(groupedNotes).sort((a, b) => {
    // Sort: No Category last, others alphabetically
    if (a === "No Category") return 1;
    if (b === "No Category") return -1;
    return a.localeCompare(b);
  });

  // Generate consistent colors for categories
  const getCategoryColor = (category: string): string => {
    const colors = [
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    ];
    if (category === "No Category") {
      return "bg-muted text-muted-foreground";
    }
    const index = category.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  // Toggle note selection
  const toggleNoteSelection = (noteId: string) => {
    const newSelected = new Set(selectedNotes);
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId);
    } else {
      newSelected.add(noteId);
    }
    setSelectedNotes(newSelected);
  };

  // Bulk delete selected notes
  const handleBulkDelete = async () => {
    if (selectedNotes.size === 0) return;
    
    for (const noteId of Array.from(selectedNotes)) {
      await deleteNoteMutation.mutateAsync(noteId);
    }
    setSelectedNotes(new Set());
  };

  // Handle merge notes
  const handleMergeNotes = () => {
    if (selectedNotes.size < 2) {
      toast({
        variant: "destructive",
        title: "Select at least 2 notes",
        description: "You need to select at least 2 notes to merge",
      });
      return;
    }

    // Get selected note contents
    const selectedNoteContents = notes
      .filter(note => selectedNotes.has(note.id))
      .map(note => note.content);
    
    // Pre-fill merged content
    setMergedNoteContent(selectedNoteContents.join(" • "));
    setIsMergeDialogOpen(true);
  };

  // Merge mutation - create merged note and delete originals
  const mergeNotesMutation = useMutation({
    mutationFn: async () => {
      // Get facilitator participant ID
      let facilitatorParticipantId = participants.find(p => !p.isGuest)?.id;
      
      if (!facilitatorParticipantId && participants.length > 0) {
        facilitatorParticipantId = participants[0].id;
      }
      
      if (!facilitatorParticipantId) {
        const systemParticipantResponse = await apiRequest("POST", "/api/participants", {
          spaceId: params.space,
          userId: null,
          displayName: "Facilitator",
          isGuest: false,
          isOnline: true,
          profileData: { role: "facilitator" },
        });
        const systemParticipant = await systemParticipantResponse.json();
        facilitatorParticipantId = systemParticipant.id;
      }
      
      // Create the merged note
      const noteResponse = await apiRequest("POST", "/api/notes", {
        spaceId: params.space,
        participantId: facilitatorParticipantId,
        content: mergedNoteContent,
        category: null,
        isAiCategory: false,
      });
      await noteResponse.json();
      
      // Delete the original notes
      for (const noteId of Array.from(selectedNotes)) {
        await apiRequest("DELETE", `/api/notes/${noteId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      setIsMergeDialogOpen(false);
      setMergedNoteContent("");
      setSelectedNotes(new Set());
      toast({
        title: "Notes merged",
        description: `Combined ${selectedNotes.size} notes into one`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to merge notes",
        description: error.message,
      });
    },
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; description?: string }) => {
      const response = await apiRequest("POST", "/api/templates", {
        spaceId: params.space,
        name: data.name,
        type: data.type,
        description: data.description || undefined,
      });
      return await response.json();
    },
    onSuccess: (_, variables) => {
      setIsTemplateDialogOpen(false);
      setTemplateName("");
      setTemplateType("general");
      setTemplateDescription("");
      toast({
        title: "Template created",
        description: `Workspace template "${variables.name}" has been created successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to create template",
        description: error.message,
      });
    },
  });

  const handleCreateTemplate = () => {
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      toast({
        variant: "destructive",
        title: "Template name required",
        description: "Please enter a name for the template",
      });
      return;
    }
    createTemplateMutation.mutate({
      name: trimmedName,
      type: templateType,
      description: templateDescription.trim() || undefined,
    });
  };

  if (spaceLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading workspace...</p>
      </div>
    );
  }

  if (!space || !org) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg font-medium">Space not found</p>
      </div>
    );
  }

  const onlineParticipants = participants.filter((p) => p.isOnline);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-8 w-auto object-contain" />
            ) : (
              <img 
                src="/logos/synozur-horizontal-color.png" 
                alt="Synozur Alliance" 
                className="h-8 w-auto object-contain"
              />
            )}
            <div className="h-6 w-px bg-border/40" />
            <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Nebula
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAuthenticated && <UserProfileMenu />}
          </div>
        </div>
      </header>

      {/* Header Section */}
      <section className="border-b bg-gradient-to-br from-background via-primary/5 to-background">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight">{space.name}</h1>
              <p className="mt-2 text-base text-muted-foreground">{space.purpose}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Badge variant="outline" className="gap-1 font-mono" data-testid="badge-workspace-code">
                  Code: {space.code}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {onlineParticipants.length} online
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <StickyNote className="h-3 w-3" />
                  {notes.length} notes
                </Badge>
                <Badge variant={space.status === "open" ? "default" : "secondary"}>
                  {space.status}
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {space.status === "draft" && (
                <Button
                  onClick={() => updateSpaceStatusMutation.mutate("open")}
                  data-testid="button-start-session"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Start Session
                </Button>
              )}
              {space.status === "open" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => updateSpaceStatusMutation.mutate("draft")}
                    data-testid="button-pause-session"
                  >
                    <PauseCircle className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateSpaceStatusMutation.mutate("closed")}
                    data-testid="button-close-session"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Close Session
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                onClick={() => setIsTemplateDialogOpen(true)}
                data-testid="button-save-as-template"
              >
                <FileStack className="mr-2 h-4 w-4" />
                Save as Template
              </Button>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="notes" className="w-full">
          <TabsList>
            <TabsTrigger value="notes" data-testid="tab-notes">
              Notes ({notes.length})
            </TabsTrigger>
            <TabsTrigger value="participants" data-testid="tab-participants">
              Participants ({participants.length})
            </TabsTrigger>
            <TabsTrigger value="voting" data-testid="tab-voting">
              Voting ({votes.length})
            </TabsTrigger>
            <TabsTrigger value="ranking" data-testid="tab-ranking">
              <ListOrdered className="mr-2 h-4 w-4" />
              Ranking
            </TabsTrigger>
            <TabsTrigger value="marketplace" data-testid="tab-marketplace">
              <Coins className="mr-2 h-4 w-4" />
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="knowledge-base" data-testid="tab-knowledge-base">
              <BookOpen className="mr-2 h-4 w-4" />
              Knowledge Base
            </TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results">
              <Trophy className="mr-2 h-4 w-4" />
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-6 space-y-6">
            {/* Notes Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-notes"
                />
              </div>
              <div className="flex gap-2">
                {selectedNotes.size > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleBulkDelete}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete ({selectedNotes.size})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleMergeNotes}
                      data-testid="button-bulk-merge"
                    >
                      <Merge className="mr-2 h-4 w-4" />
                      Merge ({selectedNotes.size})
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => categorizeMutation.mutate()}
                  disabled={notes.length === 0 || categorizeMutation.isPending}
                  data-testid="button-ai-categorize"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {categorizeMutation.isPending ? "Categorizing..." : "AI Categorize"}
                </Button>
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" data-testid="button-create-category">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Category</DialogTitle>
                      <DialogDescription>
                        Create a new category for organizing notes manually
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="category-name">Category Name</Label>
                        <Input
                          id="category-name"
                          value={categoryName}
                          onChange={(e) => setCategoryName(e.target.value)}
                          placeholder="Enter category name"
                          data-testid="input-category-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category-color">Color</Label>
                        <Input
                          id="category-color"
                          type="color"
                          value={categoryColor}
                          onChange={(e) => setCategoryColor(e.target.value)}
                          data-testid="input-category-color"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() =>
                          createCategoryMutation.mutate({
                            name: categoryName,
                            color: categoryColor,
                          })
                        }
                        disabled={!categoryName.trim() || createCategoryMutation.isPending}
                        data-testid="button-submit-category"
                      >
                        {createCategoryMutation.isPending ? "Creating..." : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={isDataManagementDialogOpen} onOpenChange={setIsDataManagementDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" data-testid="button-manage-data">
                      <Download className="mr-2 h-4 w-4" />
                      Export/Import Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Manage Workspace Data</DialogTitle>
                      <DialogDescription>
                        Export or import ideas with their categories in a single CSV file
                      </DialogDescription>
                    </DialogHeader>
                    <Tabs value={dataManagementTab} onValueChange={(v) => setDataManagementTab(v as "export" | "import")} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="export" data-testid="tab-export">Export</TabsTrigger>
                        <TabsTrigger value="import" data-testid="tab-import">Import</TabsTrigger>
                      </TabsList>
                      <TabsContent value="export" className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Download all ideas and categories in a single CSV file. Categories are included with each idea.
                          </p>
                          <p className="text-sm font-medium">Format: Idea, Category, Participant, Created At</p>
                        </div>
                        <Button
                          onClick={() => {
                            window.location.href = `/api/spaces/${params.space}/export/data-csv`;
                            setIsDataManagementDialogOpen(false);
                          }}
                          className="w-full"
                          data-testid="button-download-csv"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download CSV File
                        </Button>
                      </TabsContent>
                      <TabsContent value="import" className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Upload a CSV file with ideas and categories. Categories will be automatically created if they don't exist.
                          </p>
                          <p className="text-sm font-medium">Required columns: Idea, Category, Participant, Created At</p>
                        </div>
                        <div className="space-y-4">
                          <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                importDataMutation.mutate(file);
                              }
                            }}
                            className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                            data-testid="input-import-data-file"
                          />
                          {importDataMutation.isPending && (
                            <p className="text-sm text-muted-foreground">Importing...</p>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
                <Dialog open={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-note">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Note
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Preload Note</DialogTitle>
                      <DialogDescription>
                        Add a note to the session before participants start brainstorming
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="note-content">Note Content</Label>
                        <Textarea
                          id="note-content"
                          placeholder="Enter note content..."
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          rows={4}
                          data-testid="textarea-note-content"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsAddNoteDialogOpen(false)}
                        data-testid="button-cancel-add-note"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => addNoteMutation.mutate(newNoteContent)}
                        disabled={!newNoteContent.trim() || addNoteMutation.isPending}
                        data-testid="button-save-note"
                      >
                        Add Note
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Merge Notes Dialog */}
                <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Merge {selectedNotes.size} Notes</DialogTitle>
                      <DialogDescription>
                        Combine the selected notes into a single note. Edit the merged content below.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="merged-content">Merged Content</Label>
                        <Textarea
                          id="merged-content"
                          value={mergedNoteContent}
                          onChange={(e) => setMergedNoteContent(e.target.value)}
                          rows={6}
                          data-testid="textarea-merged-content"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsMergeDialogOpen(false)}
                        data-testid="button-cancel-merge"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => mergeNotesMutation.mutate()}
                        disabled={!mergedNoteContent.trim() || mergeNotesMutation.isPending}
                        data-testid="button-save-merge"
                      >
                        Merge Notes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Save as Template Dialog */}
                <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Save Workspace as Template</DialogTitle>
                      <DialogDescription>
                        Create a reusable template with this workspace's notes and knowledge base documents.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="template-name">Template Name *</Label>
                        <Input
                          id="template-name"
                          placeholder="e.g., Company Values Ideation"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          data-testid="input-template-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-type">Template Type *</Label>
                        <select
                          id="template-type"
                          value={templateType}
                          onChange={(e) => setTemplateType(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid="select-template-type"
                        >
                          <option value="general">General</option>
                          <option value="values">Company Values</option>
                          <option value="vision">Vision & Strategy</option>
                          <option value="innovation">Innovation</option>
                          <option value="problem-solving">Problem Solving</option>
                          <option value="planning">Planning</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-description">Description (Optional)</Label>
                        <Textarea
                          id="template-description"
                          placeholder="Describe when and how to use this template..."
                          value={templateDescription}
                          onChange={(e) => setTemplateDescription(e.target.value)}
                          rows={3}
                          data-testid="textarea-template-description"
                        />
                      </div>
                      <div className="rounded-md bg-muted/50 p-4">
                        <p className="text-sm text-muted-foreground">
                          This template will include:
                        </p>
                        <ul className="mt-2 space-y-1 text-sm">
                          <li className="flex items-center gap-2">
                            <StickyNote className="h-3 w-3" />
                            {notes.length} note{notes.length !== 1 ? 's' : ''}
                          </li>
                          <li className="flex items-center gap-2">
                            <BookOpen className="h-3 w-3" />
                            Knowledge base documents for this workspace
                          </li>
                        </ul>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsTemplateDialogOpen(false)}
                        disabled={createTemplateMutation.isPending}
                        data-testid="button-cancel-template"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateTemplate}
                        disabled={!templateName.trim() || createTemplateMutation.isPending}
                        data-testid="button-save-template"
                      >
                        {createTemplateMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <FileStack className="mr-2 h-4 w-4" />
                            Create Template
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Notes List - Grouped by Category */}
            {notesLoading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <p className="text-muted-foreground">Loading notes...</p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
                <div className="text-center">
                  <StickyNote className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">
                    {searchQuery ? "No notes found" : "No notes yet"}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {searchQuery
                      ? "Try a different search term"
                      : "Preload notes or wait for participants to add ideas"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {categories.map((category) => (
                  <div key={category} className="space-y-3">
                    {/* Category Header */}
                    <div className="flex items-center gap-3">
                      <Badge className={`px-3 py-1 text-sm font-medium ${getCategoryColor(category)}`} data-testid={`badge-category-${category}`}>
                        {category === "No Category" ? (
                          category
                        ) : (
                          <>
                            {category}
                            {groupedNotes[category].some(n => n.isAiCategory) && (
                              <Sparkles className="ml-1 h-3 w-3 inline" />
                            )}
                          </>
                        )}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {groupedNotes[category].length} {groupedNotes[category].length === 1 ? "note" : "notes"}
                      </span>
                    </div>

                    {/* Notes Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {groupedNotes[category].map((note) => (
                        <Card
                          key={note.id}
                          className={`cursor-pointer transition-all hover-elevate ${
                            selectedNotes.has(note.id) ? "ring-2 ring-primary" : ""
                          }`}
                          onClick={() => toggleNoteSelection(note.id)}
                          data-testid={`note-card-${note.id}`}
                        >
                          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                            <CardTitle className="text-sm font-medium line-clamp-2">
                              {note.content}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditDialogNote(note);
                                  setEditNoteContent(note.content);
                                }}
                                data-testid={`button-edit-note-${note.id}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRewriteDialogNote(note);
                                  setRewriteVariations([]);
                                  rewriteNoteMutation.mutate({ noteId: note.id, count: 3 });
                                }}
                                disabled={rewriteNoteMutation.isPending}
                                data-testid={`button-rewrite-note-${note.id}`}
                              >
                                <Sparkles className="h-3 w-3 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNoteMutation.mutate(note.id);
                                }}
                                data-testid={`button-delete-note-${note.id}`}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateNoteVisibilityMutation.mutate({
                                    noteId: note.id,
                                    updates: { visibleInRanking: !note.visibleInRanking }
                                  });
                                }}
                                title={note.visibleInRanking ? "Hide from Ranking" : "Show in Ranking"}
                                data-testid={`button-toggle-ranking-visibility-${note.id}`}
                              >
                                {note.visibleInRanking ? (
                                  <Eye className="h-3 w-3 text-blue-500" />
                                ) : (
                                  <EyeOff className="h-3 w-3 text-muted-foreground" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateNoteVisibilityMutation.mutate({
                                    noteId: note.id,
                                    updates: { visibleInMarketplace: !note.visibleInMarketplace }
                                  });
                                }}
                                title={note.visibleInMarketplace ? "Hide from Marketplace" : "Show in Marketplace"}
                                data-testid={`button-toggle-marketplace-visibility-${note.id}`}
                              >
                                {note.visibleInMarketplace ? (
                                  <Coins className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Coins className="h-3 w-3 text-muted-foreground opacity-50" />
                                )}
                              </Button>
                            </div>
                            {manualCategories.length > 0 && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Select
                                  value={note.manualCategoryId || "none"}
                                  onValueChange={(value) => {
                                    updateNoteCategoryMutation.mutate({
                                      noteId: note.id,
                                      categoryId: value === "none" ? null : value,
                                    });
                                  }}
                                >
                                  <SelectTrigger
                                    className="h-8 text-xs"
                                    data-testid={`select-category-${note.id}`}
                                  >
                                    <SelectValue placeholder="Assign category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No Category</SelectItem>
                                    {manualCategories.map((cat) => (
                                      <SelectItem key={cat.id} value={cat.id}>
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: cat.color }}
                                          />
                                          {cat.name}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="participants" className="mt-6">
            {participants.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
                <div className="text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">No participants yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Waiting for participants to join the session
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {participants.map((participant) => (
                  <Card key={participant.id} data-testid={`participant-card-${participant.id}`}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            participant.isOnline ? "bg-green-500" : "bg-gray-300"
                          }`}
                        />
                        <CardTitle className="text-base">{participant.displayName}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Status: {participant.isOnline ? "Online" : "Offline"}</p>
                        <p>Type: {participant.isGuest ? "Guest" : "Registered"}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="voting" className="mt-6 space-y-6">
            {/* Voting Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Pairwise Voting</h2>
                <p className="text-muted-foreground mt-1">
                  Track participant voting progress
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={() => navigateParticipantsMutation.mutate("vote")}
                  data-testid="button-navigate-to-voting"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Send to Voting
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/api/spaces/${params.space}/export/pairwise`;
                  }}
                  data-testid="button-export-voting"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Results
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => window.open(`/o/${params.org}/s/${params.space}/vote`, '_blank')}
                  data-testid="button-test-voting"
                >
                  Test Voting View
                </Button>
              </div>
            </div>

            {/* Voting Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Voting Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label htmlFor="pairwise-scope">Comparison Scope</Label>
                  <Select
                    value={space?.pairwiseScope || "all"}
                    onValueChange={(value: "all" | "within_categories") => {
                      updatePairwiseScopeMutation.mutate(value);
                    }}
                    data-testid="select-pairwise-scope"
                  >
                    <SelectTrigger id="pairwise-scope" className="w-full md:w-[400px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="option-scope-all">
                        Compare all ideas (cross-category voting)
                      </SelectItem>
                      <SelectItem value="within_categories" data-testid="option-scope-within-categories">
                        Compare within categories only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {space?.pairwiseScope === "within_categories"
                      ? "Participants will only compare ideas within the same category"
                      : "Participants will compare all ideas regardless of category"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Voting Statistics */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Votes Cast</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{votes.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across all participants
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Possible Pairs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {notes.length >= 2 ? (notes.length * (notes.length - 1)) / 2 : 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {notes.length} notes to compare
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Active Voters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {new Set(votes.map((v: any) => v.participantId)).size}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Of {participants.length} participants
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Participant Voting Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Participant Progress</CardTitle>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No participants have joined yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {participants.map((participant) => {
                      const participantVotes = votes.filter((v: any) => v.participantId === participant.id);
                      const totalPairs = notes.length >= 2 ? (notes.length * (notes.length - 1)) / 2 : 0;
                      const progress = totalPairs > 0 ? Math.round((participantVotes.length / totalPairs) * 100) : 0;
                      const isComplete = participantVotes.length >= totalPairs && totalPairs > 0;

                      return (
                        <div key={participant.id} className="space-y-2" data-testid={`voting-progress-${participant.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  participant.isOnline ? "bg-green-500" : "bg-gray-300"
                                }`}
                              />
                              <span className="font-medium">{participant.displayName}</span>
                              {isComplete && (
                                <Badge variant="default" className="ml-2">Complete</Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {participantVotes.length} / {totalPairs} votes
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vote Winners Leaderboard */}
            {votes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Most Preferred Ideas</CardTitle>
                  <p className="text-sm text-muted-foreground">Based on pairwise comparisons</p>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Calculate win counts for each note
                    const winCounts = new Map<string, number>();
                    notes.forEach(note => winCounts.set(note.id, 0));
                    votes.forEach((vote: any) => {
                      const currentWins = winCounts.get(vote.winnerNoteId) || 0;
                      winCounts.set(vote.winnerNoteId, currentWins + 1);
                    });

                    // Sort notes by win count
                    const sortedNotes = [...notes]
                      .map(note => ({ note, wins: winCounts.get(note.id) || 0 }))
                      .sort((a, b) => b.wins - a.wins)
                      .slice(0, 10);

                    return (
                      <div className="space-y-3">
                        {sortedNotes.map(({ note, wins }, index) => (
                          <div key={note.id} className="flex items-start gap-3" data-testid={`leaderboard-item-${index}`}>
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm leading-relaxed">{note.content}</p>
                              {note.category && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  {note.category}
                                </Badge>
                              )}
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <div className="text-lg font-bold">{wins}</div>
                              <div className="text-xs text-muted-foreground">wins</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {votes.length === 0 && (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
                <div className="text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">No votes yet</p>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    Participants can start voting once they navigate to the voting page
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ranking" className="mt-6 space-y-6">
            {/* Ranking Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Stack Ranking</h2>
                <p className="text-muted-foreground mt-1">
                  Track participant ranking progress and view Borda count results
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={() => navigateParticipantsMutation.mutate("rank")}
                  data-testid="button-navigate-to-ranking"
                >
                  <ListOrdered className="mr-2 h-4 w-4" />
                  Send to Ranking
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/api/spaces/${params.space}/export/ranking`;
                  }}
                  data-testid="button-export-ranking"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Results
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => window.open(`/o/${params.org}/s/${params.space}/rank`, '_blank')}
                  data-testid="button-test-ranking"
                >
                  Test Ranking View
                </Button>
              </div>
            </div>

            {/* Ranking Statistics */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Participants Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {rankingProgress?.participantsCompleted || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Of {rankingProgress?.totalParticipants || participants.length} participants
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {rankingProgress?.percentComplete || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {rankingProgress?.participantsCompleted || 0} / {rankingProgress?.totalParticipants || participants.length} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Ideas to Rank</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {notes.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Notes available for ranking
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Borda Count Leaderboard</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ideas ranked by Borda count scoring (higher is better)
                  </p>
                </CardHeader>
                <CardContent>
                  <Leaderboard scores={leaderboard} />
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {leaderboard.length === 0 && (
              <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
                <div className="text-center">
                  <ListOrdered className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">No rankings yet</p>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    Participants can start ranking once they navigate to the ranking page
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="marketplace" className="mt-6 space-y-6">
            {/* Marketplace Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Marketplace Allocation</h2>
                <p className="text-muted-foreground mt-1">
                  Configure coin budget and send participants to marketplace voting
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={() => navigateParticipantsMutation.mutate("marketplace")}
                  data-testid="button-navigate-to-marketplace"
                >
                  <Coins className="mr-2 h-4 w-4" />
                  Send to Marketplace
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/api/spaces/${params.space}/export/marketplace`;
                  }}
                  data-testid="button-export-marketplace"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Results
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => window.open(`/o/${params.org}/s/${params.space}/marketplace`, '_blank')}
                  data-testid="button-test-marketplace"
                >
                  Test Marketplace View
                </Button>
              </div>
            </div>

            {/* Marketplace Coin Budget Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  Coin Budget Configuration
                </CardTitle>
                <CardDescription>
                  Configure how many coins each participant receives to allocate in the marketplace phase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label htmlFor="coin-budget" className="text-sm font-medium mb-2 block">
                      Coins per Participant
                    </label>
                    <input
                      id="coin-budget"
                      type="number"
                      min="1"
                      max="1000"
                      defaultValue={space.marketplaceCoinBudget}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      onBlur={(e) => {
                        const value = parseInt(e.target.value);
                        if (value && value !== space.marketplaceCoinBudget && value > 0 && value <= 1000) {
                          updateWorkspaceSettings.mutate({ marketplaceCoinBudget: value });
                        }
                      }}
                      data-testid="input-marketplace-coin-budget"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground mt-6">
                    Current: <Badge variant="outline">{space.marketplaceCoinBudget} coins</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Participants will use their coin budget to vote on ideas by allocating coins to their preferred options
                </p>
              </CardContent>
            </Card>

            {/* Empty State - Marketplace stats could be added here in the future */}
            <div className="flex min-h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
              <div className="text-center">
                <Coins className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">Marketplace Allocation</p>
                <p className="mt-2 text-sm text-muted-foreground max-w-md">
                  Send participants to the marketplace to allocate their {space.marketplaceCoinBudget} coins across ideas
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="knowledge-base" className="mt-6">
            <KnowledgeBaseManager
              scope="workspace"
              scopeId={space.id}
              title={`${space.name} Knowledge Base`}
              description="Upload documents specific to this workspace to help ground AI categorization and personalized results"
            />
          </TabsContent>

          <TabsContent value="results" className="mt-6 space-y-6">
            {cohortResultsLoading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading cohort results...</span>
                </div>
              </div>
            ) : !cohortResults ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Generate Cohort Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Generate AI-powered cohort results based on all voting data, rankings, and marketplace allocations.
                    This will create a comprehensive summary of the session's key themes, top ideas, and insights.
                  </p>
                  <Button
                    onClick={() => generateCohortResultsMutation.mutate()}
                    disabled={generateCohortResultsMutation.isPending}
                    size="lg"
                    data-testid="button-generate-cohort-results"
                  >
                    {generateCohortResultsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Results...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Cohort Results
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      Cohort Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <p className="whitespace-pre-wrap">{cohortResults.summary}</p>
                    </div>
                  </CardContent>
                </Card>

                {cohortResults.topIdeas && cohortResults.topIdeas.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Top Ideas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {cohortResults.topIdeas.map((idea: { rank: number; content: string; rationale: string }, index: number) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-start gap-3">
                            <Badge variant="outline" className="mt-1">
                              #{idea.rank}
                            </Badge>
                            <div className="flex-1">
                              <p className="font-medium">{idea.content}</p>
                              <p className="text-sm text-muted-foreground mt-1">{idea.rationale}</p>
                            </div>
                          </div>
                          {index < cohortResults.topIdeas.length - 1 && <div className="border-t" />}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {cohortResults.keyThemes && cohortResults.keyThemes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ListOrdered className="h-5 w-5 text-primary" />
                        Key Themes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {cohortResults.keyThemes.map((theme: string, index: number) => (
                          <Badge key={index} variant="secondary">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {cohortResults.insights && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Key Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <p className="whitespace-pre-wrap">{cohortResults.insights}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex flex-col gap-4">
                  {/* AI Results Toggle */}
                  <Card className="bg-muted/30">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI-Powered Personalized Results
                      </CardTitle>
                      <CardDescription>
                        Enable AI-generated personalized results for verified participants. Participants must be logged in and email verified to access their personalized insights.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Status: {space.aiResultsEnabled ? (
                            <Badge variant="default" className="ml-2">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary" className="ml-2">Disabled</Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Toggle AI results
                            updateWorkspaceSettings.mutate({ aiResultsEnabled: !space.aiResultsEnabled });
                          }}
                          disabled={updateWorkspaceSettings.isPending}
                          data-testid="button-toggle-ai-results"
                        >
                          {updateWorkspaceSettings.isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              {space.aiResultsEnabled ? "Disabling..." : "Enabling..."}
                            </>
                          ) : (
                            <>{space.aiResultsEnabled ? "Disable" : "Enable"} AI Results</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => generateCohortResultsMutation.mutate()}
                      disabled={generateCohortResultsMutation.isPending}
                      data-testid="button-regenerate-results"
                    >
                      {generateCohortResultsMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Regenerate Cohort Results
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Note Dialog */}
      <Dialog open={editDialogNote !== null} onOpenChange={(open) => !open && setEditDialogNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Make changes to the note content below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editNoteContent}
              onChange={(e) => setEditNoteContent(e.target.value)}
              rows={4}
              placeholder="Enter note content..."
              data-testid="input-edit-note-content"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogNote(null);
                setEditNoteContent("");
              }}
              data-testid="button-cancel-edit-note"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editDialogNote && editNoteContent.trim()) {
                  editNoteMutation.mutate({
                    noteId: editDialogNote.id,
                    content: editNoteContent.trim(),
                  });
                }
              }}
              disabled={editNoteMutation.isPending || !editNoteContent.trim()}
              data-testid="button-save-edit-note"
            >
              {editNoteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Rewrite Dialog */}
      <Dialog open={rewriteDialogNote !== null} onOpenChange={(open) => !open && setRewriteDialogNote(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Powered Rewrites
            </DialogTitle>
            <DialogDescription>
              Below are AI-generated variations of this card. Each maintains the same core meaning and category.
            </DialogDescription>
          </DialogHeader>

          {rewriteDialogNote && (
            <div className="space-y-4">
              {/* Original Note */}
              <div>
                <Label className="text-sm font-medium">Original</Label>
                <Card className="mt-2 bg-muted/20">
                  <CardContent className="pt-4">
                    <p className="text-sm">{rewriteDialogNote.content}</p>
                    {rewriteDialogNote.category && (
                      <Badge variant="secondary" className="mt-2">
                        {rewriteDialogNote.category}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* AI Variations */}
              <div>
                <Label className="text-sm font-medium">AI Variations</Label>
                {rewriteNoteMutation.isPending ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-3 text-sm text-muted-foreground">Generating variations...</p>
                  </div>
                ) : rewriteVariations.length > 0 ? (
                  <div className="mt-2 space-y-3">
                    {rewriteVariations.map((variation) => (
                      <Card key={variation.version} className="hover-elevate">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                          <CardTitle className="text-sm font-medium">
                            Version {variation.version}
                          </CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await apiRequest("PATCH", `/api/notes/${rewriteDialogNote.id}`, {
                                  content: variation.content,
                                });
                                queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
                                toast({
                                  title: "Note updated",
                                  description: "The note has been updated with the selected variation",
                                });
                                setRewriteDialogNote(null);
                              } catch (error) {
                                toast({
                                  variant: "destructive",
                                  title: "Failed to update note",
                                  description: error instanceof Error ? error.message : "Unknown error",
                                });
                              }
                            }}
                            data-testid={`button-use-variation-${variation.version}`}
                          >
                            Use This
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm">{variation.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">No variations available</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRewriteDialogNote(null)} data-testid="button-close-rewrite-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
