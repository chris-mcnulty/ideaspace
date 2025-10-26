import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Plus, LogOut, Loader2, Mail, Clock, Check, X } from "lucide-react";
import type { Organization, Space, User, AccessRequest } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";

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
  const { data: companyOrg, isLoading: companyOrgLoading } = useQuery<Organization>({
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

  if (userLoading || orgsLoading || companyOrgLoading) {
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">
            Manage organizations, workspaces, and access requests
          </p>
        </div>

        <Tabs defaultValue="workspaces" className="space-y-6">
          <TabsList>
            <TabsTrigger value="workspaces" data-testid="tab-workspaces">
              <Building2 className="h-4 w-4 mr-2" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="access-requests" data-testid="tab-access-requests">
              <Mail className="h-4 w-4 mr-2" />
              Access Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workspaces" className="space-y-6">
            <div className="flex items-center justify-end">
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
          </TabsContent>

          <TabsContent value="access-requests">
            <AccessRequestsTab 
              currentUser={currentUser}
              organizations={displayOrgs}
            />
          </TabsContent>
        </Tabs>
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

function AccessRequestsTab({ 
  currentUser, 
  organizations 
}: { 
  currentUser: User;
  organizations: Organization[];
}) {
  const { toast } = useToast();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  // Fetch all spaces for the organizations the user has access to
  const spaceQueries = organizations.map(org => 
    useQuery<Space[]>({
      queryKey: ["/api/admin/organizations", org.id, "spaces"],
    })
  );

  const allSpaces = spaceQueries.flatMap(q => q.data || []);

  // Fetch access requests for all spaces (or filtered by selected space)
  const { data: allAccessRequests = [], isLoading } = useQuery<AccessRequest[]>({
    queryKey: selectedSpaceId ? ["/api/spaces", selectedSpaceId, "access-requests"] : ["/api/access-requests/all"],
    queryFn: async () => {
      if (selectedSpaceId) {
        const response = await fetch(`/api/spaces/${selectedSpaceId}/access-requests`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Failed to fetch access requests");
        return response.json();
      }
      
      // Fetch for all spaces
      const requests: AccessRequest[] = [];
      for (const space of allSpaces) {
        try {
          const response = await fetch(`/api/spaces/${space.id}/access-requests`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            requests.push(...data);
          }
        } catch (err) {
          console.error(`Failed to fetch requests for space ${space.id}:`, err);
        }
      }
      return requests;
    },
    enabled: allSpaces.length > 0,
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "denied" }) => {
      const response = await apiRequest("PATCH", `/api/access-requests/${id}`, { status });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/access-requests/all"] });
      toast({
        title: "Request updated",
        description: "The access request has been processed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update request",
        description: error.message || "Please try again",
      });
    },
  });

  const pendingRequests = allAccessRequests.filter(r => r.status === "pending");
  const resolvedRequests = allAccessRequests.filter(r => r.status !== "pending");

  return (
    <div className="space-y-6">
      {/* Filter by workspace */}
      {allSpaces.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Filter by workspace:</label>
          <select 
            className="flex h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={selectedSpaceId || ""}
            onChange={(e) => setSelectedSpaceId(e.target.value || null)}
            data-testid="select-filter-workspace"
          >
            <option value="">All Workspaces</option>
            {allSpaces.map(space => (
              <option key={space.id} value={space.id}>
                {space.name} ({space.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Requests */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Pending Requests
              {pendingRequests.length > 0 && (
                <Badge variant="default">{pendingRequests.length}</Badge>
              )}
            </h2>
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <p>No pending access requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => {
                  const space = allSpaces.find(s => s.id === request.spaceId);
                  const org = organizations.find(o => o.id === space?.organizationId);
                  
                  return (
                    <Card key={request.id} data-testid={`access-request-${request.id}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div>
                              <h3 className="font-medium">{request.displayName}</h3>
                              <p className="text-sm text-muted-foreground">{request.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{org?.name || "Unknown"}</Badge>
                              <span className="text-muted-foreground">→</span>
                              <Badge variant="outline">{space?.name || "Unknown Workspace"}</Badge>
                            </div>
                            {request.message && (
                              <div className="p-3 bg-muted/50 rounded-md">
                                <p className="text-sm">{request.message}</p>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Requested {new Date(request.requestedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              onClick={() => updateRequestMutation.mutate({ id: request.id, status: "approved" })}
                              disabled={updateRequestMutation.isPending}
                              data-testid={`button-approve-${request.id}`}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateRequestMutation.mutate({ id: request.id, status: "denied" })}
                              disabled={updateRequestMutation.isPending}
                              data-testid={`button-deny-${request.id}`}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Deny
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resolved Requests */}
          {resolvedRequests.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Recently Resolved</h2>
              <div className="space-y-3">
                {resolvedRequests.slice(0, 5).map((request) => {
                  const space = allSpaces.find(s => s.id === request.spaceId);
                  const org = organizations.find(o => o.id === space?.organizationId);
                  
                  return (
                    <Card key={request.id} className="opacity-60">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-medium">{request.displayName}</h3>
                              <Badge variant={request.status === "approved" ? "default" : "secondary"}>
                                {request.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{org?.name}</span>
                              <span>→</span>
                              <span>{space?.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Resolved {request.resolvedAt ? new Date(request.resolvedAt).toLocaleString() : "Unknown"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
