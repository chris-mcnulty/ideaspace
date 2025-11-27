import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SpaceLifecycleStatus = "draft" | "open" | "closed" | "processing" | "archived";
type SessionPhase = "ideation" | "ideate" | "voting" | "vote" | "ranking" | "rank" | 
  "marketplace" | "survey" | "results" | "priority-matrix" | "staircase";
type Status = SpaceLifecycleStatus | SessionPhase;

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    open: { label: "Open", color: "bg-green-500 text-white" },
    closed: { label: "Closed", color: "bg-gray-500 text-white" },
    processing: { label: "Processing", color: "bg-blue-500 text-white animate-pulse" },
    archived: { label: "Archived", color: "bg-gray-400 text-white" },
    ideation: { label: "Ideation", color: "bg-yellow-500 text-white" },
    ideate: { label: "Ideation", color: "bg-yellow-500 text-white" },
    voting: { label: "Voting", color: "bg-purple-500 text-white" },
    vote: { label: "Voting", color: "bg-purple-500 text-white" },
    ranking: { label: "Ranking", color: "bg-indigo-500 text-white" },
    rank: { label: "Ranking", color: "bg-indigo-500 text-white" },
    marketplace: { label: "Marketplace", color: "bg-amber-500 text-white" },
    survey: { label: "Survey", color: "bg-cyan-500 text-white" },
    results: { label: "Results", color: "bg-emerald-500 text-white" },
    "priority-matrix": { label: "Priority Matrix", color: "bg-orange-500 text-white" },
    staircase: { label: "Staircase", color: "bg-teal-500 text-white" },
  };

  const fallback = { label: String(status || "Unknown"), color: "bg-muted text-muted-foreground" };
  const { label, color } = config[status] || fallback;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", className)}
      data-testid={`status-${status}`}
    >
      <div className={cn("h-2 w-2 rounded-full", color)} />
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
    </Badge>
  );
}
