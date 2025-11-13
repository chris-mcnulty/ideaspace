import { useParams } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import PriorityMatrix from "@/components/PriorityMatrix";
import type { Organization, Space } from "@shared/schema";

export default function PriorityMatrixParticipant() {
  const params = useParams<{ org: string; space: string }>();
  
  // Fetch organization data
  const { data: org } = useQuery<Organization>({
    queryKey: [`/api/organizations/${params.org}`],
  });

  // Fetch workspace data
  const { data: space } = useQuery<Space>({
    queryKey: [`/api/spaces/${params.space}`],
  });
  
  // Set page title dynamically
  useEffect(() => {
    if (org && space) {
      document.title = `Nebula - ${org.name} ${space.name} | The Synozur Alliance`;
    } else {
      document.title = "Nebula - Priority Matrix | The Synozur Alliance";
    }
  }, [org, space]);

  if (!org || !space) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{space.name}</h1>
              <p className="text-sm text-muted-foreground">Priority Matrix</p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <UserProfileMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-6">
        <div className="mx-auto max-w-7xl">
          <PriorityMatrix spaceId={params.space} />
        </div>
      </main>
    </div>
  );
}
