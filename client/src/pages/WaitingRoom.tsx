import WaitingRoomComponent from "@/components/WaitingRoom";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Organization, Space, Participant } from "@shared/schema";

export default function WaitingRoomPage() {
  const params = useParams() as { org: string; space: string };
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
        userId: null,
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

  return (
    <WaitingRoomComponent
      orgName={org.name}
      spaceName={space.name}
      spacePurpose={space.purpose}
      status={space.status}
      onJoinAnonymous={(guestName) => {
        joinMutation.mutate({
          displayName: guestName,
          isGuest: true,
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
  );
}
