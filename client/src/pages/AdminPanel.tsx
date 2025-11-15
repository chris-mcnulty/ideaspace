import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, Plus, LogOut, Loader2, Mail, Clock, Check, X, BookOpen, FileStack, Activity, Users, Edit, Trash2 } from "lucide-react";
import type { Organization, Space, User, AccessRequest, WorkspaceTemplate, SystemSetting } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { KnowledgeBaseManager } from "@/components/KnowledgeBaseManager";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertOrganizationSchema, createSpaceApiSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { Key, UserPlus } from "lucide-react";

export default function AdminPanel() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "Nebula - Admin Panel | The Synozur Alliance";
  }, []);

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
              Nebula Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserProfileMenu />
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
            {currentUser.role === "global_admin" && (
              <TabsTrigger value="users" data-testid="tab-users">
                <Users className="h-4 w-4 mr-2" />
                Users
              </TabsTrigger>
            )}
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
            {currentUser.role === "global_admin" && (
              <TabsTrigger value="system-settings" data-testid="tab-system-settings">
                <Activity className="h-4 w-4 mr-2" />
                System Settings
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="workspaces" className="space-y-6">
            <div className="flex items-center justify-end">
              {currentUser.role === "global_admin" && (
                <NewOrganizationDialog />
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

          <TabsContent value="users">
            {currentUser.role === "global_admin" && (
              <UsersTab />
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

          <TabsContent value="system-settings">
            {currentUser.role === "global_admin" && (
              <SystemSettingsTab currentUser={currentUser} />
            )}
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
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Fetch workspaces for this organization
  const { data: spaces = [], isLoading } = useQuery<Space[]>({
    queryKey: ["/api/admin/organizations", organization.id, "spaces"],
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/organizations/${organization.id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete organization");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: "Organization deleted",
        description: "The organization has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete organization",
        description: error.message || "Please try again",
      });
    },
  });

  const handleDelete = () => {
    if (spaces.length > 0) {
      toast({
        variant: "destructive",
        title: "Cannot delete organization",
        description: "Please delete all workspaces first before deleting the organization.",
      });
      return;
    }
    
    if (confirm(`Are you sure you want to delete "${organization.name}"? This action cannot be undone.`)) {
      deleteOrgMutation.mutate();
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="bg-gradient-to-br from-card to-purple-950/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate">{organization.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {spaces.length} workspace{spaces.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {currentUserRole === "global_admin" && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setEditDialogOpen(true)}
                    data-testid={`button-edit-org-${organization.id}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleDelete}
                    disabled={deleteOrgMutation.isPending}
                    data-testid={`button-delete-org-${organization.id}`}
                  >
                    {deleteOrgMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </>
              )}
              <NewWorkspaceDialog organizationId={organization.id} organizationSlug={organization.slug} />
            </div>
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
    
    <EditOrganizationDialog
      organization={organization}
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
    />
    </>
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [markTemplateDialogOpen, setMarkTemplateDialogOpen] = useState(false);
  const { toast } = useToast();

  const toggleHiddenMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/spaces/${space.id}`, {
        hidden: !space.hidden
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", space.organizationId, "spaces"] });
      toast({
        title: space.hidden ? "Workspace unarchived" : "Workspace archived",
        description: space.hidden 
          ? "The workspace is now visible." 
          : "The workspace has been archived and is now hidden.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update workspace",
        description: error.message || "Please try again",
      });
    },
  });

  const markAsTemplateMutation = useMutation({
    mutationFn: async (templateScope: 'system' | 'organization') => {
      const response = await apiRequest("POST", `/api/workspaces/${space.id}/mark-as-template`, {
        templateScope
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to mark as template");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", space.organizationId, "spaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates/spaces"] });
      toast({
        title: "Workspace marked as template",
        description: "This workspace can now be used as a template for new workspaces",
      });
      setMarkTemplateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to mark as template",
        description: error.message || "Please try again",
      });
    },
  });

  return (
    <>
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
            onClick={() => setEditDialogOpen(true)}
            data-testid={`button-edit-${space.id}`}
          >
            Edit
          </Button>
          {(currentUserRole === "company_admin" || currentUserRole === "global_admin") && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => toggleHiddenMutation.mutate()}
                disabled={toggleHiddenMutation.isPending}
                data-testid={`button-archive-${space.id}`}
              >
                {toggleHiddenMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  space.hidden ? "Unarchive" : "Archive"
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setMarkTemplateDialogOpen(true)}
                data-testid={`button-mark-template-${space.id}`}
              >
                <FileStack className="h-3 w-3 mr-1" />
                Mark as Template
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
                data-testid={`button-delete-${space.id}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>
      
      <EditWorkspaceDialog
        space={space}
        organizationId={space.organizationId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      
      <DeleteWorkspaceDialog
        space={space}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />

      <Dialog open={markTemplateDialogOpen} onOpenChange={setMarkTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Template</DialogTitle>
            <DialogDescription>
              Choose the template scope for "{space.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => markAsTemplateMutation.mutate('organization')}
                disabled={markAsTemplateMutation.isPending}
                data-testid="button-org-template"
              >
                <Building2 className="h-4 w-4 mr-2" />
                <div className="text-left">
                  <div className="font-medium">Organization Template</div>
                  <div className="text-xs text-muted-foreground">Available only to this organization</div>
                </div>
              </Button>
              {currentUserRole === "global_admin" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => markAsTemplateMutation.mutate('system')}
                  disabled={markAsTemplateMutation.isPending}
                  data-testid="button-system-template"
                >
                  <FileStack className="h-4 w-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">System Template</div>
                    <div className="text-xs text-muted-foreground">Available to all organizations</div>
                  </div>
                </Button>
              )}
            </div>
            {markAsTemplateMutation.isPending && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
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

  // Fetch workspace templates (new simplified system using isTemplate flag)
  const { data: workspaceTemplates = [], isLoading } = useQuery<Space[]>({
    queryKey: ["/api/templates/spaces"],
  });

  // Unmark template mutation
  const unmarkTemplateMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const response = await apiRequest("POST", `/api/workspaces/${workspaceId}/unmark-as-template`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unmark template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates/spaces"] });
      toast({
        title: "Template unmarked",
        description: "The workspace is no longer a template",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unmark template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUnmark = (workspaceId: string) => {
    if (confirm("Are you sure you want to unmark this workspace as a template? It will be restored as a regular workspace.")) {
      unmarkTemplateMutation.mutate(workspaceId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workspaceTemplates.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
          <FileStack className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No templates yet</h3>
          <p className="text-sm max-w-md mx-auto mb-4">
            Workspace templates allow you to create pre-configured workspaces with seeded notes and knowledge base documents.
            Mark an existing workspace as a template from the workspace list below.
          </p>
          <p className="text-xs text-muted-foreground">
            {currentUser.role === "global_admin" 
              ? "Global admins can create system-wide templates available to all organizations."
              : "Company admins can create organization-specific templates."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group templates by scope
  const systemTemplates = workspaceTemplates.filter(t => t.templateScope === 'system');
  const orgTemplates = workspaceTemplates.filter(t => t.templateScope === 'organization');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Workspace Templates</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Reusable workspace configurations that can be deployed across organizations
        </p>
      </div>

      {systemTemplates.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">System Templates</h3>
            <p className="text-sm text-muted-foreground">Available to all organizations</p>
          </div>
          <div className="grid gap-4">
            {systemTemplates.map((template) => (
              <WorkspaceTemplateCard
                key={template.id}
                template={template}
                organization={null}
                onUnmark={handleUnmark}
                unmarkPending={unmarkTemplateMutation.isPending}
                currentUser={currentUser}
              />
            ))}
          </div>
        </div>
      )}

      {orgTemplates.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Organization Templates</h3>
            <p className="text-sm text-muted-foreground">Scoped to specific organizations</p>
          </div>
          <div className="grid gap-4">
            {orgTemplates.map((template) => {
              const org = organizations.find(o => o.id === template.organizationId);
              return (
                <WorkspaceTemplateCard
                  key={template.id}
                  template={template}
                  organization={org || null}
                  onUnmark={handleUnmark}
                  unmarkPending={unmarkTemplateMutation.isPending}
                  currentUser={currentUser}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceTemplateCard({
  template,
  organization,
  onUnmark,
  unmarkPending,
  currentUser,
}: {
  template: Space;
  organization: Organization | null;
  onUnmark: (id: string) => void;
  unmarkPending: boolean;
  currentUser: User;
}) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Fetch notes and categories for this template
  const { data: notes = [] } = useQuery<any[]>({
    queryKey: ["/api/spaces", template.id, "notes"],
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/spaces", template.id, "categories"],
  });

  const canUnmark = 
    currentUser.role === "global_admin" || 
    (template.templateScope === "organization" && 
     (currentUser.role === "company_admin" && currentUser.organizationId === template.organizationId));

  return (
    <>
      <Card data-testid={`card-template-${template.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <Badge 
                  variant={template.templateScope === 'system' ? 'default' : 'secondary'}
                  data-testid={`badge-scope-${template.id}`}
                >
                  {template.templateScope === 'system' ? 'System' : 'Organization'}
                </Badge>
                {organization && (
                  <Badge variant="outline" data-testid={`badge-org-${template.id}`}>
                    {organization.name}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{template.purpose}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span>{notes.length} notes</span>
                <span>{categories.length} categories</span>
                <span>Code: {template.code}</span>
                <span>Created {new Date(template.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
                data-testid={`button-edit-template-${template.id}`}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {canUnmark && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUnmark(template.id)}
                  disabled={unmarkPending}
                  data-testid={`button-unmark-${template.id}`}
                >
                  {unmarkPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Unmark as Template"
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <EditWorkspaceDialog
        space={template}
        organizationId={template.organizationId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
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

function NewOrganizationDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<z.infer<typeof insertOrganizationSchema>>({
    resolver: zodResolver(insertOrganizationSchema),
    defaultValues: {
      name: "",
      slug: "",
      logoUrl: undefined,
      primaryColor: undefined,
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertOrganizationSchema>) => {
      const response = await apiRequest("POST", "/api/organizations", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: "Organization created",
        description: "The new organization has been created successfully.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create organization",
        description: error.message || "Please try again",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-organization">
          <Plus className="h-4 w-4 mr-2" />
          New Organization
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Add a new organization to the platform.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createOrgMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Acme Corporation" 
                      {...field} 
                      data-testid="input-org-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (URL identifier)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., acme" 
                      {...field} 
                      data-testid="input-org-slug"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://example.com/logo.png" 
                      {...field} 
                      value={field.value || ""}
                      data-testid="input-org-logo"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primaryColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Color (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="#8B5CF6" 
                      {...field} 
                      value={field.value || ""}
                      data-testid="input-org-color"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                data-testid="button-cancel-org"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createOrgMutation.isPending}
                data-testid="button-submit-org"
              >
                {createOrgMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Organization"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function NewWorkspaceDialog({ 
  organizationId, 
  organizationSlug 
}: { 
  organizationId: string;
  organizationSlug: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  // Fetch workspace templates (new simplified system)
  // Include organizationId in query key to prevent cache collision between orgs
  const { data: allTemplates = [] } = useQuery<Space[]>({
    queryKey: ["/api/templates/spaces", organizationId],
    queryFn: async () => {
      const response = await fetch("/api/templates/spaces");
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  // Filter to show system templates + org-specific templates for this org
  const templates = allTemplates.filter(t => 
    t.templateScope === 'system' || t.organizationId === organizationId
  );
  
  const form = useForm<z.infer<typeof createSpaceApiSchema>>({
    resolver: zodResolver(createSpaceApiSchema),
    defaultValues: {
      organizationId,
      name: "",
      purpose: "",
      guestAllowed: false,
      hidden: false,
      status: "draft",
      sessionMode: "live",
      icon: "brain",
      templateId: undefined,
    },
  });

  const createSpaceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createSpaceApiSchema>) => {
      const response = await apiRequest("POST", "/api/spaces", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", organizationId, "spaces"] });
      toast({
        title: "Workspace created",
        description: "The new workspace has been created successfully.",
      });
      setOpen(false);
      form.reset({
        organizationId,
        name: "",
        purpose: "",
        guestAllowed: false,
        hidden: false,
        status: "draft",
        sessionMode: "live",
        icon: "brain",
        templateId: undefined,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create workspace",
        description: error.message || "Please try again",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid={`button-create-workspace-${organizationSlug}`}>
          <Plus className="h-4 w-4 mr-2" />
          New Workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Add a new collaborative workspace for this organization.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createSpaceMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Q1 Strategy Session" 
                      {...field} 
                      data-testid="input-workspace-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {templates.length > 0 && (
              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} 
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-template">
                          <SelectValue placeholder="Start from scratch or select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none" data-testid="template-option-none">
                          No template (blank workspace)
                        </SelectItem>
                        {templates.map((template) => (
                          <SelectItem 
                            key={template.id} 
                            value={template.id}
                            data-testid={`template-option-${template.id}`}
                          >
                            {template.name} {template.templateScope === 'system' ? '(System)' : '(Organization)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Clone notes, categories, and documents from an existing template
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose / Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the goal of this workspace..." 
                      {...field} 
                      data-testid="input-workspace-purpose"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="guestAllowed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-guest-allowed"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Allow Guest Access
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Anonymous users can join this workspace without creating an account
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                data-testid="button-cancel-workspace"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createSpaceMutation.isPending}
                data-testid="button-submit-workspace"
              >
                {createSpaceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Workspace"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditWorkspaceDialog({ 
  space,
  organizationId,
  open,
  onOpenChange
}: { 
  space: Space;
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<{ name: string; purpose: string; guestAllowed: boolean }>({
    resolver: zodResolver(z.object({
      name: z.string().min(1, "Name is required"),
      purpose: z.string().min(1, "Purpose is required"),
      guestAllowed: z.boolean(),
    })),
    defaultValues: {
      name: space.name,
      purpose: space.purpose || "",
      guestAllowed: space.guestAllowed ?? false,
    },
  });

  const updateSpaceMutation = useMutation({
    mutationFn: async (data: { name: string; purpose: string; guestAllowed: boolean }) => {
      const response = await apiRequest("PATCH", `/api/spaces/${space.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", organizationId, "spaces"] });
      toast({
        title: "Workspace updated",
        description: "The workspace has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update workspace",
        description: error.message || "Please try again",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Workspace</DialogTitle>
          <DialogDescription>
            Update the workspace details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateSpaceMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Q1 Strategy Session" 
                      {...field} 
                      data-testid="input-edit-workspace-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose / Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the goal of this workspace..." 
                      {...field} 
                      data-testid="input-edit-workspace-purpose"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="guestAllowed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-edit-guest-allowed"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Allow Guest Access
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Anonymous users can join this workspace without creating an account
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-workspace"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateSpaceMutation.isPending}
                data-testid="button-submit-edit-workspace"
              >
                {updateSpaceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteWorkspaceDialog({
  space,
  open,
  onOpenChange
}: {
  space: Space;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  // Fetch workspace dependencies
  const { data: dependencies, isLoading: loadingDeps } = useQuery<{
    notesCount: number;
    votesCount: number;
    rankingsCount: number;
    marketplaceAllocationsCount: number;
    participantsCount: number;
    accessRequestsCount: number;
  }>({
    queryKey: ["/api/spaces", space.id, "dependencies"],
    enabled: open,
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/spaces/${space.id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete workspace");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", space.organizationId, "spaces"] });
      toast({
        title: "Workspace deleted",
        description: "The workspace has been permanently deleted.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete workspace",
        description: error.message || "Please try again",
      });
    },
  });

  const totalDependencies = dependencies 
    ? dependencies.notesCount + dependencies.votesCount + dependencies.rankingsCount + dependencies.marketplaceAllocationsCount 
    : 0;

  const hasDependencies = totalDependencies > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Workspace
          </DialogTitle>
          <DialogDescription>
            {loadingDeps ? (
              "Checking workspace data..."
            ) : hasDependencies ? (
              "This workspace contains data that will be permanently deleted."
            ) : (
              "Are you sure you want to delete this workspace?"
            )}
          </DialogDescription>
        </DialogHeader>

        {loadingDeps ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="font-medium mb-2">{space.name}</p>
              <p className="text-sm text-muted-foreground">Code: {space.code}</p>
            </div>

            {hasDependencies && dependencies && (
              <>
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                  <p className="font-medium text-destructive mb-3">⚠️ Warning: This workspace contains data</p>
                  <div className="space-y-2 text-sm">
                    {dependencies.notesCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ideas/Notes:</span>
                        <span className="font-medium">{dependencies.notesCount}</span>
                      </div>
                    )}
                    {dependencies.votesCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Votes:</span>
                        <span className="font-medium">{dependencies.votesCount}</span>
                      </div>
                    )}
                    {dependencies.rankingsCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rankings:</span>
                        <span className="font-medium">{dependencies.rankingsCount}</span>
                      </div>
                    )}
                    {dependencies.marketplaceAllocationsCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Marketplace Allocations:</span>
                        <span className="font-medium">{dependencies.marketplaceAllocationsCount}</span>
                      </div>
                    )}
                    {dependencies.participantsCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Participants:</span>
                        <span className="font-medium">{dependencies.participantsCount}</span>
                      </div>
                    )}
                    {dependencies.accessRequestsCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Access Requests:</span>
                        <span className="font-medium">{dependencies.accessRequestsCount}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-primary/5 p-4">
                  <p className="text-sm font-medium mb-1">💡 Consider archiving instead</p>
                  <p className="text-sm text-muted-foreground">
                    Archiving hides the workspace but preserves all data. You can unarchive it later if needed.
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-delete-workspace"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteWorkspaceMutation.mutate()}
                disabled={deleteWorkspaceMutation.isPending}
                data-testid="button-confirm-delete-workspace"
              >
                {deleteWorkspaceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Permanently
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditOrganizationDialog({ 
  organization,
  open,
  onOpenChange
}: { 
  organization: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof insertOrganizationSchema>>({
    resolver: zodResolver(insertOrganizationSchema),
    defaultValues: {
      name: organization.name,
      slug: organization.slug,
      logoUrl: organization.logoUrl || "",
      primaryColor: organization.primaryColor || "",
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertOrganizationSchema>) => {
      const response = await apiRequest("PATCH", `/api/organizations/${organization.id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({
        title: "Organization updated",
        description: "The organization has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update organization",
        description: error.message || "Please try again",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>
            Update the organization details.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateOrgMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Acme Corporation" 
                      {...field} 
                      data-testid="input-edit-org-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (URL identifier)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., acme" 
                      {...field} 
                      data-testid="input-edit-org-slug"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://example.com/logo.png" 
                      {...field} 
                      value={field.value || ""}
                      data-testid="input-edit-org-logo"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primaryColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Color (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="#8B5CF6" 
                      {...field} 
                      value={field.value || ""}
                      data-testid="input-edit-org-color"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-org"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateOrgMutation.isPending}
                data-testid="button-submit-edit-org"
              >
                {updateOrgMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Create User Dialog Component
function CreateUserDialog({ open, onOpenChange, currentUser, organizations }: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  organizations: Organization[];
}) {
  const { toast } = useToast();
  
  const createUserSchema = insertUserSchema.extend({
    password: z.string().min(8, "Password must be at least 8 characters"),
  });
  
  const form = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      username: "",
      displayName: "",
      password: "",
      role: "user",
      organizationId: currentUser.role === "company_admin" ? currentUser.organizationId || null : null,
      emailVerified: false,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createUserSchema>) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "The user has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-user">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the platform with specified role and organization.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="user@example.com" {...field} data-testid="input-create-user-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="johndoe" {...field} data-testid="input-create-user-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} value={field.value || ""} data-testid="input-create-user-displayname" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} data-testid="input-create-user-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={currentUser.role === "company_admin"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-user-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currentUser.role === "global_admin" && (
                        <>
                          <SelectItem value="global_admin">Global Admin</SelectItem>
                          <SelectItem value="company_admin">Company Admin</SelectItem>
                        </>
                      )}
                      <SelectItem value="facilitator">Facilitator</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization (optional)</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "none" ? null : value)} 
                    value={field.value || "none"} 
                    disabled={currentUser.role === "company_admin"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-create-user-org">
                        <SelectValue placeholder="No organization" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No organization</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emailVerified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-create-user-verified"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Email Verified</FormLabel>
                    <FormDescription>
                      Mark this user's email as verified (skip email verification)
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create-user">
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-create-user">
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Edit User Dialog Component
function EditUserDialog({ user, open, onOpenChange, currentUser, organizations }: {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  organizations: Organization[];
}) {
  const { toast } = useToast();
  
  const updateUserSchema = insertUserSchema.partial().omit({ password: true });
  
  const form = useForm<z.infer<typeof updateUserSchema>>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      email: user?.email || "",
      username: user?.username || "",
      displayName: user?.displayName || "",
      role: user?.role || "user",
      organizationId: user?.organizationId || null,
      emailVerified: user?.emailVerified || false,
    },
  });

  // Update form when user prop changes
  if (user && form.getValues().email !== user.email) {
    form.reset({
      email: user.email,
      username: user.username,
      displayName: user.displayName || "",
      role: user.role,
      organizationId: user.organizationId || null,
      emailVerified: user.emailVerified,
    });
  }

  const updateUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateUserSchema>) => {
      if (!user) throw new Error("No user selected");
      return apiRequest("PATCH", `/api/admin/users/${user.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "The user has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-user">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information, role, and organization assignment.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => updateUserMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-user-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-user-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-user-displayname" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={currentUser.role === "company_admin"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-user-role">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currentUser.role === "global_admin" && (
                        <>
                          <SelectItem value="global_admin">Global Admin</SelectItem>
                          <SelectItem value="company_admin">Company Admin</SelectItem>
                        </>
                      )}
                      <SelectItem value="facilitator">Facilitator</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="organizationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization (optional)</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(value === "none" ? null : value)} 
                    value={field.value || "none"} 
                    disabled={currentUser.role === "company_admin"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-user-org">
                        <SelectValue placeholder="No organization" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No organization</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emailVerified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-edit-user-verified"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Email Verified</FormLabel>
                    <FormDescription>
                      Mark this user's email as verified
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit-user">
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-submit-edit-user">
                {updateUserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Delete User Dialog Component
function DeleteUserDialog({ user, open, onOpenChange }: {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user selected");
      return apiRequest("DELETE", `/api/admin/users/${user.id}`);
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user has been permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-delete-user">
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete this user?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="font-medium">{user.displayName || user.username}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Badge className="mt-2" variant="outline">{user.role}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All data associated with this user will be permanently deleted.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-delete-user">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteUserMutation.mutate()}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete-user"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Permanently"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Reset Password Dialog Component
function ResetPasswordDialog({ user, open, onOpenChange }: {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user selected");
      return apiRequest("POST", `/api/admin/users/${user.id}/reset-password`, { newPassword });
    },
    onSuccess: () => {
      toast({
        title: "Password reset",
        description: "The user's password has been reset successfully.",
      });
      setNewPassword("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-reset-password">
        <DialogHeader>
          <DialogTitle>Reset User Password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.displayName || user.username}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="font-medium">{user.displayName || user.username}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium">New Password</label>
            <Input
              id="new-password"
              type="password"
              placeholder="Enter new password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              data-testid="input-reset-password"
            />
            {newPassword && newPassword.length < 8 && (
              <p className="text-sm text-destructive">Password must be at least 8 characters</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-reset-password">
              Cancel
            </Button>
            <Button 
              onClick={() => resetPasswordMutation.mutate()}
              disabled={resetPasswordMutation.isPending || newPassword.length < 8}
              data-testid="button-confirm-reset-password"
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UsersTab() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ["/api/admin/organizations"],
    enabled: currentUser?.role === "global_admin",
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dialogs */}
      {currentUser && (
        <>
          <CreateUserDialog 
            open={createDialogOpen} 
            onOpenChange={setCreateDialogOpen}
            currentUser={currentUser}
            organizations={organizations}
          />
          <EditUserDialog 
            user={selectedUser}
            open={editDialogOpen} 
            onOpenChange={setEditDialogOpen}
            currentUser={currentUser}
            organizations={organizations}
          />
          <DeleteUserDialog 
            user={selectedUser}
            open={deleteDialogOpen} 
            onOpenChange={setDeleteDialogOpen}
          />
          <ResetPasswordDialog 
            user={selectedUser}
            open={resetPasswordDialogOpen} 
            onOpenChange={setResetPasswordDialogOpen}
          />
        </>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">All Users</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} user{users.length !== 1 ? 's' : ''} registered on the platform
          </p>
        </div>
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          data-testid="button-create-user"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No users found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {users.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  data-testid={`user-row-${user.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate" data-testid={`user-name-${user.id}`}>
                          {user.displayName || user.username}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`user-email-${user.id}`}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={user.role === "global_admin" ? "default" : user.role === "company_admin" ? "secondary" : "outline"}
                      data-testid={`user-role-${user.id}`}
                    >
                      {user.role === "global_admin" ? "Global Admin" : 
                       user.role === "company_admin" ? "Company Admin" : 
                       user.role === "facilitator" ? "Facilitator" : "User"}
                    </Badge>
                    {user.emailVerified ? (
                      <Badge variant="outline" className="text-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(user);
                          setEditDialogOpen(true);
                        }}
                        data-testid={`button-edit-user-${user.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(user);
                          setResetPasswordDialogOpen(true);
                        }}
                        data-testid={`button-reset-password-${user.id}`}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(user);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={currentUser.id === user.id}
                        data-testid={`button-delete-user-${user.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// System Settings Tab Component (Global Admin only)
function SystemSettingsTab({ currentUser }: { currentUser: User }) {
  const { toast } = useToast();
  
  // Fetch all system settings
  const { data: settings = [], isLoading } = useQuery<SystemSetting[]>({
    queryKey: ["/api/admin/system-settings"],
    enabled: currentUser?.role === "global_admin",
  });

  // Find OAuth setting
  const oauthSetting = settings.find(s => s.key === "oauth_enabled");
  const isOAuthEnabled = oauthSetting?.value === true;

  // Toggle OAuth mutation
  const toggleOAuthMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest("PUT", "/api/admin/system-settings/oauth_enabled", {
        value: enabled,
        description: "System-wide OAuth/SSO toggle"
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/oauth-status"] });
      toast({
        title: "Setting updated",
        description: `OAuth/SSO has been ${isOAuthEnabled ? "disabled" : "enabled"}.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update setting",
        description: error.message || "Please try again",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading system settings...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Authentication Settings
          </CardTitle>
          <CardDescription>
            Control system-wide authentication options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OAuth/SSO Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="oauth-toggle" className="font-medium">
                  OAuth/SSO Authentication
                </Label>
                <Badge variant={isOAuthEnabled ? "default" : "secondary"}>
                  {isOAuthEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Allow users to sign in with their Synozur account. When disabled, only local email/password authentication is available.
              </p>
              {!isOAuthEnabled && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  ⚠️ OAuth is currently disabled. The "Sign in with Synozur account" button will not appear on the login page.
                </p>
              )}
            </div>
            <Switch
              id="oauth-toggle"
              checked={isOAuthEnabled}
              onCheckedChange={(checked) => toggleOAuthMutation.mutate(checked)}
              disabled={toggleOAuthMutation.isPending}
              data-testid="switch-oauth-enabled"
            />
          </div>

          {/* Additional system settings can be added here */}
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="border-muted-foreground/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <BookOpen className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">About OAuth Configuration</p>
              <p className="mb-2">
                OAuth/SSO allows users to authenticate using their Synozur account instead of creating a separate password. This provides:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Centralized authentication across Synozur applications</li>
                <li>Automatic role mapping from Orion identity provider</li>
                <li>Seamless user provisioning and updates</li>
              </ul>
              <p className="mt-3">
                For OAuth setup instructions, see <code className="text-xs bg-muted px-1 py-0.5 rounded">OAUTH_CONFIGURATION_NOTES.md</code> in the project root.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
