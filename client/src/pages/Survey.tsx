import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurveyView } from "@/components/SurveyView";
import BrandHeader from "@/components/BrandHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Space, Participant } from "@shared/schema";

export default function Survey() {
  const params = useParams() as { org: string; space: string };
  const [, navigate] = useLocation();

  // Fetch workspace data
  const { data: space } = useQuery<Space>({
    queryKey: ["/api/spaces", params.space],
  });

  // Get participant ID from session
  const participantId = sessionStorage.getItem("participantId");

  if (!participantId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Required</h1>
          <p className="text-muted-foreground mb-6">
            Please join the workspace first to access the survey.
          </p>
          <Button onClick={() => navigate(`/o/${params.org}/s/${params.space}`)}>
            Back to Workspace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/o/${params.org}/s/${params.space}`)}
                data-testid="button-back-to-workspace"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <BrandHeader />
                {space && (
                  <h1 className="text-xl font-bold mt-2">{space.name} - Survey</h1>
                )}
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-6 py-8">
        <SurveyView spaceId={params.space} participantId={participantId} />
      </main>
    </div>
  );
}
