import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, StickyNote, ArrowRight, Plus, FolderKanban, ChevronDown, ChevronRight, Building2, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NewWorkspaceDialog } from "@/components/NewWorkspaceDialog";

interface WorkspaceWithStats {
  id: string;
  name: string;
  description: string | null;
  code: string;
  status: string;
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
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  useEffect(() => {
    document.title = "Nebula - Dashboard | The Synozur Alliance";
  }, []);

  const { data: organizations } = useQuery<OrganizationWithCounts[]>({
    queryKey: ["/api/my-organizations"],
    enabled: !!user,
  });

  const { data: workspaces, isLoading } = useQuery<WorkspaceWithStats[]>({
    queryKey: ["/api/my-workspaces"],
    enabled: !!user,
  });

  const { data: allProjects } = useQuery<Project[]>({
    queryKey: ["/api/organizations", selectedOrgId, "projects"],
    enabled: !!user && !!selectedOrgId,
  });

  const handleOrgChange = useCallback((orgId: string | null) => {
    setSelectedOrgId(orgId);
  }, []);

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
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
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
            <div className="flex items-center gap-4">
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
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2 h-auto py-3 px-4 hover-elevate"
                          data-testid={`button-toggle-project-${project.projectId || "unassigned"}`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          <FolderKanban className="h-4 w-4 shrink-0 text-primary" />
                          <span className="font-medium">{project.projectName}</span>
                          {project.isDefault && (
                            <Badge variant="secondary" className="ml-2">Default</Badge>
                          )}
                          <Badge variant="outline" className="ml-auto">
                            {project.workspaces.length} workspace{project.workspaces.length !== 1 ? "s" : ""}
                          </Badge>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4 ml-6">
                          {project.workspaces.length === 0 ? (
                            <Card className="border-dashed" data-testid={`card-empty-project-${project.projectId}`}>
                              <CardHeader>
                                <CardDescription className="text-center py-4">
                                  No workspaces in this project yet.
                                </CardDescription>
                              </CardHeader>
                              {(user.role === "global_admin" || user.role === "company_admin") && (
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
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg truncate" data-testid={`text-workspace-name-${workspace.id}`}>
                                      {workspace.name}
                                    </CardTitle>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={getStatusColor(workspace.status)}
                                    data-testid={`badge-status-${workspace.id}`}
                                  >
                                    {getStatusLabel(workspace.status)}
                                  </Badge>
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
    </div>
  );
}
