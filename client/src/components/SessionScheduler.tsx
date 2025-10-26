import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { useState } from "react";

type SessionMode = "live" | "async";

interface PhaseSchedule {
  startsAt?: Date | null;
  endsAt?: Date | null;
}

interface SessionSchedulerProps {
  sessionMode: SessionMode;
  ideation: PhaseSchedule;
  voting: PhaseSchedule;
  ranking: PhaseSchedule;
  onUpdate: (updates: {
    sessionMode?: SessionMode;
    ideation?: PhaseSchedule;
    voting?: PhaseSchedule;
    ranking?: PhaseSchedule;
  }) => void;
}

export function SessionScheduler({
  sessionMode,
  ideation,
  voting,
  ranking,
  onUpdate,
}: SessionSchedulerProps) {
  const [mode, setMode] = useState<SessionMode>(sessionMode);

  const handleModeChange = (newMode: SessionMode) => {
    setMode(newMode);
    onUpdate({ sessionMode: newMode });
  };

  const getPhaseStatus = (phase: PhaseSchedule): "upcoming" | "active" | "ended" | "not-set" => {
    if (!phase.startsAt || !phase.endsAt) return "not-set";
    const now = new Date();
    const start = new Date(phase.startsAt);
    const end = new Date(phase.endsAt);
    
    if (now < start) return "upcoming";
    if (now >= start && now <= end) return "active";
    return "ended";
  };

  const formatDateTime = (date: Date | null | undefined): string => {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 16);
  };

  const parseDateTime = (str: string): Date | null => {
    if (!str) return null;
    return new Date(str);
  };

  const PhaseScheduleRow = ({
    label,
    phase,
    onPhaseUpdate,
  }: {
    label: string;
    phase: PhaseSchedule;
    onPhaseUpdate: (updated: PhaseSchedule) => void;
  }) => {
    const status = getPhaseStatus(phase);
    
    const statusConfig = {
      "not-set": { icon: Circle, color: "text-muted-foreground", label: "Not Scheduled" },
      "upcoming": { icon: Clock, color: "text-blue-500", label: "Upcoming" },
      "active": { icon: CheckCircle2, color: "text-green-500", label: "Active" },
      "ended": { icon: AlertCircle, color: "text-muted-foreground", label: "Ended" },
    };

    const StatusIcon = statusConfig[status].icon;

    return (
      <div className="space-y-3 p-4 rounded-lg bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{label}</h4>
            <Badge variant="outline" className="gap-1">
              <StatusIcon className={`h-3 w-3 ${statusConfig[status].color}`} />
              <span className="text-xs">{statusConfig[status].label}</span>
            </Badge>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${label}-start`} className="text-xs">
              Start Time
            </Label>
            <Input
              id={`${label}-start`}
              type="datetime-local"
              value={formatDateTime(phase.startsAt)}
              onChange={(e) => {
                onPhaseUpdate({
                  ...phase,
                  startsAt: parseDateTime(e.target.value),
                });
              }}
              className="text-sm"
              data-testid={`input-${label.toLowerCase()}-start`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${label}-end`} className="text-xs">
              End Time
            </Label>
            <Input
              id={`${label}-end`}
              type="datetime-local"
              value={formatDateTime(phase.endsAt)}
              onChange={(e) => {
                onPhaseUpdate({
                  ...phase,
                  endsAt: parseDateTime(e.target.value),
                });
              }}
              className="text-sm"
              data-testid={`input-${label.toLowerCase()}-end`}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Session Scheduling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Session Mode Toggle */}
        <div className="space-y-3">
          <Label>Session Mode</Label>
          <div className="flex gap-2">
            <Button
              variant={mode === "live" ? "default" : "outline"}
              onClick={() => handleModeChange("live")}
              className="flex-1"
              data-testid="button-mode-live"
            >
              <Clock className="h-4 w-4 mr-2" />
              Live Session
            </Button>
            <Button
              variant={mode === "async" ? "default" : "outline"}
              onClick={() => handleModeChange("async")}
              className="flex-1"
              data-testid="button-mode-async"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Asynchronous
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "live"
              ? "Participants collaborate in real-time with immediate feedback"
              : "Phases run over scheduled time windows - participants can join anytime during the window"}
          </p>
        </div>

        {/* Phase Scheduling (only show for async mode) */}
        {mode === "async" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <p>Set time windows for each phase. Participants can access phases during their scheduled times.</p>
            </div>

            <PhaseScheduleRow
              label="Ideation"
              phase={ideation}
              onPhaseUpdate={(updated) => onUpdate({ ideation: updated })}
            />

            <PhaseScheduleRow
              label="Voting"
              phase={voting}
              onPhaseUpdate={(updated) => onUpdate({ voting: updated })}
            />

            <PhaseScheduleRow
              label="Ranking"
              phase={ranking}
              onPhaseUpdate={(updated) => onUpdate({ ranking: updated })}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
