import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Square, Sparkles, ChevronRight, Download } from "lucide-react";
import ParticipantList from "./ParticipantList";
import StatusBadge from "./StatusBadge";

interface FacilitatorConsoleProps {
  sessionStatus: "draft" | "open" | "closed";
  currentModule: string;
  participants: Array<{ id: string; name: string; isOnline: boolean }>;
  onStartSession?: () => void;
  onEndSession?: () => void;
  onTriggerAI?: () => void;
  onNextModule?: () => void;
  onGenerateReport?: () => void;
}

export default function FacilitatorConsole({
  sessionStatus,
  currentModule,
  participants,
  onStartSession,
  onEndSession,
  onTriggerAI,
  onNextModule,
  onGenerateReport,
}: FacilitatorConsoleProps) {
  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Facilitator Console</h2>
            <StatusBadge status={sessionStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <ParticipantList participants={participants} />
            <div className="flex gap-2">
              {sessionStatus === "draft" && (
                <Button onClick={onStartSession} data-testid="button-start-session">
                  <Play className="mr-2 h-4 w-4" />
                  Start Session
                </Button>
              )}
              {sessionStatus === "open" && (
                <Button variant="destructive" onClick={onEndSession} data-testid="button-end-session">
                  <Square className="mr-2 h-4 w-4" />
                  End Session
                </Button>
              )}
            </div>
          </div>

          <Tabs defaultValue="controls" className="w-full">
            <TabsList>
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="controls" className="space-y-4 mt-4">
              <div className="rounded-lg border p-4">
                <div className="mb-4">
                  <p className="text-sm font-medium">Current Module</p>
                  <p className="text-lg font-semibold text-primary">{currentModule}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={onTriggerAI} data-testid="button-trigger-ai">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Trigger AI Categorization
                  </Button>
                  <Button variant="outline" onClick={onNextModule} data-testid="button-next-module">
                    Next Module
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={onGenerateReport} data-testid="button-generate-report">
                    <Download className="mr-2 h-4 w-4" />
                    Generate Report
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-3xl font-bold tabular-nums">24</p>
                    <p className="text-sm text-muted-foreground">Notes Created</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-3xl font-bold tabular-nums">156</p>
                    <p className="text-sm text-muted-foreground">Votes Cast</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-3xl font-bold tabular-nums">12</p>
                    <p className="text-sm text-muted-foreground">Rankings</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-3xl font-bold tabular-nums">18</p>
                    <p className="text-sm text-muted-foreground">Active Users</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
