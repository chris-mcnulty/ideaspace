import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderKanban, Building2, Layers, ChevronRight, User, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { NewWorkspaceDialog } from "@/components/NewWorkspaceDialog";
import { useEffect, useState } from "react";

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
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  projectCount: number;
  workspaceCount: number;
}

export default function MyProjects() {
  const { user, isLoading: authLoading } = useAuth();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  useEffect(() => {
    document.title = "My Projects - Nebula | The Synozur Alliance";
  }, []);

  // Fetch user's organizations
  const { data: organizations = [], isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/my-organizations"],
    enabled: !!user,
  });

  // Fetch user's projects with workspace counts
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/my-projects/detailed"],
    enabled: !!user,
  });

  const handleOrgChange = (orgId: string | null) => {
    setSelectedOrgId(orgId);
  };

  // Filter projects by selected organization and "created by me"
  let filteredProjects = selectedOrgId
    ? projects.filter(p => p.organizationId === selectedOrgId)
    : projects;
  
  if (showOnlyMine && user) {
    filteredProjects = filteredProjects.filter(p => p.createdBy === user.id);
  }

  // Group projects by organization
  const projectsByOrg = filteredProjects.reduce((acc, project) => {
    const orgId = project.organizationId;
    if (!acc[orgId]) {
      acc[orgId] = {
        organization: project.organization || { id: orgId, name: "Unknown", slug: "" },
        projects: [],
      };
    }
    acc[orgId].projects.push(project);
    return acc;
  }, {} as Record<string, { organization: { id: string; name: string; slug: string }; projects: Project[] }>);

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
              <Button className="w-full" data-testid="button-sign-in">Sign In</Button>
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
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity" data-testid="link-home">
            <img 
              src="/logos/synozur-horizontal-color.png" 
              alt="Synozur Alliance" 
              className="h-8"
              data-testid="img-logo"
            />
            <div className="h-6 w-px bg-border/40" />
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

      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
                My Projects
              </h1>
              <p className="text-muted-foreground mt-1" data-testid="text-page-description">
                View and manage your project collections across organizations
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

      <main className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" data-testid={`skeleton-project-${i}`} />
            ))}
          </div>
        ) : Object.keys(projectsByOrg).length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
              <p className="text-muted-foreground mb-4">
                You don't have access to any projects. Contact your administrator to get access.
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
            {Object.entries(projectsByOrg).map(([orgId, { organization, projects: orgProjects }]) => (
              <div key={orgId} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold" data-testid={`text-org-name-${orgId}`}>
                    {organization.name}
                  </h2>
                  <Badge variant="secondary" className="ml-2">
                    {orgProjects.length} project{orgProjects.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {orgProjects.map((project) => (
                    <Card 
                      key={project.id} 
                      className="hover-elevate transition-all"
                      data-testid={`card-project-${project.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FolderKanban className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">{project.name}</CardTitle>
                          </div>
                          {project.isDefault && (
                            <Badge variant="outline" className="text-xs">Default</Badge>
                          )}
                        </div>
                        {project.description && (
                          <CardDescription className="mt-2 line-clamp-2">
                            {project.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Layers className="h-4 w-4" />
                              <span>{project.workspaceCount || 0} workspace{(project.workspaceCount || 0) !== 1 ? "s" : ""}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(user.role === "global_admin" || user.role === "company_admin" || user.role === "facilitator") && (
                              <NewWorkspaceDialog
                                organizationId={organization.id}
                                organizationSlug={organization.slug}
                                defaultProjectId={project.id}
                                trigger={
                                  <Button variant="outline" size="sm" data-testid={`button-create-workspace-project-${project.id}`}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    New Workspace
                                  </Button>
                                }
                              />
                            )}
                            <Link href={`/dashboard?org=${organization.id}&project=${project.id}`}>
                              <Button variant="ghost" size="sm" data-testid={`button-view-project-${project.id}`}>
                                View
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
