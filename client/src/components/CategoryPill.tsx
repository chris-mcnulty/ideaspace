import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface CategoryPillProps {
  name: string;
  isAiGenerated?: boolean;
  count?: number;
  onClick?: () => void;
}

export default function CategoryPill({
  name,
  isAiGenerated,
  count,
  onClick,
}: CategoryPillProps) {
  return (
    <Badge
      variant={isAiGenerated ? "default" : "secondary"}
      className="cursor-pointer gap-1.5 px-3 py-1"
      onClick={onClick}
      data-testid={`category-${name}`}
    >
      {isAiGenerated && <Sparkles className="h-3 w-3" />}
      <span>{name}</span>
      {count !== undefined && (
        <span className="ml-1 opacity-60">({count})</span>
      )}
    </Badge>
  );
}
