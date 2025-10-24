import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "draft" | "open" | "closed" | "processing";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = {
    draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
    open: { label: "Open", color: "bg-green-500 text-white" },
    closed: { label: "Closed", color: "bg-gray-500 text-white" },
    processing: { label: "Processing", color: "bg-blue-500 text-white animate-pulse" },
  };

  const { label, color } = config[status];

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
