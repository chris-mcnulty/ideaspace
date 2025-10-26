import WaitingRoomComponent from "@/components/WaitingRoom";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Organization, Space, Participant, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { useState } from "react";

export default function WaitingRoomPage() {
  const params = useParams() as { org: string; space: string };
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [requestEmail, setRequestEmail] = useState("");
  const [requestName, setRequestName] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const { isAuthenticated } = useAuth();

  // Check if user is authenticated
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const { data: org } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  const { data: space, isLoading } = useQuery<Space>({
    queryKey: [`/api/spaces/${params.space}`],
  });

  const joinMutation = useMutation<Participant, Error, { displayName: string; isGuest: boolean; profileData?: any }>({
    mutationFn: async (data) => {
      const response = await apiRequest("POST", `/api/participants`, {
        spaceId: params.space,
        userId: currentUser?.id || null,
        displayName: data.displayName,
        isGuest: data.isGuest,
        isOnline: true,
        profileData: data.profileData,
      });
      return await response.json();
    },
    onSuccess: (participant) => {
      queryClient.invalidateQueries({ queryKey: [`/api/spaces/${params.space}/participants`] });
      // Store participant ID in session storage
      sessionStorage.setItem("participantId", participant.id);
      // Navigate to the space
      setLocation(`/o/${params.org}/s/${params.space}/participate`);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Failed to join session",
        description: error.message || "Please try again",
      });
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: async (data: { email: string; name: string; message?: string }) => {
      const response = await apiRequest("POST", "/api/access-requests", {
        spaceId: params.space,
        email: data.email,
        name: data.name,
        message: data.message,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Access request submitted",
        description: "The workspace facilitators have been notified. You'll receive an email when your request is reviewed.",
      });
      setRequestEmail("");
      setRequestName("");
      setRequestMessage("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to submit request",
        description: error.message || "Please try again",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!space || !org) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg font-medium">Space not found</p>
      </div>
    );
  }

  // Check if guest access is allowed
  const guestAllowed = space.guestAllowed ?? true; // Default to true for backward compatibility
  
  // Check if user has permission (authenticated users)
  const hasPermission = currentUser && (
    currentUser.role === "global_admin" ||
    (currentUser.role === "company_admin" && currentUser.organizationId === space.organizationId) ||
    currentUser.role === "facilitator" ||
    currentUser.organizationId === space.organizationId
  );

  // If guest access is not allowed and user is not authenticated or doesn't have permission
  if (!guestAllowed && !hasPermission) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-full items-center justify-end gap-3 px-6">
            <ThemeToggle />
            {isAuthenticated && <UserProfileMenu />}
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Access Required</CardTitle>
            <CardDescription>
              This workspace requires authentication or approval to join.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!currentUser && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please log in if you have an account, or request access below.
                </p>
                <Button
                  className="w-full"
                  onClick={() => setLocation("/login")}
                  data-testid="button-go-to-login"
                >
                  Go to Login
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Request Access</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="request-name">Your Name</Label>
                  <Input
                    id="request-name"
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                    placeholder="Enter your name"
                    data-testid="input-access-request-name"
                  />
                </div>
                <div>
                  <Label htmlFor="request-email">Email</Label>
                  <Input
                    id="request-email"
                    type="email"
                    value={requestEmail}
                    onChange={(e) => setRequestEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    data-testid="input-access-request-email"
                  />
                </div>
                <div>
                  <Label htmlFor="request-message">Message (Optional)</Label>
                  <Textarea
                    id="request-message"
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Why would you like to join this workspace?"
                    rows={3}
                    data-testid="input-access-request-message"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!requestEmail || !requestName) {
                      toast({
                        variant: "destructive",
                        title: "Missing information",
                        description: "Please provide your name and email",
                      });
                      return;
                    }
                    requestAccessMutation.mutate({
                      email: requestEmail,
                      name: requestName,
                      message: requestMessage || undefined,
                    });
                  }}
                  disabled={requestAccessMutation.isPending}
                  data-testid="button-submit-access-request"
                >
                  {requestAccessMutation.isPending ? "Submitting..." : "Request Access"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  // User has permission or guest access is allowed - show normal waiting room
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center justify-end gap-3 px-6">
          <ThemeToggle />
          {isAuthenticated && <UserProfileMenu />}
        </div>
      </header>
      <WaitingRoomComponent
        orgName={org.name}
        spaceName={space.name}
        spacePurpose={space.purpose}
        status={space.status}
        onJoinAnonymous={(guestName) => {
          joinMutation.mutate({
            displayName: guestName,
            isGuest: !currentUser, // If user is logged in, not a guest
          });
        }}
        onRegister={(data) => {
          joinMutation.mutate({
            displayName: data.name,
            isGuest: false,
            profileData: {
              email: data.email,
              company: data.company,
              jobTitle: data.job_title,
              industry: data.industry,
              country: data.country,
            },
          });
        }}
      />
    </div>
  );
}
