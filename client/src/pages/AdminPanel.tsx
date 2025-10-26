import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Plus, LogOut, Loader2, Mail, Clock, Check, X, BookOpen, FileStack, Activity } from "lucide-react";
import type { Organization, Space, User, AccessRequest, WorkspaceTemplate } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { KnowledgeBaseManager } from "@/components/KnowledgeBaseManager";

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
            <TabsTrigger value="knowledge-base" data-testid="tab-knowledge-base">
              <BookOpen className="h-4 w-4 mr-2" />
              Knowledge Base
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <FileStack className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="ai-usage" data-testid="tab-ai-usage">
              <Activity className="h-4 w-4 mr-2" />
              AI Usage
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

          <TabsContent value="knowledge-base">
            {currentUser.role === "global_admin" ? (
              <KnowledgeBaseManager
                scope="system"
                title="System-Wide Knowledge Base"
                description="Upload documents that will be available across all organizations and workspaces for AI grounding"
              />
            ) : currentUser.role === "company_admin" && companyOrg ? (
              <KnowledgeBaseManager
                scope="organization"
                scopeId={companyOrg.id}
                title={`${companyOrg.name} Knowledge Base`}
                description="Upload documents that will be available across all workspaces in your organization for AI grounding"
              />
            ) : (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No access to Knowledge Base</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="templates">
            <TemplatesTab 
              currentUser={currentUser}
              organizations={displayOrgs}
            />
          </TabsContent>

          <TabsContent value="ai-usage">
            <AiUsageTab 
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

function TemplatesTab({ 
  currentUser, 
  organizations 
}: { 
  currentUser: User;
  organizations: Organization[];
}) {
  const { toast } = useToast();
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // Fetch templates based on user role
  const organizationId = currentUser.role === "company_admin" ? currentUser.organizationId : undefined;
  
  const { data: templates = [], isLoading } = useQuery<WorkspaceTemplate[]>({
    queryKey: organizationId ? ["/api/templates", { organizationId }] : ["/api/templates"],
    queryFn: async () => {
      const params = organizationId ? `?organizationId=${organizationId}` : '';
      const response = await fetch(`/api/templates${params}`);
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template deleted",
        description: "The workspace template has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = (templateId: string) => {
    if (confirm("Are you sure you want to delete this template? This action cannot be undone.")) {
      deleteTemplateMutation.mutate(templateId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
          <FileStack className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No templates yet</h3>
          <p className="text-sm max-w-md mx-auto">
            Workspace templates allow you to create pre-configured workspaces with seeded notes and knowledge base documents.
            Create a template from an existing workspace in the Facilitator Workspace.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Workspace Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage reusable workspace configurations with pre-seeded content
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {templates.map((template) => {
          const org = organizations.find(o => o.id === template.organizationId);
          const isExpanded = expandedTemplateId === template.id;

          return (
            <Card key={template.id} data-testid={`card-template-${template.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="secondary" data-testid={`badge-type-${template.id}`}>
                        {template.type}
                      </Badge>
                      {template.organizationId && org && (
                        <Badge variant="outline" data-testid={`badge-org-${template.id}`}>
                          {org.name}
                        </Badge>
                      )}
                      {!template.organizationId && (
                        <Badge variant="default" data-testid={`badge-scope-${template.id}`}>
                          System
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {new Date(template.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedTemplateId(isExpanded ? null : template.id)}
                      data-testid={`button-view-details-${template.id}`}
                    >
                      {isExpanded ? "Hide Details" : "View Details"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      disabled={deleteTemplateMutation.isPending}
                      data-testid={`button-delete-${template.id}`}
                    >
                      {deleteTemplateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent>
                  <TemplateDetails templateId={template.id} />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TemplateDetails({ templateId }: { templateId: string }) {
  const { data: templateDetails, isLoading } = useQuery<{
    notes: any[];
    documents: any[];
  }>({
    queryKey: ["/api/templates", templateId],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!templateDetails) {
    return <p className="text-sm text-muted-foreground">Failed to load template details</p>;
  }

  const { notes = [], documents = [] } = templateDetails;

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <h4 className="font-medium mb-2">Seeded Notes ({notes.length})</h4>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes in this template</p>
        ) : (
          <div className="grid gap-2">
            {notes.slice(0, 5).map((note: any) => (
              <div key={note.id} className="p-3 rounded-md bg-muted/30 text-sm">
                <p className="line-clamp-2">{note.content}</p>
                {note.category && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    {note.category}
                  </Badge>
                )}
              </div>
            ))}
            {notes.length > 5 && (
              <p className="text-xs text-muted-foreground">
                ...and {notes.length - 5} more notes
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <h4 className="font-medium mb-2">Knowledge Base Documents ({documents.length})</h4>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents in this template</p>
        ) : (
          <div className="grid gap-2">
            {documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {(doc.fileSize / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AiUsageTab({ 
  currentUser, 
  organizations 
}: { 
  currentUser: User;
  organizations: Organization[];
}) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | "all">(
    currentUser.role === "company_admin" && organizations.length > 0 
      ? organizations[0].id 
      : "all"
  );
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | "all">("all");
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("30d");

  // Fetch spaces for selected organization
  const { data: spaces = [] } = useQuery<Space[]>({
    queryKey: ["/api/admin/organizations", selectedOrgId, "spaces"],
    enabled: selectedOrgId !== "all",
  });

  // Build API endpoint based on filters
  const getUsageEndpoint = () => {
    const params = new URLSearchParams();
    
    if (selectedOrgId !== "all") {
      params.append("organizationId", selectedOrgId);
    }
    
    if (selectedSpaceId !== "all") {
      params.append("spaceId", selectedSpaceId);
    }
    
    if (timeRange !== "all") {
      const now = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case "24h":
          startDate.setHours(now.getHours() - 24);
          break;
        case "7d":
          startDate.setDate(now.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(now.getDate() - 30);
          break;
      }
      params.append("startDate", startDate.toISOString());
    }

    return `/api/admin/ai-usage?${params.toString()}`;
  };

  // Fetch usage statistics
  const { data: usageLogs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/ai-usage", selectedOrgId, selectedSpaceId, timeRange],
    queryFn: async () => {
      const response = await fetch(getUsageEndpoint());
      if (!response.ok) throw new Error("Failed to fetch AI usage");
      return response.json();
    },
  });

  // Calculate summary statistics
  const summary = usageLogs.reduce((acc, log) => {
    acc.totalOperations++;
    acc.totalTokens += log.inputTokens + log.outputTokens;
    acc.totalCost += log.estimatedCostCents;
    return acc;
  }, { totalOperations: 0, totalTokens: 0, totalCost: 0 });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Organization Filter */}
            {currentUser.role === "global_admin" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Organization</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={selectedOrgId}
                  onChange={(e) => {
                    setSelectedOrgId(e.target.value);
                    setSelectedSpaceId("all");
                  }}
                  data-testid="select-organization"
                >
                  <option value="all">All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Workspace Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Workspace</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                disabled={selectedOrgId === "all"}
                data-testid="select-workspace"
              >
                <option value="all">All Workspaces</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Time Range</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                data-testid="select-time-range"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-operations">
              {summary.totalOperations.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tokens">
              {summary.totalTokens.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-cost">
              ${(summary.totalCost / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent AI Operations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading usage data...
            </div>
          ) : usageLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No AI usage found for the selected filters</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {usageLogs.map((log: any, index: number) => (
                <div 
                  key={log.id || index} 
                  className="flex items-center justify-between p-3 rounded-md bg-muted/30"
                  data-testid={`usage-log-${index}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {log.operation}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {log.modelName}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {(log.inputTokens + log.outputTokens).toLocaleString()} tokens
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${(log.estimatedCostCents / 100).toFixed(4)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
