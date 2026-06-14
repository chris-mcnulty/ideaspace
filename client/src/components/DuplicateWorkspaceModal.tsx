import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DuplicateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  onSuccess?: (newWorkspace: { id: string; name: string; code: string }) => void;
}

type DuplicateMode = "structure_only" | "full_copy";

const MODE_OPTIONS: { value: DuplicateMode; label: string; description: string }[] = [
  {
    value: "structure_only",
    label: "Structure only",
    description:
      "Copies settings, module configuration, categories, and knowledge-base links. No ideas, votes, or participant data — ideal for rerunning the same workshop design with a fresh cohort.",
  },
  {
    value: "full_copy",
    label: "Full copy with responses",
    description:
      "Copies everything above plus all ideas, votes, rankings, allocations, module placements, and Signal responses. Responses are retained but de-linked from specific participant accounts. Useful for forking a live session or archiving a working copy.",
  },
];

export function DuplicateWorkspaceModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  onSuccess,
}: DuplicateWorkspaceModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(`Copy of ${workspaceName}`);
  const [mode, setMode] = useState<DuplicateMode>("structure_only");

  // Sync name whenever the modal opens or targets a different workspace
  useEffect(() => {
    if (open) {
      setName(`Copy of ${workspaceName}`);
      setMode("structure_only");
    }
  }, [open, workspaceName]);

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/spaces/${workspaceId}/duplicate`, {
        name: name.trim(),
        mode,
      });
      return res.json();
    },
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spaces"] });
      toast({
        title: "Workspace duplicated",
        description: `"${newWorkspace.name}" has been created successfully.`,
      });
      onOpenChange(false);
      onSuccess?.(newWorkspace);
    },
    onError: (error: any) => {
      toast({
        title: "Duplication failed",
        description: error?.message ?? "Could not duplicate the workspace. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!duplicateMutation.isPending) {
      if (open) {
        setName(`Copy of ${workspaceName}`);
        setMode("structure_only");
      }
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Duplicate Workspace</DialogTitle>
          <DialogDescription>
            Create a copy of <strong>{workspaceName}</strong>. Choose what to include in the new workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="duplicate-name">New workspace name</Label>
            <Input
              id="duplicate-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name for the new workspace"
              disabled={duplicateMutation.isPending}
              data-testid="input-duplicate-name"
            />
          </div>

          {/* Copy mode selection */}
          <div className="space-y-3">
            <Label>Copy mode</Label>
            <div className="space-y-2">
              {MODE_OPTIONS.map((option) => {
                const selected = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    disabled={duplicateMutation.isPending}
                    data-testid={`button-mode-${option.value}`}
                    className={[
                      "w-full text-left rounded-md border p-4 transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover-elevate",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center",
                          selected ? "border-primary" : "border-muted-foreground/50",
                        ].join(" ")}
                      >
                        {selected && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none mb-1">{option.label}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={duplicateMutation.isPending}
            data-testid="button-duplicate-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={() => duplicateMutation.mutate()}
            disabled={duplicateMutation.isPending || !name.trim()}
            data-testid="button-duplicate-confirm"
          >
            {duplicateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Duplicating…
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
