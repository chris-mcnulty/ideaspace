import { Clock, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface TimerBarProps {
  timeRemaining: number;
  totalTime: number;
  isRunning: boolean;
  onToggle?: () => void;
  onReset?: () => void;
  isFacilitator?: boolean;
}

export default function TimerBar({
  timeRemaining,
  totalTime,
  isRunning,
  onToggle,
  onReset,
  isFacilitator = false,
}: TimerBarProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const progress = ((totalTime - timeRemaining) / totalTime) * 100;
  const isLowTime = timeRemaining < 60;

  return (
    <div className="sticky top-16 z-40 border-b bg-background/95 backdrop-blur">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className={cn("h-5 w-5", isLowTime && "text-destructive animate-pulse")} />
            <div
              className={cn(
                "font-mono text-4xl font-bold tabular-nums",
                isLowTime && "text-destructive"
              )}
              data-testid="timer-display"
            >
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
          </div>

          {isFacilitator && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onToggle}
                data-testid="button-timer-toggle"
              >
                {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onReset}
                data-testid="button-timer-reset"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Progress value={progress} className="mt-3 h-1" />
      </div>
    </div>
  );
}
