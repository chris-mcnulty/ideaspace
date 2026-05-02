import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Upload, FileText, Trash2, Download, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeBaseDocument, Space } from "@shared/schema";

interface KnowledgeBaseManagerProps {
  scope: 'system' | 'organization' | 'workspace';
  scopeId?: string;
  title?: string;
  description?: string;
}

export function KnowledgeBaseManager({ scope, scopeId, title, description }: KnowledgeBaseManagerProps) {
  const { toast } = useToast();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [workspaceSelectionMode, setWorkspaceSelectionMode] = useState<'all' | 'specific'>('all');
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce search input to avoid hammering the FTS endpoint on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  interface KbSearchHit {
    id: string;
    documentId: string;
    documentTitle: string;
    chunkIndex: number;
    snippet: string;
    rank: number;
  }

  const { data: searchData, isFetching: searchFetching } = useQuery<{ query: string; results: KbSearchHit[] }>({
    queryKey: ['/api/knowledge-base/search', scope, scopeId, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('q', searchQuery);
      params.append('scope', scope);
      if (scopeId) params.append('scopeId', scopeId);
      const response = await fetch(`/api/knowledge-base/search?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const queryKey = scopeId
    ? ["/api/knowledge-base/documents", scope, scopeId]
    : ["/api/knowledge-base/documents", scope];

  const { data: documents = [], isLoading } = useQuery<KnowledgeBaseDocument[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('scope', scope);
      if (scopeId) {
        params.append('scopeId', scopeId);
      }
      const response = await fetch(`/api/knowledge-base/documents?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      return response.json();
    },
  });

  // Fetch workspaces when scope is organization
  const { data: workspaces = [] } = useQuery<Space[]>({
    queryKey: ['/api/organizations', scopeId, 'spaces'],
    queryFn: async () => {
      if (scope !== 'organization' || !scopeId) {
        return [];
      }
      const response = await fetch(`/api/organizations/${scopeId}/spaces`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }
      return response.json();
    },
    enabled: scope === 'organization' && !!scopeId,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !documentTitle) {
        throw new Error("File and title are required");
      }

      // Validate specific workspace selection
      if (scope === 'organization' && workspaceSelectionMode === 'specific' && selectedWorkspaceIds.length === 0) {
        throw new Error("Please select at least one workspace");
      }

      const formData = new FormData();
      formData.append('file', file);
      
      // Determine the actual scope to use
      const actualScope = scope === 'organization' && workspaceSelectionMode === 'specific' 
        ? 'multi_workspace' 
        : scope;
      
      const metadata = {
        title: documentTitle,
        description: documentDescription || undefined,
        scope: actualScope,
        ...(actualScope === 'organization' && scopeId ? { organizationId: scopeId } : {}),
        ...(actualScope === 'workspace' && scopeId ? { spaceId: scopeId } : {}),
        ...(actualScope === 'multi_workspace' && scopeId ? { 
          organizationId: scopeId,
          spaceIds: selectedWorkspaceIds 
        } : {}),
      };
      
      formData.append('metadata', JSON.stringify(metadata));

      const response = await fetch('/api/knowledge-base/documents', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload document');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
      setIsUploadOpen(false);
      setFile(null);
      setDocumentTitle("");
      setDocumentDescription("");
      setWorkspaceSelectionMode('all');
      setSelectedWorkspaceIds([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/knowledge-base/documents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card data-testid="knowledge-base-manager">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title || "Knowledge Base Documents"}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-document">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>
                  Upload a document to the knowledge base. Supported formats: PDF, TXT, DOC, DOCX, XLS, XLSX
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.txt,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) {
                        setFile(selectedFile);
                        if (!documentTitle) {
                          setDocumentTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
                        }
                      }
                    }}
                    data-testid="input-file"
                  />
                </div>
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    placeholder="Document title"
                    data-testid="input-title"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={documentDescription}
                    onChange={(e) => setDocumentDescription(e.target.value)}
                    placeholder="Brief description of the document"
                    data-testid="input-description"
                  />
                </div>

                {/* Workspace selection for organization scope */}
                {scope === 'organization' && workspaces.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <Label>Workspace Access</Label>
                    <RadioGroup
                      value={workspaceSelectionMode}
                      onValueChange={(value) => {
                        setWorkspaceSelectionMode(value as 'all' | 'specific');
                        if (value === 'all') {
                          setSelectedWorkspaceIds([]);
                        }
                      }}
                      data-testid="radio-workspace-mode"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="all-workspaces" data-testid="radio-all-workspaces" />
                        <Label htmlFor="all-workspaces" className="font-normal cursor-pointer">
                          All workspaces in organization
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="specific" id="specific-workspaces" data-testid="radio-specific-workspaces" />
                        <Label htmlFor="specific-workspaces" className="font-normal cursor-pointer">
                          Select specific workspaces
                        </Label>
                      </div>
                    </RadioGroup>

                    {workspaceSelectionMode === 'specific' && (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">
                          Select workspaces ({selectedWorkspaceIds.length} selected)
                        </Label>
                        <ScrollArea className="h-48 rounded-md border p-3">
                          <div className="space-y-2">
                            {workspaces.map((workspace) => (
                              <div key={workspace.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`workspace-${workspace.id}`}
                                  checked={selectedWorkspaceIds.includes(workspace.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedWorkspaceIds([...selectedWorkspaceIds, workspace.id]);
                                    } else {
                                      setSelectedWorkspaceIds(selectedWorkspaceIds.filter(id => id !== workspace.id));
                                    }
                                  }}
                                  data-testid={`checkbox-workspace-${workspace.id}`}
                                />
                                <Label
                                  htmlFor={`workspace-${workspace.id}`}
                                  className="text-sm font-normal cursor-pointer flex-1"
                                >
                                  <div>{workspace.name}</div>
                                  {workspace.purpose && (
                                    <div className="text-xs text-muted-foreground">{workspace.purpose}</div>
                                  )}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsUploadOpen(false)}
                  data-testid="button-cancel-upload"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!file || !documentTitle || uploadMutation.isPending}
                  data-testid="button-confirm-upload"
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search inside documents..."
              className="pl-9 pr-9"
              data-testid="input-kb-search"
            />
            {searchInput && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchInput("")}
                data-testid="button-kb-search-clear"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {searchQuery.length >= 2 && (
            <div className="mt-3 space-y-2" data-testid="kb-search-results">
              {searchFetching ? (
                <p className="text-sm text-muted-foreground">Searching...</p>
              ) : !searchData || searchData.results.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-kb-search-empty">
                  No matches found.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {searchData.results.length} match{searchData.results.length === 1 ? '' : 'es'}
                  </p>
                  {searchData.results.map((hit) => (
                    <div
                      key={hit.id}
                      className="rounded-md border p-3"
                      data-testid={`kb-search-hit-${hit.id}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">{hit.documentTitle}</span>
                        <Badge variant="outline" className="text-xs">chunk {hit.chunkIndex + 1}</Badge>
                      </div>
                      <p
                        className="text-sm text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground"
                        // ts_headline returns <b>...</b> wrappers around matches; safe because Postgres only injects bold tags around our own content.
                        dangerouslySetInnerHTML={{ __html: hit.snippet }}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="loading-documents">
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="empty-documents">
            No documents uploaded yet. Upload your first document to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <Card key={doc.id} className="hover-elevate" data-testid={`document-${doc.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate" data-testid={`text-document-title-${doc.id}`}>
                          {doc.title}
                        </h4>
                        {doc.description && (
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`text-document-description-${doc.id}`}>
                            {doc.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-xs" data-testid={`badge-scope-${doc.id}`}>
                            {doc.scope}
                          </Badge>
                          <span className="text-xs text-muted-foreground" data-testid={`text-filesize-${doc.id}`}>
                            {formatFileSize(doc.fileSize)}
                          </span>
                          <span className="text-xs text-muted-foreground" data-testid={`text-date-${doc.id}`}>
                            {formatDate(doc.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this document?')) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
