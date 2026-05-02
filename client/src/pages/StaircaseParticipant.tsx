import { useParams } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import StaircaseModule from "@/components/StaircaseModule";
import { useModuleNavigation } from "@/hooks/useModuleNavigation";
import type { Organization, Space } from "@shared/schema";

export default function StaircaseParticipant() {
  const params = useParams<{ org: string; space: string }>();

  useModuleNavigation({ spaceId: params.space!, orgSlug: params.org! });
  
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
      document.title = "Nebula - Staircase Module | The Synozur Alliance";
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
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold truncate">{space.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Staircase Rating</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <ThemeToggle />
              <UserProfileMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-3 sm:p-6">
        <div className="mx-auto max-w-7xl">
          <StaircaseModule spaceId={params.space} />
        </div>
      </main>
    </div>
  );
}
