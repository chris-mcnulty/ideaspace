import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onCreated?: () => void;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  onCreated,
}: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/organizations/${organizationId}/projects`, {
        name: name.trim(),
        description: description.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-projects/detailed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-organizations"] });
      toast({ title: "Project created", description: `"${name.trim()}" has been created.` });
      setName("");
      setDescription("");
      onOpenChange(false);
      onCreated?.();
    },
    onError: async (err: any) => {
      let message = "An unexpected error occurred.";
      try {
        const body = await err.json?.();
        if (body?.error) message = body.error;
      } catch {}
      toast({ variant: "destructive", title: "Failed to create project", description: message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || createMutation.isPending) return;
    createMutation.mutate();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName("");
      setDescription("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a new project in <strong>{organizationName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="new-project-name">Project name</Label>
            <Input
              id="new-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 Strategy"
              autoFocus
              required
              data-testid="input-project-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-project-description">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="new-project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project for?"
              rows={3}
              data-testid="input-project-description"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              data-testid="button-cancel-project"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              data-testid="button-submit-project"
            >
              {createMutation.isPending ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
