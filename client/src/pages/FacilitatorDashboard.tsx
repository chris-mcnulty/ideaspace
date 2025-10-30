import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, StickyNote, ArrowRight, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";

interface WorkspaceWithStats {
  id: string;
  name: string;
  description: string | null;
  code: string;
  status: string;
  organizationId: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  stats: {
    participantCount: number;
    noteCount: number;
  };
}

export default function FacilitatorDashboard() {
  const { user } = useAuth();

  const { data: workspaces, isLoading } = useQuery<WorkspaceWithStats[]>({
    queryKey: ["/api/my-workspaces"],
    enabled: !!user,
  });

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
          <div className="flex items-center gap-2">
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
            {(user.role === "global_admin" || user.role === "company_admin" || user.role === "facilitator") && (
              <Button asChild data-testid="button-create-workspace">
                <Link href="/admin">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workspace
                </Link>
              </Button>
            )}
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
            {(user.role === "global_admin" || user.role === "company_admin") && (
              <CardContent>
                <Button asChild data-testid="button-create-first-workspace">
                  <Link href="/admin">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Workspace
                  </Link>
                </Button>
              </CardContent>
            )}
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
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
                      <p className="text-xs text-muted-foreground mt-1" data-testid={`text-workspace-org-${workspace.id}`}>
                        {workspace.organization.name}
                      </p>
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
                    Code: <span className="font-mono">{workspace.code}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
