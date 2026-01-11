import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Mail,
  Send,
  Users,
  Bell,
  Trophy,
  Loader2,
  Plus,
  X,
  UserPlus,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { Participant } from "@shared/schema";

interface NotificationPanelProps {
  spaceId: string;
  participants: Participant[];
  currentPhase?: string;
}

interface InviteRecipient {
  email: string;
  name: string;
  role: 'participant' | 'facilitator';
}

export function NotificationPanel({ spaceId, participants, currentPhase }: NotificationPanelProps) {
  const { toast } = useToast();
  
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [bulkInviteDialogOpen, setBulkInviteDialogOpen] = useState(false);
  const [phaseChangeDialogOpen, setPhaseChangeDialogOpen] = useState(false);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<'participant' | 'facilitator'>('participant');
  const [inviteMessage, setInviteMessage] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  
  const [bulkRecipients, setBulkRecipients] = useState<InviteRecipient[]>([]);
  const [bulkEmail, setBulkEmail] = useState("");
  const [bulkName, setBulkName] = useState("");
  const [bulkRole, setBulkRole] = useState<'participant' | 'facilitator'>('participant');
  const [bulkMessage, setBulkMessage] = useState("");
  
  const [newPhase, setNewPhase] = useState("");
  const [phaseDescription, setPhaseDescription] = useState("");
  const [phaseDeadline, setPhaseDeadline] = useState("");

  const emailableParticipants = participants.filter(p => p.email);

  const sendInviteMutation = useMutation({
    mutationFn: async (data: { email: string; name: string; role: string; personalMessage?: string; sessionDate?: string; sessionTime?: string }) => {
      return await apiRequest("POST", `/api/spaces/${spaceId}/notifications/invite`, data);
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent",
        description: `Invitation email sent to ${inviteEmail}`,
      });
      setInviteDialogOpen(false);
      resetInviteForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Invitation",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const sendBulkInviteMutation = useMutation({
    mutationFn: async (data: { recipients: InviteRecipient[]; personalMessage?: string; sessionDate?: string; sessionTime?: string }) => {
      return await apiRequest("POST", `/api/spaces/${spaceId}/notifications/invite-bulk`, data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Invitations Sent",
        description: `Successfully sent ${data.sent} invitation${data.sent !== 1 ? 's' : ''}${data.failed > 0 ? `, ${data.failed} failed` : ''}`,
      });
      setBulkInviteDialogOpen(false);
      resetBulkInviteForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Invitations",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const sendPhaseChangeMutation = useMutation({
    mutationFn: async (data: { previousPhase?: string; newPhase: string; phaseDescription?: string; deadline?: string }) => {
      return await apiRequest("POST", `/api/spaces/${spaceId}/notifications/phase-change`, data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Phase Change Notifications Sent",
        description: `Notified ${data.sent} participant${data.sent !== 1 ? 's' : ''} about the phase change`,
      });
      setPhaseChangeDialogOpen(false);
      resetPhaseChangeForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Notifications",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const sendResultsReadyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/spaces/${spaceId}/notifications/results-ready`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Results Notifications Sent",
        description: `Notified ${data.sent} participant${data.sent !== 1 ? 's' : ''} that results are ready`,
      });
      setResultsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Notifications",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteRole('participant');
    setInviteMessage("");
    setSessionDate("");
    setSessionTime("");
  };

  const resetBulkInviteForm = () => {
    setBulkRecipients([]);
    setBulkEmail("");
    setBulkName("");
    setBulkRole('participant');
    setBulkMessage("");
  };

  const resetPhaseChangeForm = () => {
    setNewPhase("");
    setPhaseDescription("");
    setPhaseDeadline("");
  };

  const addBulkRecipient = () => {
    if (bulkEmail && bulkName) {
      setBulkRecipients([...bulkRecipients, { email: bulkEmail, name: bulkName, role: bulkRole }]);
      setBulkEmail("");
      setBulkName("");
    }
  };

  const removeBulkRecipient = (index: number) => {
    setBulkRecipients(bulkRecipients.filter((_, i) => i !== index));
  };

  const handleSendInvite = () => {
    if (!inviteEmail || !inviteName) {
      toast({
        title: "Missing Information",
        description: "Please provide both email and name",
        variant: "destructive",
      });
      return;
    }
    sendInviteMutation.mutate({
      email: inviteEmail,
      name: inviteName,
      role: inviteRole,
      personalMessage: inviteMessage || undefined,
      sessionDate: sessionDate || undefined,
      sessionTime: sessionTime || undefined,
    });
  };

  const handleSendBulkInvites = () => {
    if (bulkRecipients.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please add at least one recipient",
        variant: "destructive",
      });
      return;
    }
    sendBulkInviteMutation.mutate({
      recipients: bulkRecipients,
      personalMessage: bulkMessage || undefined,
      sessionDate: sessionDate || undefined,
      sessionTime: sessionTime || undefined,
    });
  };

  const handleSendPhaseChange = () => {
    if (!newPhase) {
      toast({
        title: "Missing Phase",
        description: "Please select a phase",
        variant: "destructive",
      });
      return;
    }
    sendPhaseChangeMutation.mutate({
      previousPhase: currentPhase,
      newPhase,
      phaseDescription: phaseDescription || undefined,
      deadline: phaseDeadline || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Send email notifications to participants
          {emailableParticipants.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {emailableParticipants.length} with email
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start" data-testid="button-send-invite">
                <UserPlus className="mr-2 h-4 w-4" />
                Send Invite
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Send Session Invite</DialogTitle>
                <DialogDescription>
                  Invite someone to join this workspace session
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="participant@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    data-testid="input-invite-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Name *</Label>
                  <Input
                    id="invite-name"
                    placeholder="John Doe"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    data-testid="input-invite-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'participant' | 'facilitator')}>
                    <SelectTrigger id="invite-role" data-testid="select-invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="participant">Participant</SelectItem>
                      <SelectItem value="facilitator">Facilitator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="optional">
                    <AccordionTrigger className="text-sm">Optional Details</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="invite-message">Personal Message</Label>
                        <Textarea
                          id="invite-message"
                          placeholder="Add a personal note to the invitation..."
                          value={inviteMessage}
                          onChange={(e) => setInviteMessage(e.target.value)}
                          data-testid="textarea-invite-message"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label htmlFor="session-date">Session Date</Label>
                          <Input
                            id="session-date"
                            type="date"
                            value={sessionDate}
                            onChange={(e) => setSessionDate(e.target.value)}
                            data-testid="input-session-date"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="session-time">Session Time</Label>
                          <Input
                            id="session-time"
                            type="time"
                            value={sessionTime}
                            onChange={(e) => setSessionTime(e.target.value)}
                            data-testid="input-session-time"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)} data-testid="button-cancel-invite">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendInvite} 
                  disabled={sendInviteMutation.isPending}
                  data-testid="button-confirm-invite"
                >
                  {sendInviteMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={bulkInviteDialogOpen} onOpenChange={setBulkInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start" data-testid="button-bulk-invite">
                <Users className="mr-2 h-4 w-4" />
                Bulk Invite
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Bulk Session Invites</DialogTitle>
                <DialogDescription>
                  Add multiple recipients to invite at once
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Email"
                      type="email"
                      value={bulkEmail}
                      onChange={(e) => setBulkEmail(e.target.value)}
                      data-testid="input-bulk-email"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      placeholder="Name"
                      value={bulkName}
                      onChange={(e) => setBulkName(e.target.value)}
                      data-testid="input-bulk-name"
                    />
                  </div>
                  <Select value={bulkRole} onValueChange={(v) => setBulkRole(v as 'participant' | 'facilitator')}>
                    <SelectTrigger className="w-32" data-testid="select-bulk-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="participant">Participant</SelectItem>
                      <SelectItem value="facilitator">Facilitator</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    size="icon" 
                    onClick={addBulkRecipient}
                    disabled={!bulkEmail || !bulkName}
                    data-testid="button-add-recipient"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {bulkRecipients.length > 0 && (
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
                    {bulkRecipients.map((recipient, index) => (
                      <div key={index} className="flex items-center justify-between rounded bg-muted/50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{recipient.name}</span>
                          <span className="text-xs text-muted-foreground">({recipient.email})</span>
                          <Badge variant="outline" className="text-xs">{recipient.role}</Badge>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => removeBulkRecipient(index)}
                          data-testid={`button-remove-recipient-${index}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="bulk-message">Message for All (Optional)</Label>
                  <Textarea
                    id="bulk-message"
                    placeholder="Add a message that will be included in all invitations..."
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    data-testid="textarea-bulk-message"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkInviteDialogOpen(false)} data-testid="button-cancel-bulk-invite">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendBulkInvites} 
                  disabled={sendBulkInviteMutation.isPending || bulkRecipients.length === 0}
                  data-testid="button-confirm-bulk-invite"
                >
                  {sendBulkInviteMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send {bulkRecipients.length} Invite{bulkRecipients.length !== 1 ? 's' : ''}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={phaseChangeDialogOpen} onOpenChange={setPhaseChangeDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                disabled={emailableParticipants.length === 0}
                data-testid="button-phase-notification"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                Phase Alert
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Send Phase Change Notification</DialogTitle>
                <DialogDescription>
                  Notify {emailableParticipants.length} participant{emailableParticipants.length !== 1 ? 's' : ''} about a phase change
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-phase">New Phase *</Label>
                  <Select value={newPhase} onValueChange={setNewPhase}>
                    <SelectTrigger id="new-phase" data-testid="select-new-phase">
                      <SelectValue placeholder="Select phase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ideation">Ideation</SelectItem>
                      <SelectItem value="priority-matrix">Priority Matrix</SelectItem>
                      <SelectItem value="staircase">Staircase</SelectItem>
                      <SelectItem value="survey">Survey</SelectItem>
                      <SelectItem value="voting">Pairwise Voting</SelectItem>
                      <SelectItem value="ranking">Stack Ranking</SelectItem>
                      <SelectItem value="marketplace">Marketplace</SelectItem>
                      <SelectItem value="results">Results</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phase-description">Custom Description (Optional)</Label>
                  <Textarea
                    id="phase-description"
                    placeholder="Describe what participants should do in this phase..."
                    value={phaseDescription}
                    onChange={(e) => setPhaseDescription(e.target.value)}
                    data-testid="textarea-phase-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phase-deadline">Deadline (Optional)</Label>
                  <Input
                    id="phase-deadline"
                    type="datetime-local"
                    value={phaseDeadline}
                    onChange={(e) => setPhaseDeadline(e.target.value)}
                    data-testid="input-phase-deadline"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPhaseChangeDialogOpen(false)} data-testid="button-cancel-phase-notification">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendPhaseChange} 
                  disabled={sendPhaseChangeMutation.isPending || !newPhase}
                  data-testid="button-confirm-phase-notification"
                >
                  {sendPhaseChangeMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Bell className="mr-2 h-4 w-4" />
                  )}
                  Notify All
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                disabled={emailableParticipants.length === 0}
                data-testid="button-results-notification"
              >
                <Trophy className="mr-2 h-4 w-4" />
                Results Ready
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Notify Results Available</DialogTitle>
                <DialogDescription>
                  Let {emailableParticipants.length} participant{emailableParticipants.length !== 1 ? 's' : ''} know that session results are ready to view
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-medium">Results Notification</p>
                    <p className="text-sm text-muted-foreground">
                      Participants will receive an email with a link to view their personalized results
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResultsDialogOpen(false)} data-testid="button-cancel-results-notification">
                  Cancel
                </Button>
                <Button 
                  onClick={() => sendResultsReadyMutation.mutate()} 
                  disabled={sendResultsReadyMutation.isPending}
                  data-testid="button-confirm-results-notification"
                >
                  {sendResultsReadyMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Notifications
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {emailableParticipants.length === 0 && participants.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No participants have email addresses on file. Phase and results notifications require participant emails.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
