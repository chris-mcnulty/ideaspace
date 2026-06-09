import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  Building2,
  Layers,
  ChevronDown,
  ChevronRight,
  User,
  Plus,
  FolderPlus,
  ArrowRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { QueryErrorState } from "@/components/QueryErrorState";
import { NewWorkspaceDialog } from "@/components/NewWorkspaceDialog";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SynozurAppSwitcher } from "@/components/SynozurAppSwitcher";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";

interface ProjectWorkspace {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  workspaceCount?: number;
  workspaces?: ProjectWorkspace[];
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  projectCount: number;
  workspaceCount: number;
}

// ── Move-to-Project popover ───────────────────────────────────────────────────

interface MoveWorkspacePopoverProps {
  workspaceId: string;
  workspaceName: string;
  currentProjectId: string;
  orgProjects: Project[];
}

function MoveWorkspacePopover({
  workspaceId,
  workspaceName,
  currentProjectId,
  orgProjects,
}: MoveWorkspacePopoverProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const moveMutation = useMutation({
    mutationFn: ({ projectId }: { projectId: string }) =>
      apiRequest("PATCH", `/api/spaces/${workspaceId}/move-to-project`, { projectId }),
    onSuccess: (_data, { projectId }) => {
      const target = orgProjects.find((p) => p.id === projectId);
      queryClient.invalidateQueries({ queryKey: ["/api/my-projects/detailed"] });
      toast({
        title: "Workspace moved",
        description: `"${workspaceName}" moved to "${target?.name ?? "project"}".`,
      });
      setOpen(false);
    },
    onError: async (err: any) => {
      let msg = "An unexpected error occurred.";
      try {
        const body = await err.json?.();
        if (body?.error) msg = body.error;
      } catch {}
      toast({ variant: "destructive", title: "Failed to move workspace", description: msg });
    },
  });

  const otherProjects = orgProjects.filter((p) => p.id !== currentProjectId);
  if (otherProjects.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          title="Move to another project"
          data-testid={`button-move-workspace-${workspaceId}`}
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-1"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Move to project
        </p>
        <div className="space-y-0.5">
          {otherProjects.map((project) => (
            <Button
              key={project.id}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm"
              disabled={moveMutation.isPending}
              data-testid={`button-move-to-${project.id}`}
              onClick={() => moveMutation.mutate({ projectId: project.id })}
            >
              <FolderKanban className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
              <span className="truncate">{project.name}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyProjects() {
  const { user, isLoading: authLoading } = useAuth();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const selectedOrgId = new URLSearchParams(search).get("org");
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [newProjectDialog, setNewProjectDialog] = useState<{
    open: boolean;
    orgId: string;
    orgName: string;
  }>({ open: false, orgId: "", orgName: "" });
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const toggleOrg = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  useEffect(() => {
    document.title = "My Projects - Nebula | The Synozur Alliance";
  }, []);

  // Fetch user's organizations
  const { data: organizations = [], isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/my-organizations"],
    enabled: !!user,
  });

  // Fetch user's projects with workspace counts
  const {
    data: projects = [],
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
    isFetching: isRefetchingProjects,
  } = useQuery<Project[]>({
    queryKey: ["/api/my-projects/detailed"],
    enabled: !!user,
  });

  const handleOrgChange = (orgId: string | null) => {
    const params = new URLSearchParams(search);
    if (orgId) {
      params.set("org", orgId);
    } else {
      params.delete("org");
    }
    const qs = params.toString();
    setLocation(qs ? `/projects?${qs}` : "/projects");
  };

  const isAdmin =
    user?.role === "global_admin" || user?.role === "company_admin";

  const isFacilitatorOrAdmin =
    isAdmin || user?.role === "facilitator";

  // Filter projects by selected organization and "created by me"
  let filteredProjects = selectedOrgId
    ? projects.filter((p) => p.organizationId === selectedOrgId)
    : projects;

  if (showOnlyMine && user) {
    filteredProjects = filteredProjects.filter((p) => p.createdBy === user.id);
  }

  // Group projects by organization
  const projectsByOrg = filteredProjects.reduce(
    (acc, project) => {
      const orgId = project.organizationId;
      if (!acc[orgId]) {
        acc[orgId] = {
          organization: project.organization || { id: orgId, name: "Unknown", slug: "" },
          projects: [],
        };
      }
      acc[orgId].projects.push(project);
      return acc;
    },
    {} as Record<
      string,
      { organization: { id: string; name: string; slug: string }; projects: Project[] }
    >,
  );

  const isLoading = authLoading || orgsLoading || projectsLoading;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-32" data-testid="skeleton-loading" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>Please sign in to view your projects.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="w-full" data-testid="button-sign-in">
                Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <SynozurAppSwitcher currentApp="nebula" />
            <Link
              href="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              data-testid="link-home"
            >
              <img
                src="/logos/synozur-horizontal-color.png"
                alt="Synozur Alliance"
                className="h-8"
                data-testid="img-logo"
              />
              <div className="h-6 w-px bg-border/40" />
              <span
                className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent"
                data-testid="text-app-name"
              >
                Nebula
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <OrgSwitcher selectedOrgId={selectedOrgId} onOrgChange={handleOrgChange} />
            <div className="h-6 w-px bg-border/40" />
            <ThemeToggle />
            <UserProfileMenu />
          </div>
        </div>
      </header>

      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-3xl font-bold tracking-tight"
                data-testid="text-page-title"
              >
                My Projects
              </h1>
              <p className="text-muted-foreground mt-1" data-testid="text-page-description">
                View and manage your project collections across organizations
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
                <Label
                  htmlFor="show-only-mine"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  <User className="w-4 h-4 inline mr-1" />
                  Created by me
                </Label>
              </div>
              <Link href="/dashboard">
                <Button variant="outline" data-testid="button-my-workspaces">
                  <Layers className="h-4 w-4 mr-2" />
                  My Workspaces
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-7xl mx-auto px-4 py-8 focus:outline-none"
      >
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" data-testid={`skeleton-project-${i}`} />
            ))}
          </div>
        ) : projectsError ? (
          <QueryErrorState
            title="Couldn't load your projects"
            error={projectsError}
            onRetry={() => refetchProjects()}
            isRetrying={isRefetchingProjects}
            testId="error-projects"
          />
        ) : Object.keys(projectsByOrg).length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
              <p className="text-muted-foreground mb-4">
                You don't have access to any projects. Contact your administrator to get
                access.
              </p>
              <Link href="/dashboard">
                <Button variant="outline" data-testid="button-go-dashboard">
                  Go to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(projectsByOrg).map(
              ([orgId, { organization, projects: orgProjects }]) => (
                <Collapsible
                  key={orgId}
                  open={expandedOrgs.has(orgId)}
                  onOpenChange={() => toggleOrg(orgId)}
                  className="space-y-4"
                >
                  {/* Org section header */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CollapsibleTrigger asChild>
                      <button
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        data-testid={`button-toggle-org-${orgId}`}
                      >
                        {expandedOrgs.has(orgId) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <h2
                          className="text-xl font-semibold"
                          data-testid={`text-org-name-${orgId}`}
                        >
                          {organization.name}
                        </h2>
                        <Badge variant="secondary" className="ml-2">
                          {orgProjects.length} project{orgProjects.length !== 1 ? "s" : ""}
                        </Badge>
                      </button>
                    </CollapsibleTrigger>

                    {/* New Project button — admins only */}
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-new-project-${orgId}`}
                        onClick={() =>
                          setNewProjectDialog({
                            open: true,
                            orgId: organization.id,
                            orgName: organization.name,
                          })
                        }
                      >
                        <FolderPlus className="h-4 w-4 mr-2" />
                        New Project
                      </Button>
                    )}
                  </div>

                  <CollapsibleContent>
                  {/* Project cards grid */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {orgProjects.map((project) => (
                      <Card
                        key={project.id}
                        className="transition-all"
                        data-testid={`card-project-${project.id}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <FolderKanban className="h-5 w-5 text-primary" />
                              <CardTitle className="text-lg">{project.name}</CardTitle>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {project.isDefault && (
                                <Badge variant="outline" className="text-xs">
                                  Default
                                </Badge>
                              )}
                              {isFacilitatorOrAdmin && (
                                <NewWorkspaceDialog
                                  organizationId={organization.id}
                                  organizationSlug={organization.slug}
                                  defaultProjectId={project.id}
                                  trigger={
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      data-testid={`button-create-workspace-project-${project.id}`}
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      New Workspace
                                    </Button>
                                  }
                                />
                              )}
                            </div>
                          </div>
                          {project.description && (
                            <CardDescription className="mt-2 line-clamp-2">
                              {project.description}
                            </CardDescription>
                          )}
                        </CardHeader>

                        <CardContent className="pt-0">
                          {project.workspaces && project.workspaces.length > 0 ? (
                            <div className="space-y-1">
                              {project.workspaces.map((ws) => (
                                <div
                                  key={ws.id}
                                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-md hover-elevate group"
                                  data-testid={`row-workspace-${ws.id}`}
                                >
                                  {/* Clickable main area → facilitator view */}
                                  <Link
                                    href={`/o/${organization.slug}/s/${ws.code}/facilitate`}
                                    className="flex items-center gap-2 min-w-0 flex-1"
                                  >
                                    <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="text-sm truncate">{ws.name}</span>
                                    <span className="text-xs text-muted-foreground font-mono shrink-0">
                                      {ws.code}
                                    </span>
                                  </Link>

                                  {/* Action area — outside the Link */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {/* Move to project — admins only, only when >1 project in org */}
                                    {isAdmin && (
                                      <MoveWorkspacePopover
                                        workspaceId={ws.id}
                                        workspaceName={ws.name}
                                        currentProjectId={project.id}
                                        orgProjects={orgProjects}
                                      />
                                    )}
                                    <Badge
                                      variant={
                                        ws.status === "open"
                                          ? "default"
                                          : ws.status === "closed"
                                            ? "secondary"
                                            : "outline"
                                      }
                                      className="text-xs"
                                    >
                                      {ws.status}
                                    </Badge>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground py-2">
                              No workspaces yet
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  </CollapsibleContent>
                </Collapsible>
              ),
            )}
          </div>
        )}
      </main>

      {/* New Project dialog */}
      <NewProjectDialog
        open={newProjectDialog.open}
        onOpenChange={(open) => setNewProjectDialog((s) => ({ ...s, open }))}
        organizationId={newProjectDialog.orgId}
        organizationName={newProjectDialog.orgName}
      />
    </div>
  );
}
