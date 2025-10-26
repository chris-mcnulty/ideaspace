import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Plus, LogOut, Loader2 } from "lucide-react";
import type { Organization, Space, User } from "@shared/schema";

export default function AdminPanel() {
  const [, setLocation] = useLocation();

  // Fetch current user
  const { data: currentUser, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  // Fetch organizations based on role
  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/admin/organizations"],
    enabled: currentUser?.role === "global_admin",
  });

  // For company admins, fetch their organization by ID
  const { data: companyOrg } = useQuery<Organization>({
    queryKey: [`/api/organizations/${currentUser?.organizationId}`],
    queryFn: async () => {
      if (!currentUser?.organizationId) throw new Error("No organization ID");
      const response = await fetch(`/api/organizations/${currentUser.organizationId}`);
      if (!response.ok) throw new Error("Failed to fetch organization");
      return response.json();
    },
    enabled: currentUser?.role === "company_admin" && !!currentUser.organizationId,
  });

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setLocation("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (userLoading || orgsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading admin panel...</span>
        </div>
      </div>
    );
  }

  if (!currentUser || (currentUser.role !== "global_admin" && currentUser.role !== "company_admin")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">Access denied. This page is for administrators only.</p>
            <Button onClick={() => setLocation("/")}>Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine which organizations to display
  const displayOrgs = currentUser.role === "global_admin" 
    ? organizations || [] 
    : companyOrg ? [companyOrg] : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img 
              src="/logos/synozur-horizontal-color.png" 
              alt="Synozur Alliance" 
              className="h-8"
              data-testid="img-logo"
            />
            <div className="h-6 w-px bg-border/40" />
            <span className="text-lg font-semibold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Aurora Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <p className="font-medium">{currentUser.displayName || currentUser.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{currentUser.role.replace("_", " ")}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Workspace Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage organizations and workspaces
            </p>
          </div>
          {currentUser.role === "global_admin" && (
            <Button data-testid="button-create-organization">
              <Plus className="h-4 w-4 mr-2" />
              New Organization
            </Button>
          )}
        </div>

        {displayOrgs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No organizations found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {displayOrgs.map((org) => (
              <OrganizationCard 
                key={org.id} 
                organization={org} 
                currentUserRole={currentUser.role}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function OrganizationCard({ 
  organization, 
  currentUserRole 
}: { 
  organization: Organization;
  currentUserRole: string;
}) {
  // Fetch workspaces for this organization
  const { data: spaces = [], isLoading } = useQuery<Space[]>({
    queryKey: ["/api/admin/organizations", organization.id, "spaces"],
  });

  return (
    <Card>
      <CardHeader className="bg-gradient-to-br from-card to-purple-950/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{organization.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {spaces.length} workspace{spaces.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button size="sm" data-testid={`button-create-workspace-${organization.slug}`}>
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading workspaces...
          </div>
        ) : spaces.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No workspaces yet</p>
            <p className="text-sm mt-1">Create your first workspace to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {spaces.map((space) => (
              <WorkspaceRow 
                key={space.id} 
                space={space} 
                organizationSlug={organization.slug}
                currentUserRole={currentUserRole}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkspaceRow({ 
  space, 
  organizationSlug,
  currentUserRole
}: { 
  space: Space; 
  organizationSlug: string;
  currentUserRole: string;
}) {
  const [, setLocation] = useLocation();

  return (
    <div 
      className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate transition-all"
      data-testid={`workspace-row-${space.id}`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-medium">{space.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs font-mono">
                {space.code}
              </Badge>
              <Badge variant={space.status === "open" ? "default" : "secondary"} className="text-xs capitalize">
                {space.status}
              </Badge>
              {space.hidden && (
                <Badge variant="secondary" className="text-xs">
                  Hidden
                </Badge>
              )}
              {!space.guestAllowed && (
                <Badge variant="secondary" className="text-xs">
                  No Guests
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLocation(`/o/${organizationSlug}/s/${space.id}/facilitate`)}
          data-testid={`button-open-${space.id}`}
        >
          Open
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          data-testid={`button-edit-${space.id}`}
        >
          Edit
        </Button>
        {currentUserRole === "company_admin" && (
          <Button 
            variant="outline" 
            size="sm"
            data-testid={`button-archive-${space.id}`}
          >
            Archive
          </Button>
        )}
      </div>
    </div>
  );
}
