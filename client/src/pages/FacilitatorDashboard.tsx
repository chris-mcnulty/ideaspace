import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, StickyNote, ArrowRight, Plus, FolderKanban, FolderPlus, ChevronDown, ChevronRight, Building2, User, Archive, ArchiveRestore, UserCheck, UserX, Copy, Share2, X, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { QueryErrorState } from "@/components/QueryErrorState";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NewWorkspaceDialog } from "@/components/NewWorkspaceDialog";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { DuplicateWorkspaceModal } from "@/components/DuplicateWorkspaceModal";
import { SynozurAppSwitcher } from "@/components/SynozurAppSwitcher";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface WorkspaceWithStats {
  id: string;
  name: string;
  description: string | null;
  code: string;
  status: string;
  hidden: boolean;
  guestAllowed: boolean;
  organizationId: string;
  projectId: string | null;
  createdBy: string | null;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isDefault: boolean;
  } | null;
  stats: {
    participantCount: number;
    noteCount: number;
  };
}

interface GroupedWorkspaces {
  orgId: string;
  orgName: string;
  orgSlug: string;
  projects: {
    projectId: string | null;
    projectName: string;
    isDefault: boolean;
    workspaces: WorkspaceWithStats[];
  }[];
}

interface OrganizationWithCounts {
  id: string;
  name: string;
  slug: string;
  projectCount: number;
  workspaceCount: number;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isDefault: boolean;
  organizationId: string;
}

export default function FacilitatorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const selectedOrgId = new URLSearchParams(search).get("org");

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newProjectDialog, setNewProjectDialog] = useState<{
    open: boolean;
    orgId: string;
    orgName: string;
  }>({ open: false, orgId: "", orgName: "" });
  const [duplicateModal, setDuplicateModal] = useState<{
    open: boolean;
    workspaceId: string;
    workspaceName: string;
  }>({ open: false, workspaceId: "", workspaceName: "" });

  const [shareProject, setShareProject] = useState<{
    projectId: string;
    projectName: string;
    orgId: string;
  } | null>(null);

  useEffect(() => {
    document.title = "Nebula - Dashboard | The Synozur Alliance";
  }, []);

  const { data: organizations } = useQuery<OrganizationWithCounts[]>({
    queryKey: ["/api/my-organizations"],
    enabled: !!user,
  });

  const workspacesQueryKey = `/api/my-workspaces${showArchived ? "?showArchived=true" : ""}`;
  const { data: workspaces, isLoading, error: workspacesError, refetch: refetchWorkspaces, isFetching: isRefetchingWorkspaces } = useQuery<WorkspaceWithStats[]>({
    queryKey: [workspacesQueryKey],
    enabled: !!user,
  });

  const archiveMutation = useMutation({
    mutationFn: ({ workspaceId, hidden }: { workspaceId: string; hidden: boolean }) =>
      apiRequest("PATCH", `/api/spaces/${workspaceId}`, { hidden }),
    onSuccess: (_data, { hidden }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-workspaces?showArchived=true"] });
      toast({ title: hidden ? "Workspace archived" : "Workspace restored", description: hidden ? "It's hidden from the default view." : "It's visible again in your dashboard." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update workspace" }),
  });

  const guestToggleMutation = useMutation({
    mutationFn: ({ workspaceId, guestAllowed }: { workspaceId: string; guestAllowed: boolean }) =>
      apiRequest("PATCH", `/api/spaces/${workspaceId}`, { guestAllowed }),
    onSuccess: (_data, { guestAllowed }) => {
      queryClient.invalidateQueries({ queryKey: [workspacesQueryKey] });
      toast({ title: guestAllowed ? "Guest access enabled" : "Guest access disabled", description: guestAllowed ? "Anyone with the code can join anonymously." : "Only registered participants can join." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update guest access" }),
  });

  const { data: allProjects } = useQuery<Project[]>({
    queryKey: ["/api/organizations", selectedOrgId, "projects"],
    enabled: !!user && !!selectedOrgId,
  });

  const handleOrgChange = useCallback((orgId: string | null) => {
    const params = new URLSearchParams(search);
    if (orgId) {
      params.set("org", orgId);
    } else {
      params.delete("org");
    }
    const qs = params.toString();
    setLocation(qs ? `/dashboard?${qs}` : "/dashboard");
  }, [search, setLocation]);

  const groupedWorkspaces = useMemo(() => {
    if (!workspaces) return [];

    // Filter workspaces by selected org and "created by me" if enabled
    let filteredWorkspaces = selectedOrgId 
      ? workspaces.filter(w => w.organizationId === selectedOrgId)
      : workspaces;
    
    if (showOnlyMine && user) {
      filteredWorkspaces = filteredWorkspaces.filter(w => w.createdBy === user.id);
    }

    const orgMap = new Map<string, GroupedWorkspaces>();

    // If a specific org is selected and we have projects data, initialize with all projects
    if (selectedOrgId && allProjects && organizations) {
      const selectedOrg = organizations.find(o => o.id === selectedOrgId);
      if (selectedOrg) {
        orgMap.set(selectedOrgId, {
          orgId: selectedOrgId,
          orgName: selectedOrg.name,
          orgSlug: selectedOrg.slug,
          projects: allProjects.map(project => ({
            projectId: project.id,
            projectName: project.name,
            isDefault: project.isDefault,
            workspaces: [],
          })),
        });
      }
    }

    for (const workspace of filteredWorkspaces) {
      const orgId = workspace.organizationId;
      
      if (!orgMap.has(orgId)) {
        orgMap.set(orgId, {
          orgId,
          orgName: workspace.organization.name,
          orgSlug: workspace.organization.slug,
          projects: [],
        });
      }

      const org = orgMap.get(orgId)!;
      const projectId = workspace.projectId || "no-project";
      const projectName = workspace.project?.name || "Unassigned";
      const isDefault = workspace.project?.isDefault || false;

      let projectGroup = org.projects.find(p => (p.projectId || "no-project") === projectId);
      if (!projectGroup) {
        projectGroup = {
          projectId: workspace.projectId,
          projectName,
          isDefault,
          workspaces: [],
        };
        org.projects.push(projectGroup);
      }

      projectGroup.workspaces.push(workspace);
    }

    const result = Array.from(orgMap.values());
    
    for (const org of result) {
      org.projects.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.projectName.localeCompare(b.projectName);
      });
    }

    return result.sort((a, b) => a.orgName.localeCompare(b.orgName));
  }, [workspaces, selectedOrgId, allProjects, organizations, showOnlyMine, user]);

  useEffect(() => {
    if (groupedWorkspaces.length > 0 && expandedProjects.size === 0) {
      const allProjectIds = new Set<string>();
      for (const org of groupedWorkspaces) {
        for (const project of org.projects) {
          allProjectIds.add(`${org.orgId}-${project.projectId || "no-project"}`);
        }
      }
      setExpandedProjects(allProjectIds);
    }
  }, [groupedWorkspaces]);

  const toggleProject = (orgId: string, projectId: string | null) => {
    const key = `${orgId}-${projectId || "no-project"}`;
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "paused":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "closed":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground" data-testid="text-no-user">Please log in to view your workspaces</p>
      </div>
    );
  }

  return (
    <div id="main-content" tabIndex={-1} className="min-h-screen bg-background focus:outline-none">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <SynozurAppSwitcher currentApp="nebula" />
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity" data-testid="link-home">
              <img 
                src="/logos/synozur-horizontal-color.png" 
                alt="Synozur Alliance" 
                className="h-8"
                data-testid="img-logo"
              />
              <div className="h-6 w-px bg-border/40" data-testid="divider-separator" />
              <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent" data-testid="text-app-name">
                Nebula
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <OrgSwitcher 
              selectedOrgId={selectedOrgId} 
              onOrgChange={handleOrgChange} 
            />
            <div className="h-6 w-px bg-border/40" />
            <ThemeToggle />
            <UserProfileMenu />
          </div>
        </div>
      </header>

      {/* Page Header */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gradient-blue-purple-pink mb-2" data-testid="text-page-title">
                My Workspaces
              </h1>
              <p className="text-muted-foreground text-lg" data-testid="text-page-subtitle">
                Manage your envisioning sessions
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-only-mine"
                  checked={showOnlyMine}
                  onCheckedChange={setShowOnlyMine}
                  data-testid="switch-created-by-me"
                />
                <Label htmlFor="show-only-mine" className="text-sm text-muted-foreground cursor-pointer">
                  <User className="w-4 h-4 inline mr-1" />
                  Created by me
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                  data-testid="switch-show-archived"
                />
                <Label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer">
                  <Archive className="w-4 h-4 inline mr-1" />
                  Show archived
                </Label>
              </div>
              <Link href="/projects">
                <Button variant="outline" data-testid="button-my-projects">
                  <FolderKanban className="h-4 w-4 mr-2" />
                  My Projects
                </Button>
              </Link>
              {(user.role === "global_admin" || user.role === "company_admin") && (() => {
                const newProjOrg = selectedOrgId
                  ? organizations?.find(o => o.id === selectedOrgId)
                  : organizations?.[0];
                return newProjOrg ? (
                  <Button
                    variant="outline"
                    data-testid="button-new-project"
                    onClick={() =>
                      setNewProjectDialog({ open: true, orgId: newProjOrg.id, orgName: newProjOrg.name })
                    }
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                ) : null;
              })()}
              {(user.role === "global_admin" || user.role === "company_admin" || user.role === "facilitator") && (() => {
                const targetOrg = selectedOrgId 
                  ? organizations?.find(o => o.id === selectedOrgId) 
                  : organizations?.[0];
                return targetOrg ? (
                  <NewWorkspaceDialog
                    organizationId={targetOrg.id}
                    organizationSlug={targetOrg.slug}
                    trigger={
                      <Button data-testid="button-create-workspace">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Workspace
                      </Button>
                    }
                  />
                ) : null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} data-testid={`skeleton-workspace-${i}`}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : workspacesError ? (
          <QueryErrorState
            title="Couldn't load your workspaces"
            error={workspacesError}
            onRetry={() => refetchWorkspaces()}
            isRetrying={isRefetchingWorkspaces}
            testId="error-workspaces"
          />
        ) : !workspaces || workspaces.length === 0 ? (
          <Card data-testid="card-no-workspaces">
            <CardHeader>
              <CardTitle>No Workspaces Yet</CardTitle>
              <CardDescription>
                {user.role === "facilitator"
                  ? "You haven't been assigned to any workspaces yet. Contact your administrator to get started."
                  : "Create your first workspace to begin an envisioning session."}
              </CardDescription>
            </CardHeader>
            {(user.role === "global_admin" || user.role === "company_admin") && (() => {
              const targetOrg = selectedOrgId 
                ? organizations?.find(o => o.id === selectedOrgId) 
                : organizations?.[0];
              return targetOrg ? (
                <CardContent>
                  <NewWorkspaceDialog
                    organizationId={targetOrg.id}
                    organizationSlug={targetOrg.slug}
                    trigger={
                      <Button data-testid="button-create-first-workspace">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Workspace
                      </Button>
                    }
                  />
                </CardContent>
              ) : null;
            })()}
          </Card>
        ) : (
          <div className="space-y-8">
            {groupedWorkspaces.map((org) => (
              <div key={org.orgId} className="space-y-4">
                {groupedWorkspaces.length > 1 && (
                  <h2 className="text-xl font-semibold text-foreground" data-testid={`text-org-name-${org.orgId}`}>
                    {org.orgName}
                  </h2>
                )}

                {org.projects.map((project) => {
                  const projectKey = `${org.orgId}-${project.projectId || "no-project"}`;
                  const isExpanded = expandedProjects.has(projectKey);

                  return (
                    <Collapsible
                      key={projectKey}
                      open={isExpanded}
                      onOpenChange={() => toggleProject(org.orgId, project.projectId)}
                    >
                      <div className="flex items-center flex-wrap gap-2">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="flex-1 min-w-0 justify-start gap-2 h-auto py-3 px-4 hover-elevate"
                            data-testid={`button-toggle-project-${project.projectId || "unassigned"}`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            )}
                            <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
                            <span className="font-medium truncate">{project.projectName}</span>
                            {project.isDefault && (
                              <Badge variant="secondary" className="ml-2">Default</Badge>
                            )}
                            <Badge variant="outline" className="ml-auto shrink-0">
                              {project.workspaces.length} workspace{project.workspaces.length !== 1 ? "s" : ""}
                            </Badge>
                          </Button>
                        </CollapsibleTrigger>
                        {(user.role === "global_admin" || user.role === "company_admin" || user.role === "facilitator") && project.projectId && (
                          <NewWorkspaceDialog
                            organizationId={org.orgId}
                            organizationSlug={org.orgSlug}
                            defaultProjectId={project.projectId}
                            trigger={
                              <Button variant="outline" size="sm" className="shrink-0" data-testid={`button-new-workspace-in-project-${project.projectId}`}>
                                <Plus className="h-4 w-4 mr-1" />
                                New Workspace
                              </Button>
                            }
                          />
                        )}
                        {project.projectId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0"
                                onClick={() => setShareProject({ projectId: project.projectId!, projectName: project.projectName, orgId: org.orgId })}
                                data-testid={`button-share-project-${project.projectId}`}
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Share project with org members</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <CollapsibleContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4 ml-6">
                          {project.workspaces.length === 0 ? (
                            <Card className="border-dashed" data-testid={`card-empty-project-${project.projectId}`}>
                              <CardHeader>
                                <CardDescription className="text-center py-4">
                                  No workspaces in this project yet.
                                </CardDescription>
                              </CardHeader>
                              {(user.role === "global_admin" || user.role === "company_admin" || user.role === "facilitator") && (
                                <CardContent className="pt-0">
                                  <NewWorkspaceDialog
                                    organizationId={org.orgId}
                                    organizationSlug={org.orgSlug}
                                    defaultProjectId={project.projectId || undefined}
                                    trigger={
                                      <Button variant="outline" className="w-full" data-testid={`button-create-workspace-${project.projectId}`}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Workspace
                                      </Button>
                                    }
                                  />
                                </CardContent>
                              )}
                            </Card>
                          ) : project.workspaces.map((workspace) => (
                            <Card
                              key={workspace.id}
                              className="hover-elevate transition-all"
                              data-testid={`card-workspace-${workspace.id}`}
                            >
                              <CardHeader className="space-y-3">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg truncate" data-testid={`text-workspace-name-${workspace.id}`}>
                                      {workspace.name}
                                    </CardTitle>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {workspace.hidden && (
                                      <Badge variant="secondary" className="text-xs" data-testid={`badge-archived-${workspace.id}`}>
                                        <Archive className="h-3 w-3 mr-1" />
                                        Archived
                                      </Badge>
                                    )}
                                    <Badge
                                      variant="outline"
                                      className={getStatusColor(workspace.status)}
                                      data-testid={`badge-status-${workspace.id}`}
                                    >
                                      {getStatusLabel(workspace.status)}
                                    </Badge>
                                  </div>
                                </div>

                                {workspace.description && (
                                  <CardDescription className="line-clamp-2" data-testid={`text-description-${workspace.id}`}>
                                    {workspace.description}
                                  </CardDescription>
                                )}

                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1" data-testid={`stat-participants-${workspace.id}`}>
                                    <Users className="w-4 h-4" />
                                    <span>{workspace.stats.participantCount}</span>
                                  </div>
                                  <div className="flex items-center gap-1" data-testid={`stat-notes-${workspace.id}`}>
                                    <StickyNote className="w-4 h-4" />
                                    <span>{workspace.stats.noteCount}</span>
                                  </div>
                                </div>
                              </CardHeader>

                              <CardContent className="space-y-2">
                                <Button
                                  asChild
                                  className="w-full"
                                  data-testid={`button-manage-${workspace.id}`}
                                >
                                  <Link href={`/o/${workspace.organization.slug}/s/${workspace.code}/facilitate`}>
                                    Manage Workspace
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                  </Link>
                                </Button>

                                <div className="flex gap-2">
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    data-testid={`button-join-${workspace.id}`}
                                  >
                                    <Link href={`/join/${workspace.code}`}>
                                      Join as Participant
                                    </Link>
                                  </Button>

                                  {/* Guest access toggle — facilitators and admins */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        disabled={guestToggleMutation.isPending}
                                        onClick={() => guestToggleMutation.mutate({ workspaceId: workspace.id, guestAllowed: !workspace.guestAllowed })}
                                        data-testid={`button-toggle-guest-${workspace.id}`}
                                      >
                                        {workspace.guestAllowed
                                          ? <UserCheck className="h-4 w-4 text-green-500" />
                                          : <UserX className="h-4 w-4 text-muted-foreground" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {workspace.guestAllowed ? "Guest access on — click to disable" : "Guest access off — click to enable"}
                                    </TooltipContent>
                                  </Tooltip>

                                  {/* Duplicate workspace */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={() => setDuplicateModal({ open: true, workspaceId: workspace.id, workspaceName: workspace.name })}
                                        data-testid={`button-duplicate-${workspace.id}`}
                                      >
                                        <Copy className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Duplicate workspace</TooltipContent>
                                  </Tooltip>

                                  {/* Archive / restore — admins only */}
                                  {(user.role === "global_admin" || user.role === "company_admin") && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="outline"
                                          disabled={archiveMutation.isPending}
                                          onClick={() => archiveMutation.mutate({ workspaceId: workspace.id, hidden: !workspace.hidden })}
                                          data-testid={`button-archive-${workspace.id}`}
                                        >
                                          {workspace.hidden
                                            ? <ArchiveRestore className="h-4 w-4 text-primary" />
                                            : <Archive className="h-4 w-4 text-muted-foreground" />}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {workspace.hidden ? "Restore workspace" : "Archive workspace"}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>

                                <p className="text-xs text-center text-muted-foreground" data-testid={`text-code-${workspace.id}`}>
                                  Code: <span className="font-mono text-2xl font-bold tracking-wider text-primary">{workspace.code}</span>
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog
        open={newProjectDialog.open}
        onOpenChange={(open) => setNewProjectDialog((s) => ({ ...s, open }))}
        organizationId={newProjectDialog.orgId}
        organizationName={newProjectDialog.orgName}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/my-workspaces"] });
          queryClient.invalidateQueries({ queryKey: ["/api/my-organizations"] });
        }}
      />

      <DuplicateWorkspaceModal
        open={duplicateModal.open}
        onOpenChange={(open) => setDuplicateModal((s) => ({ ...s, open }))}
        workspaceId={duplicateModal.workspaceId}
        workspaceName={duplicateModal.workspaceName}
      />

      {shareProject && (
        <ProjectShareDialog
          projectId={shareProject.projectId}
          projectName={shareProject.projectName}
          orgId={shareProject.orgId}
          onClose={() => setShareProject(null)}
        />
      )}
    </div>
  );
}

interface OrgMember {
  id: string;
  displayName: string | null;
  username: string;
  email: string;
  role: string;
}

interface ProjectMemberFull {
  userId: string;
  projectId: string;
  role: string;
  user: {
    id: string;
    displayName: string | null;
    username: string;
    email: string;
  };
}

function ProjectShareDialog({
  projectId, projectName, orgId, onClose,
}: {
  projectId: string;
  projectName: string;
  orgId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"member" | "admin">("member");

  const membersKey = ["/api/projects", projectId, "members"];

  const { data: members = [], isLoading: membersLoading } = useQuery<ProjectMemberFull[]>({
    queryKey: membersKey,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load members");
      return res.json();
    },
  });

  const { data: orgMembers = [] } = useQuery<OrgMember[]>({
    queryKey: ["/api/organizations", orgId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${orgId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load org members");
      return res.json();
    },
  });

  const addMember = useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      apiRequest("POST", `/api/projects/${projectId}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey });
      setSelectedUserId("");
      toast({ title: "Member added" });
    },
    onError: (e: any) => toast({ title: "Could not add member", description: e?.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("DELETE", `/api/projects/${projectId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey });
      toast({ title: "Member removed" });
    },
    onError: (e: any) => toast({ title: "Could not remove member", description: e?.message, variant: "destructive" }),
  });

  const memberUserIds = new Set(members.map((m) => m.userId));
  const available = orgMembers.filter((u) => !memberUserIds.has(u.id));

  const displayName = (u: { displayName: string | null; username: string; email: string }) =>
    u.displayName || u.username || u.email;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share "{projectName}"
          </DialogTitle>
          <DialogDescription>
            Add or remove org members from this project. Members can access all workspaces within it.
          </DialogDescription>
        </DialogHeader>

        {/* Add member row */}
        <div className="flex gap-2 items-center">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="flex-1" data-testid="select-share-user">
              <SelectValue placeholder="Select a member to add…" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <SelectItem value="__none__" disabled>All org members already added</SelectItem>
              ) : (
                available.map((u) => (
                  <SelectItem key={u.id} value={u.id} data-testid={`option-share-user-${u.id}`}>
                    {displayName(u)} <span className="text-muted-foreground">({u.email})</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "member" | "admin")}>
            <SelectTrigger className="w-[110px]" data-testid="select-share-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!selectedUserId || addMember.isPending}
            onClick={() => addMember.mutate({ userId: selectedUserId, role: selectedRole })}
            data-testid="button-share-add"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Current members */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {membersLoading ? "Loading…" : `${members.length} member${members.length !== 1 ? "s" : ""}`}
          </p>
          {members.length === 0 && !membersLoading && (
            <p className="text-sm text-muted-foreground py-2 text-center">
              No members yet. Add someone above.
            </p>
          )}
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-3 rounded-md border px-3 py-2" data-testid={`member-row-${m.userId}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName(m.user)}</p>
                <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 capitalize">{m.role}</Badge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeMember.mutate(m.userId)}
                disabled={removeMember.isPending}
                data-testid={`button-remove-member-${m.userId}`}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
