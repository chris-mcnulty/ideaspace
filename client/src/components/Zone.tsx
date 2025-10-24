import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ZoneProps {
  name: string;
  color?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function Zone({
  name,
  color = "border-primary",
  className,
  children,
}: ZoneProps) {
  return (
    <div
      className={cn(
        "relative min-h-[200px] rounded-lg border-2 border-dashed p-4",
        color,
        "bg-accent/5",
        className
      )}
      data-testid={`zone-${name}`}
    >
      <Badge
        variant="outline"
        className="absolute -top-3 left-4 bg-background px-3"
      >
        {name}
      </Badge>
      <div className="mt-4 flex flex-wrap gap-3">
        {children}
      </div>
    </div>
  );
}
