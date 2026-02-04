import { useState, useCallback, useEffect, useMemo } from "react";
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
  Lock,
  Unlock,
  ClipboardList,
  FolderPlus,
  Settings,
  Grid3x3,
  TrendingUp,
  Share2,
  Copy,
  ExternalLink,
  Target,
} from "lucide-react";
import type { Organization, Space, Note, Participant, Category, User, Idea, WorkspaceModule } from "@shared/schema";
import { Leaderboard } from "@/components/Leaderboard";
import { KnowledgeBaseManager } from "@/components/KnowledgeBaseManager";
import { ShareLinksDialog } from "@/components/ShareLinksDialog";
import { SurveyQuestionsManager } from "@/components/SurveyQuestionsManager";
import { SurveyResultsGrid } from "@/components/SurveyResultsGrid";
import { generateCohortResultsPDF } from "@/lib/pdfGenerator";
import IdeasHub from "@/components/IdeasHub";
import ModuleConfiguration from "@/components/ModuleConfiguration";
import PriorityMatrix from "@/components/PriorityMatrix";
import StaircaseModule from "@/components/StaircaseModule";
import { NotificationPanel } from "@/components/NotificationPanel";
import { CountdownTimer } from "@/components/CountdownTimer";
import { isPhaseActive } from "@/lib/phaseUtils";

// Comprehensive Results Table Component
function ComprehensiveResultsTable({
  notes,
  votes,
  bordaLeaderboard,
  marketplaceLeaderboard,
  categories,
}: {
  notes: Note[];
  votes: any[];
  bordaLeaderboard: any[];
  marketplaceLeaderboard: any[];
  categories: Category[];
}) {
  const [sortBy, setSortBy] = useState<'pairwise' | 'borda' | 'marketplace' | 'idea'>('pairwise');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Create category map
  const categoryMap = new Map<string, string>();
  categories.forEach(cat => {
    categoryMap.set(cat.id, cat.name);
  });

  // Calculate pairwise wins and total votes per note
  const pairwiseStats = new Map<string, { wins: number; total: number }>();
  notes.forEach(note => {
    pairwiseStats.set(note.id, { wins: 0, total: 0 });
  });
  
  votes.forEach((vote: any) => {
    const winnerStats = pairwiseStats.get(vote.winnerNoteId);
    const loserStats = pairwiseStats.get(vote.loserNoteId);
    
    if (winnerStats) {
      winnerStats.wins += 1;
      winnerStats.total += 1;
    }
    if (loserStats) {
      loserStats.total += 1;
    }
  });

  // Create Borda score map
  const bordaMap = new Map<string, number>();
  bordaLeaderboard.forEach((item: any) => {
    // Backend returns totalScore as the Borda count score
    bordaMap.set(item.noteId, item.totalScore || item.averageBordaScore || item.bordaScore || 0);
  });

  // Create marketplace coins map
  const marketplaceMap = new Map<string, number>();
  marketplaceLeaderboard.forEach((item: any) => {
    marketplaceMap.set(item.noteId, item.totalCoins || 0);
  });

  // Combine all data
  const combinedData = notes.map(note => {
    const pairwise = pairwiseStats.get(note.id) || { wins: 0, total: 0 };
    const winRate = pairwise.total > 0 ? (pairwise.wins / pairwise.total) * 100 : 0;
    
    return {
      id: note.id,
      content: note.content,
      category: note.manualCategoryId ? categoryMap.get(note.manualCategoryId) || 'Uncategorized' : 'Uncategorized',
      pairwiseWins: pairwise.wins,
      pairwiseTotal: pairwise.total,
      winRate,
      bordaScore: bordaMap.get(note.id) || 0,
      marketplaceCoins: marketplaceMap.get(note.id) || 0,
    };
  });

  // Sort data
  const sortedData = [...combinedData].sort((a, b) => {
    let compareValue = 0;
    
    switch (sortBy) {
      case 'pairwise':
        compareValue = a.winRate - b.winRate;
        break;
      case 'borda':
        compareValue = a.bordaScore - b.bordaScore;
        break;
      case 'marketplace':
        compareValue = a.marketplaceCoins - b.marketplaceCoins;
        break;
      case 'idea':
        compareValue = a.content.localeCompare(b.content);
        break;
    }
    
    return sortDirection === 'desc' ? -compareValue : compareValue;
  });

  const handleSort = (column: 'pairwise' | 'borda' | 'marketplace' | 'idea') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No ideas yet. Add some ideas to see voting results.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3 font-semibold">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('idea')}
                  className="hover-elevate -ml-3"
                  data-testid="button-sort-idea"
                >
                  Idea {sortBy === 'idea' && (sortDirection === 'desc' ? '↓' : '↑')}
                </Button>
              </th>
              <th className="text-left p-3 font-semibold">Category</th>
              <th className="text-right p-3 font-semibold">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('pairwise')}
                  className="hover-elevate"
                  data-testid="button-sort-pairwise"
                >
                  Pairwise {sortBy === 'pairwise' && (sortDirection === 'desc' ? '↓' : '↑')}
                </Button>
              </th>
              <th className="text-right p-3 font-semibold">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('borda')}
                  className="hover-elevate"
                  data-testid="button-sort-borda"
                >
                  Borda Score {sortBy === 'borda' && (sortDirection === 'desc' ? '↓' : '↑')}
                </Button>
              </th>
              <th className="text-right p-3 font-semibold">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('marketplace')}
                  className="hover-elevate"
                  data-testid="button-sort-marketplace"
                >
                  Marketplace Coins {sortBy === 'marketplace' && (sortDirection === 'desc' ? '↓' : '↑')}
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, index) => (
              <tr
                key={item.id}
                className="border-b hover-elevate"
                data-testid={`results-row-${index}`}
              >
                <td className="p-3 max-w-md">
                  <p className="text-sm">{item.content}</p>
                </td>
                <td className="p-3">
                  <Badge variant="secondary">{item.category}</Badge>
                </td>
                <td className="p-3 text-right">
                  <div className="text-sm">
                    <div className="font-semibold">
                      {item.pairwiseWins}W / {item.pairwiseTotal - item.pairwiseWins}L
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.pairwiseTotal > 0 ? `${item.winRate.toFixed(0)}% (${item.pairwiseTotal} matchups)` : 'No votes yet'}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-right">
                  <div className="text-sm font-semibold">
                    {item.bordaScore.toFixed(1)}
                  </div>
                </td>
                <td className="p-3 text-right">
                  <div className="text-sm font-semibold">
                    {item.marketplaceCoins}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Showing {sortedData.length} ideas with results from all voting modalities. Click column headers to sort.
      </div>
    </div>
  );
}

export default function FacilitatorWorkspace() {
  const params = useParams() as { org: string; space: string };
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteCategoryId, setNewNoteCategoryId] = useState<string | null>(null);
  const [mergedNoteContent, setMergedNoteContent] = useState("");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
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
      case 'module_configured':
      case 'module_updated':
        // Invalidate modules query to refetch and update tabs
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/modules`] });
        console.log('[FacilitatorWorkspace] Module configuration updated, invalidating modules query');
        break;
      case 'vote_recorded':
        // Real-time vote updates for facilitator
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/votes`] });
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/voting-stats`] });
        console.log('[FacilitatorWorkspace] Vote recorded, refreshing voting data');
        break;
      case 'ranking_updated':
        // Real-time ranking updates
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/stack-ranking-leaderboard`] });
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/ranking-progress`] });
        break;
      case 'allocation_updated':
        // Real-time marketplace allocation updates
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/marketplace-leaderboard`] });
        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/marketplace-progress`] });
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

  // Fetch current user
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    enabled: isAuthenticated,
  });

  // Fetch organization
  const { data: org } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  // Fetch space
  const { data: space, isLoading: spaceLoading } = useQuery<Space>({
    queryKey: [`/api/spaces/${params.space}`],
  });

  // Set page title dynamically
  useEffect(() => {
    if (org && space) {
      document.title = `Nebula - ${org.name} ${space.name} | The Synozur Alliance`;
    } else {
      document.title = "Nebula - Facilitator Workspace | The Synozur Alliance";
    }
  }, [org, space]);

  // Authentication guard - redirect to login if not authenticated
  // Only redirect after auth check is complete (not loading) and user is definitely not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Fetch notes
  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: [`/api/spaces/${params.space}/notes`],
    enabled: !!params.space,
  });

  // Fetch ideas
  const { data: ideas = [] } = useQuery<Idea[]>({
    queryKey: [`/api/spaces/${params.space}/ideas`],
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

  // Fetch marketplace leaderboard
  const { data: marketplaceLeaderboard = [] } = useQuery<any[]>({
    queryKey: [`/api/spaces/${params.space}/marketplace-leaderboard`],
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

  // Fetch workspace modules for dynamic tab ordering
  const { data: workspaceModules = [] } = useQuery<WorkspaceModule[]>({
    queryKey: [`/api/spaces/${params.space}/modules`],
    enabled: !!params.space,
  });

  // Tab configuration type
  type TabConfig = {
    value: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    count?: number;
  };

  // Build facilitator tabs in journey sequence
  const facilitatorTabs = useMemo((): TabConfig[] => {
    // Fixed tabs: Modules → Ideas Hub → Knowledge Base (if needed) → Participants
    const baseTabs: TabConfig[] = [
      { value: "modules", label: "Modules", icon: Settings },
      { value: "ideas", label: "Ideas Hub", icon: FolderPlus },
      { value: "knowledge-base", label: "Knowledge Base", icon: BookOpen },
      { value: "participants", label: "Participants", count: participants.length },
    ];

    // Get enabled modules sorted by orderIndex
    const enabledModules = workspaceModules
      .filter(m => m.enabled)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    // Map module types to tab configs
    const moduleTabs: TabConfig[] = enabledModules
      .map((module): TabConfig | null => {
        switch (module.moduleType) {
          case "priority-matrix":
            return { value: "priority-matrix", label: "Priority Matrix", icon: Grid3x3 };
          case "staircase":
            return { value: "staircase", label: "Staircase", icon: TrendingUp };
          case "survey":
            return { value: "survey", label: "Survey", icon: ClipboardList };
          case "pairwise-voting":
            return { value: "voting", label: "Voting", count: votes.length };
          case "stack-ranking":
            return { value: "ranking", label: "Ranking", icon: ListOrdered };
          case "marketplace":
            return { value: "marketplace", label: "Marketplace", icon: Coins };
          default:
            return null;
        }
      })
      .filter((tab: TabConfig | null): tab is TabConfig => tab !== null);

    // Results tab (always last)
    const resultsTabs: TabConfig[] = [
      { value: "results", label: "Results", icon: Trophy },
    ];

    return [...baseTabs, ...moduleTabs, ...resultsTabs];
  }, [workspaceModules, participants.length, votes.length]);

  // Helper to check if a tab should be rendered
  const isTabEnabled = useCallback((tabValue: string) => {
    return facilitatorTabs.some(t => t.value === tabValue);
  }, [facilitatorTabs]);

  // Active tab state with fallback logic
  const [activeTab, setActiveTab] = useState<string>("modules");

  // Fallback to first tab if current tab becomes unavailable
  useEffect(() => {
    const availableTabValues = facilitatorTabs.map(t => t.value);
    if (!availableTabValues.includes(activeTab) && facilitatorTabs.length > 0) {
      setActiveTab(facilitatorTabs[0].value);
    }
  }, [facilitatorTabs, activeTab]);

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

  // Download cohort results as branded PDF
  const handleDownloadCohortPDF = async () => {
    if (!cohortResults || !space || !org) {
      toast({
        variant: "destructive",
        title: "Cannot download PDF",
        description: "Results, workspace, or organization data not available",
      });
      return;
    }

    try {
      await generateCohortResultsPDF(
        cohortResults,
        {
          orgName: org.name,
          orgLogo: org.logoUrl || undefined,
          primaryColor: org.primaryColor || undefined,
        },
        space.name
      );
      toast({
        title: "PDF Downloaded",
        description: "Branded cohort results PDF has been downloaded successfully",
      });
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast({
        variant: "destructive",
        title: "Failed to generate PDF",
        description: "Please try again later",
      });
    }
  };

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
    mutationFn: async (phase: "vote" | "rank" | "marketplace" | "ideate" | "results" | "priority-matrix" | "staircase" | "survey") => {
      const response = await apiRequest("POST", `/api/spaces/${params.space}/navigate-participants`, {
        phase,
      });
      return await response.json();
    },
    onSuccess: (_, phase) => {
      toast({
        title: "Participants Navigated",
        description: `All participants have been directed to the ${phase} ${phase === 'results' ? 'page' : 'phase'}`,
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
    mutationFn: async (settings: { aiResultsEnabled?: boolean; marketplaceCoinBudget?: number; resultsPublicAfterClose?: boolean }) => {
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
      } else if (variables.resultsPublicAfterClose !== undefined) {
        description = variables.resultsPublicAfterClose
          ? "Results will remain accessible after workspace is closed"
          : "Results will be hidden once workspace is closed";
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
    mutationFn: async ({ content, categoryId }: { content: string; categoryId?: string | null }) => {
      // Always use or create a dedicated "Facilitator" participant for facilitator-created notes
      // This ensures proper attribution instead of using other participants
      let facilitatorParticipantId = participants.find(p => p.displayName === "Facilitator")?.id;
      
      // If no Facilitator participant exists, create one
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
        manualCategoryId: categoryId || null,
        isAiCategory: false,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/notes`] });
      setIsAddNoteDialogOpen(false);
      setNewNoteContent("");
      setNewNoteCategoryId(null);
      toast({
        title: "Note added",
        description: "The note has been added successfully",
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
        
        // Check if ideation timer is enabled in module config
        const ideationModule = workspaceModules.find(m => m.moduleType === 'ideation');
        const ideationConfig = ideationModule?.config as { timerEnabled?: boolean; timerDurationMinutes?: number } | undefined;
        
        updates.ideationStartsAt = now.toISOString();
        
        if (ideationConfig?.timerEnabled && ideationConfig?.timerDurationMinutes) {
          // Set end time based on configured duration
          const timerEndTime = new Date(now.getTime() + ideationConfig.timerDurationMinutes * 60 * 1000);
          updates.ideationEndsAt = timerEndTime.toISOString();
        } else {
          // No timer - use far future as default
          const farFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          updates.ideationEndsAt = farFuture.toISOString();
        }
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
      // Always use or create a dedicated "Facilitator" participant for merged notes
      let facilitatorParticipantId = participants.find(p => p.displayName === "Facilitator")?.id;
      
      // If no Facilitator participant exists, create one
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

  // Mark workspace as template mutation (new simplified system)
  const markAsTemplateMutation = useMutation({
    mutationFn: async (templateScope: 'system' | 'organization') => {
      const response = await apiRequest("POST", `/api/workspaces/${params.space}/mark-as-template`, {
        templateScope
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark as template");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      setIsTemplateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/templates/spaces"] });
      toast({
        title: "Template snapshot created",
        description: `A frozen copy "${data.name}" has been saved as a template. Your original workspace remains unchanged.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to mark as template",
        description: error.message,
      });
    },
  });

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

  // Helper render functions for tabs (placed after space null check)
  const renderModulesTab = () => (
    <ModuleConfiguration spaceId={space.id} />
  );

  const renderIdeasTab = () => (
    <IdeasHub spaceId={space.id} categories={manualCategories} />
  );

  const renderKnowledgeBaseTab = () => (
    <KnowledgeBaseManager 
      scope="workspace" 
      scopeId={space.id}
      title="Workspace Knowledge Base"
      description="Documents available to AI for this workspace"
    />
  );

  const renderParticipantsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Participants</h2>
          <p className="text-muted-foreground mt-1">
            {participants.length} participant{participants.length !== 1 ? 's' : ''} in this workspace
          </p>
        </div>
      </div>

      <NotificationPanel 
        spaceId={space.id} 
        participants={participants}
        currentPhase={space.status || undefined}
      />

      {participants.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {participants.map(participant => (
            <Card key={participant.id} className="hover-elevate">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{participant.displayName}</span>
                  {participant.isOnline && (
                    <Badge variant="default" className="ml-2">Online</Badge>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {participant.isGuest && (
                    <Badge variant="secondary">Guest</Badge>
                  )}
                  {participant.email && (
                    <span className="text-xs text-muted-foreground truncate">{participant.email}</span>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No participants yet
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderPriorityMatrixTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">2x2 Priority Matrix</h2>
          <p className="text-muted-foreground mt-1">
            Collaborative drag-and-drop grid for positioning ideas
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              navigateParticipantsMutation.mutate("ideate");
              setActiveTab("ideas");
            }}
            disabled={navigateParticipantsMutation.isPending}
            data-testid="button-matrix-return-to-ideation"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Ideation
          </Button>
          <Button
            variant="default"
            onClick={() => navigateParticipantsMutation.mutate("priority-matrix")}
            disabled={navigateParticipantsMutation.isPending}
            data-testid="button-navigate-to-priority-matrix"
          >
            <Users className="mr-2 h-4 w-4" />
            Bring Participants Here
          </Button>
        </div>
      </div>
      <PriorityMatrix spaceId={space.id} />
    </div>
  );

  const renderStaircaseTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Staircase Rating</h2>
          <p className="text-muted-foreground mt-1">
            Diagonal 0-10 scale for visual idea assessment
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              navigateParticipantsMutation.mutate("ideate");
              setActiveTab("ideas");
            }}
            disabled={navigateParticipantsMutation.isPending}
            data-testid="button-return-to-ideation"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Ideation
          </Button>
          <Button
            variant="default"
            onClick={() => navigateParticipantsMutation.mutate("staircase")}
            disabled={navigateParticipantsMutation.isPending}
            data-testid="button-navigate-to-staircase"
          >
            <Users className="mr-2 h-4 w-4" />
            Bring Participants Here
          </Button>
        </div>
      </div>
      <StaircaseModule spaceId={space.id} />
    </div>
  );

  const renderSurveyTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Survey</h2>
          <p className="text-muted-foreground mt-1">
            Create questions and view participant responses
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              navigateParticipantsMutation.mutate("ideate");
              setActiveTab("ideas");
            }}
            disabled={navigateParticipantsMutation.isPending}
            data-testid="button-survey-return-to-ideation"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Ideation
          </Button>
          <Button
            variant="default"
            onClick={() => navigateParticipantsMutation.mutate("survey")}
            disabled={navigateParticipantsMutation.isPending}
            data-testid="button-navigate-to-survey"
          >
            <Users className="mr-2 h-4 w-4" />
            Bring Participants Here
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.open(`/o/${params.org}/s/${params.space}/survey`, '_blank')}
            data-testid="button-test-survey"
          >
            Test Survey View
          </Button>
        </div>
      </div>
      <SurveyQuestionsManager spaceId={space.id} />
      <SurveyResultsGrid spaceId={space.id} />
    </div>
  );

  const renderVotingTab = () => (
    <div className="space-y-6">
      {/* Voting Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pairwise Voting</h2>
          <p className="text-muted-foreground mt-1">
            Track participant voting progress
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setIsAddNoteDialogOpen(true)}
            data-testid="button-add-note-voting"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Note
          </Button>
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
    </div>
  );

  const renderRankingTab = () => (
    <div className="space-y-6">
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
    </div>
  );

  const renderMarketplaceTab = () => (
    <div className="space-y-6">
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
    </div>
  );

  const renderResultsTab = () => (
    <div className="space-y-6">
      {/* Module Header - matches pattern of other modules */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">Results</h2>
          <p className="text-muted-foreground mt-1">
            View comprehensive results, generate AI summaries, and share with participants
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              navigateParticipantsMutation.mutate("ideate");
              setActiveTab("ideas");
            }}
            disabled={navigateParticipantsMutation.isPending}
            data-testid="button-results-return-to-ideation"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to Ideation
          </Button>
          <Button
            variant="default"
            onClick={() => navigateParticipantsMutation.mutate("results")}
            disabled={navigateParticipantsMutation.isPending}
            data-testid="button-navigate-to-results"
          >
            <Users className="mr-2 h-4 w-4" />
            Bring Participants Here
          </Button>
        </div>
      </div>

      {/* Comprehensive Voting Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Comprehensive Voting Results
          </CardTitle>
          <CardDescription>
            All ideas with results from pairwise voting, stack ranking (Borda count), and marketplace allocation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ComprehensiveResultsTable
            notes={notes}
            votes={votes}
            bordaLeaderboard={leaderboard}
            marketplaceLeaderboard={marketplaceLeaderboard}
            categories={manualCategories}
          />
        </CardContent>
      </Card>

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
          {/* Share Results Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Share Results Publicly
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Share a public link to results - no login required
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `${window.location.origin}/o/${params.org}/s/${params.space}/public-results`;
                      navigator.clipboard.writeText(url);
                      toast({
                        title: "Link Copied!",
                        description: "Public results link copied to clipboard",
                      });
                    }}
                    data-testid="button-copy-public-results-link"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => window.open(`/o/${params.org}/s/${params.space}/public-results`, '_blank')}
                    data-testid="button-view-public-results"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Public Page
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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

          {cohortResults.recommendations && (
            <Card data-testid="card-cohort-recommendations">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Recommendations
                </CardTitle>
                <CardDescription>Suggested next steps based on the results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert space-y-4" data-testid="recommendations-content">
                  {cohortResults.recommendations.split(/\n\n+/).filter((p: string) => p.trim()).map((paragraph: string, index: number) => (
                    <p key={index} className="whitespace-pre-wrap leading-relaxed" data-testid={`recommendation-item-${index}`}>
                      {paragraph.trim()}
                    </p>
                  ))}
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

            {/* Results Public After Close Toggle */}
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {space.resultsPublicAfterClose ? (
                    <Unlock className="h-4 w-4 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                  Results Access After Workspace Closure
                </CardTitle>
                <CardDescription>
                  When enabled, participants can still view results even after the workspace is closed. When disabled, results become inaccessible once the workspace closes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Status: {space.resultsPublicAfterClose ? (
                      <Badge variant="default" className="ml-2">Accessible</Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-2">Restricted</Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateWorkspaceSettings.mutate({ resultsPublicAfterClose: !space.resultsPublicAfterClose });
                    }}
                    disabled={updateWorkspaceSettings.isPending}
                    data-testid="button-toggle-results-public-after-close"
                  >
                    {updateWorkspaceSettings.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        {space.resultsPublicAfterClose ? "Restricting..." : "Allowing..."}
                      </>
                    ) : (
                      <>{space.resultsPublicAfterClose ? "Restrict Access" : "Allow Access"}</>
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
              <Button
                variant="outline"
                onClick={handleDownloadCohortPDF}
                data-testid="button-download-cohort-pdf"
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Create map of render functions
  const tabContentByValue: Record<string, () => React.ReactNode> = {
    "modules": renderModulesTab,
    "ideas": renderIdeasTab,
    "knowledge-base": renderKnowledgeBaseTab,
    "participants": renderParticipantsTab,
    "priority-matrix": renderPriorityMatrixTab,
    "staircase": renderStaircaseTab,
    "survey": renderSurveyTab,
    "voting": renderVotingTab,
    "ranking": renderRankingTab,
    "marketplace": renderMarketplaceTab,
    "results": renderResultsTab,
  };

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
                <Badge variant="outline" className="gap-1 font-mono text-[18px]" data-testid="badge-workspace-code">
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
                {/* Ideation Timer - show when timer is enabled and ideation is active */}
                {space.status === "open" && (() => {
                  const ideationModule = workspaceModules.find(m => m.moduleType === 'ideation');
                  const ideationConfig = ideationModule?.config as { timerEnabled?: boolean; timerDurationMinutes?: number } | undefined;
                  const isIdeationActive = isPhaseActive(space, "ideation");
                  
                  return isIdeationActive && ideationConfig?.timerEnabled && space.ideationEndsAt ? (
                    <CountdownTimer
                      endTime={space.ideationEndsAt}
                      size="md"
                      onExpire={() => {
                        toast({
                          title: "Ideation Timer Ended",
                          description: "The ideation phase timer has expired.",
                        });
                        queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}`] });
                      }}
                    />
                  ) : null;
                })()}
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
              {space.status === "closed" && (
                <Button
                  onClick={() => updateSpaceStatusMutation.mutate("open")}
                  data-testid="button-reopen-session"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Reopen Session
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => setIsTemplateDialogOpen(true)}
                data-testid="button-save-as-template"
              >
                <FileStack className="mr-2 h-4 w-4" />
                Save as Template
              </Button>
              <ShareLinksDialog
                orgSlug={params.org}
                spaceCode={params.space}
              />
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            {facilitatorTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value} 
                  data-testid={`tab-${tab.value}`}
                >
                  {Icon && <Icon className="mr-2 h-4 w-4" />}
                  {tab.label}
                  {tab.count !== undefined && ` (${tab.count})`}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {facilitatorTabs.map(tab => (
            <TabsContent key={tab.value} value={tab.value} className="mt-6">
              {tabContentByValue[tab.value]?.() || (
                <div className="text-center text-muted-foreground py-8">
                  Tab content not available: {tab.value}
                </div>
              )}
            </TabsContent>
          ))}
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

      {/* Add Note Dialog */}
      <Dialog open={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Create a new note that will appear on participant boards and in voting modules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              rows={4}
              placeholder="Enter note content..."
              data-testid="input-add-note-content"
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Category (optional)</label>
              <Select
                value={newNoteCategoryId || "__none__"}
                onValueChange={(value) => setNewNoteCategoryId(value === "__none__" ? null : value)}
              >
                <SelectTrigger data-testid="select-add-note-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No category</SelectItem>
                  {manualCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddNoteDialogOpen(false);
                setNewNoteContent("");
                setNewNoteCategoryId(null);
              }}
              data-testid="button-cancel-add-note"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newNoteContent.trim()) {
                  addNoteMutation.mutate({
                    content: newNoteContent.trim(),
                    categoryId: newNoteCategoryId,
                  });
                }
              }}
              disabled={addNoteMutation.isPending || !newNoteContent.trim()}
              data-testid="button-save-add-note"
            >
              {addNoteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Note"
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