import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DuelCardProps {
  content: string;
  category?: string;
  position: "left" | "right";
  selected?: boolean;
  onClick?: () => void;
}

export default function DuelCard({
  content,
  category,
  position,
  selected,
  onClick,
}: DuelCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative cursor-pointer rounded-lg border-2 p-6 transition-all hover:shadow-lg",
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        "hover-elevate active-elevate-2"
      )}
      data-testid={`duel-card-${position}`}
    >
      <div className="absolute -top-3 left-4 right-4 flex justify-between">
        {category && (
          <Badge variant="secondary" className="text-xs">
            {category}
          </Badge>
        )}
        <Badge variant="outline" className="text-xs font-mono bg-background">
          Press {position === "left" ? "1" : "2"}
        </Badge>
      </div>

      <div className="mt-4 min-h-[120px] text-base leading-relaxed">
        {content}
      </div>

      {selected && (
        <div className="absolute inset-0 rounded-lg border-4 border-primary animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
