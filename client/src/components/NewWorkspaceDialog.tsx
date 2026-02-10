import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSpaceApiSchema } from "@shared/schema";
import type { Project, Space } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface NewWorkspaceDialogProps {
  organizationId: string;
  organizationSlug: string;
  defaultProjectId?: string;
  trigger?: React.ReactNode;
  onSuccess?: (space: any) => void;
}

export function NewWorkspaceDialog({
  organizationId,
  organizationSlug,
  defaultProjectId,
  trigger,
  onSuccess,
}: NewWorkspaceDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/organizations", organizationId, "projects"],
    enabled: open,
  });

  const { data: allTemplates = [] } = useQuery<Space[]>({
    queryKey: ["/api/templates/spaces", organizationId],
    queryFn: async () => {
      const response = await fetch("/api/templates/spaces");
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
    enabled: open,
  });

  const templates = allTemplates.filter(t =>
    t.templateScope === 'system' || t.organizationId === organizationId
  );

  const resolvedProjectId = defaultProjectId || projects.find(p => p.isDefault)?.id || undefined;

  const form = useForm<z.infer<typeof createSpaceApiSchema>>({
    resolver: zodResolver(createSpaceApiSchema),
    defaultValues: {
      organizationId,
      projectId: resolvedProjectId,
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

  useEffect(() => {
    if (open && resolvedProjectId) {
      form.setValue("projectId", resolvedProjectId);
    }
  }, [open, resolvedProjectId]);

  const createSpaceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createSpaceApiSchema>) => {
      const response = await apiRequest("POST", "/api/spaces", data);
      return await response.json();
    },
    onSuccess: (newSpace) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", organizationId, "spaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/facilitator/workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-projects/detailed"] });
      toast({
        title: "Workspace created",
        description: "The new workspace has been created successfully.",
      });
      setOpen(false);
      form.reset({
        organizationId,
        projectId: resolvedProjectId,
        name: "",
        purpose: "",
        guestAllowed: false,
        hidden: false,
        status: "draft",
        sessionMode: "live",
        icon: "brain",
        templateId: undefined,
      });
      if (onSuccess) {
        onSuccess(newSpace);
      } else if (newSpace?.code) {
        setLocation(`/o/${organizationSlug}/s/${newSpace.code}/facilitate`);
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create workspace",
        description: error.message || "Please try again",
      });
    },
  });

  const defaultTrigger = (
    <Button size="sm" data-testid={`button-create-workspace-${organizationSlug}`}>
      <Plus className="h-4 w-4 mr-2" />
      New Workspace
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
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
            {projects.length > 0 && (
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-project">
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none" data-testid="project-option-none">
                          No project
                        </SelectItem>
                        {projects.map((project) => (
                          <SelectItem
                            key={project.id}
                            value={project.id}
                            data-testid={`project-option-${project.id}`}
                          >
                            {project.name} {project.isDefault ? '(Default)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
