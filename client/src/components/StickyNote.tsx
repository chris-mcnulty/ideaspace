import { GripVertical, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StickyNoteProps {
  id: string;
  content: string;
  author?: string;
  timestamp?: Date;
  category?: string;
  isAiCategory?: boolean;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export default function StickyNote({
  content,
  author,
  timestamp,
  category,
  isAiCategory,
  className,
  onClick,
  selected,
}: StickyNoteProps) {
  const colors = [
    "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700",
    "bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700",
    "bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700",
    "bg-pink-100 dark:bg-pink-900/20 border-pink-300 dark:border-pink-700",
  ];
  
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  return (
    <div
      className={cn(
        "group relative flex h-48 w-48 cursor-move flex-col rounded-md border-2 p-3 shadow-sm transition-all hover:shadow-md",
        randomColor,
        selected && "ring-2 ring-primary ring-offset-2",
        className
      )}
      onClick={onClick}
      data-testid={`sticky-note-${content.substring(0, 10)}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs opacity-60">
          <User className="h-3 w-3" />
          <span className="truncate">{author || "Anonymous"}</span>
        </div>
        <GripVertical className="h-4 w-4 opacity-40" />
      </div>

      <div className="flex-1 overflow-y-auto text-sm leading-snug">
        {content}
      </div>

      {category && (
        <div className="mt-2">
          <Badge variant="secondary" className="text-xs">
            {isAiCategory && <span className="mr-1 italic">AI:</span>}
            {category}
          </Badge>
        </div>
      )}

      {timestamp && (
        <div className="mt-1 font-mono text-xs opacity-40">
          {timestamp.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
