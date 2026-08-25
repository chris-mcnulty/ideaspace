import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Lock, Loader2, Rocket } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import StarshipModule from "@/components/StarshipModule";
import type { Space } from "@shared/schema";

export default function StarshipPresenter() {
  const params = useParams<{ org: string; space: string }>();
  const spaceId = params.space!;
  const { user, isLoading: authLoading } = useAuth();
  const canPresent = !!user;

  const { data: space } = useQuery<Space>({
    queryKey: [`/api/spaces/${spaceId}`],
    enabled: !!spaceId,
  });

  useEffect(() => {
    document.title = `Starship Presenter — ${space?.name ?? "Nebula"}`;
  }, [space?.name]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canPresent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <Lock className="mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Starship presenter</h1>
        <p className="mt-1 max-w-sm text-muted-foreground">
          Please sign in with an account that has access to this workspace to view the presenter screen.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b bg-background/95 px-5 py-3 backdrop-blur sm:px-8 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Rocket className="h-6 w-6 shrink-0 text-sky-500" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold sm:text-2xl">
              {space?.name ?? "Starship"}
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Starship presenter</p>
          </div>
        </div>
        <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">
          Live shared view
        </span>
      </header>

      <main className="min-h-0 flex-1 p-2 sm:p-4">
        <div className="h-full min-h-[calc(100vh-92px)]">
          <StarshipModule spaceId={spaceId} isReadOnly={true} />
        </div>
      </main>
    </div>
  );
}