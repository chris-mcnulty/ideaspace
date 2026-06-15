import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Share2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OrgMember {
  id: string;
  displayName: string | null;
  username: string;
  email: string;
}

interface ProjectMemberFull {
  userId: string;
  role: string;
  user: { displayName: string | null; username: string; email: string };
}

interface ProjectShareDialogProps {
  projectId: string;
  projectName: string;
  orgId: string;
  onClose: () => void;
}

export function ProjectShareDialog({ projectId, projectName, orgId, onClose }: ProjectShareDialogProps) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"member" | "admin">("member");

  const membersKey = ["/api/projects", projectId, "members"];

  const { data: members = [], isLoading: membersLoading } = useQuery<ProjectMemberFull[]>({
    queryKey: membersKey,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load members");
      return res.json();
    },
  });

  const { data: orgMembers = [] } = useQuery<OrgMember[]>({
    queryKey: ["/api/organizations", orgId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${orgId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load org members");
      return res.json();
    },
  });

  const addMember = useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      apiRequest("POST", `/api/projects/${projectId}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey });
      setSelectedUserId("");
      toast({ title: "Member added" });
    },
    onError: (e: any) => toast({ title: "Could not add member", description: e?.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("DELETE", `/api/projects/${projectId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey });
      toast({ title: "Member removed" });
    },
    onError: (e: any) => toast({ title: "Could not remove member", description: e?.message, variant: "destructive" }),
  });

  const memberUserIds = new Set(members.map((m) => m.userId));
  const available = orgMembers.filter((u) => !memberUserIds.has(u.id));
  const displayName = (u: { displayName: string | null; username: string; email: string }) =>
    u.displayName || u.username || u.email;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share "{projectName}"
          </DialogTitle>
          <DialogDescription>
            Add or remove org members from this project. Members can access all workspaces within it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 items-center">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="flex-1" data-testid="select-share-user">
              <SelectValue placeholder="Select a member to add…" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <SelectItem value="__none__" disabled>All org members already added</SelectItem>
              ) : (
                available.map((u) => (
                  <SelectItem key={u.id} value={u.id} data-testid={`option-share-user-${u.id}`}>
                    {displayName(u)} <span className="text-muted-foreground">({u.email})</span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "member" | "admin")}>
            <SelectTrigger className="w-[110px]" data-testid="select-share-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="icon"
            disabled={!selectedUserId || addMember.isPending}
            onClick={() => addMember.mutate({ userId: selectedUserId, role: selectedRole })}
            data-testid="button-share-add"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {membersLoading ? "Loading…" : `${members.length} member${members.length !== 1 ? "s" : ""}`}
          </p>
          {members.length === 0 && !membersLoading && (
            <p className="text-sm text-muted-foreground py-2 text-center">
              No members yet. Add someone above.
            </p>
          )}
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-3 rounded-md border px-3 py-2" data-testid={`member-row-${m.userId}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName(m.user)}</p>
                <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 capitalize">{m.role}</Badge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeMember.mutate(m.userId)}
                disabled={removeMember.isPending}
                data-testid={`button-remove-member-${m.userId}`}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
