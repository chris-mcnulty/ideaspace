import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface RankListItemProps {
  id: string;
  rank: number;
  content: string;
  category?: string;
  isDragging?: boolean;
}

export default function RankListItem({
  rank,
  content,
  category,
  isDragging,
}: RankListItemProps) {
  const rankColors = [
    "bg-yellow-500 text-white",
    "bg-gray-400 text-white",
    "bg-amber-600 text-white",
  ];

  const rankColor = rank <= 3 ? rankColors[rank - 1] : "bg-muted text-muted-foreground";

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md border p-4 transition-all",
        isDragging ? "opacity-50" : "hover-elevate",
        "cursor-grab active:cursor-grabbing"
      )}
      data-testid={`rank-item-${rank}`}
    >
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold",
          rankColor
        )}
      >
        {rank}
      </div>

      <GripVertical className="h-5 w-5 flex-shrink-0 text-muted-foreground" />

      <div className="flex-1">
        <div className="text-sm leading-snug">{content}</div>
        {category && (
          <Badge variant="outline" className="mt-2 text-xs">
            {category}
          </Badge>
        )}
      </div>
    </div>
  );
}
