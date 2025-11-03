import { GripVertical, User, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
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
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
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
        <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-100">
          <User className="h-3 w-3 opacity-80" />
          <span className="truncate opacity-80">{author || "Anonymous"}</span>
        </div>
        <GripVertical className="h-4 w-4 text-gray-600 dark:text-gray-300 opacity-50" />
      </div>

      <div className="flex-1 overflow-y-auto text-sm leading-snug text-gray-900 dark:text-gray-100 font-medium">
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
        <div className="mt-1 font-mono text-xs text-gray-600 dark:text-gray-300 opacity-60">
          {timestamp.toLocaleTimeString()}
        </div>
      )}

      {/* Edit/Delete buttons - shown on hover */}
      {(canEdit || canDelete) && (
        <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {canEdit && onEdit && (
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              data-testid="button-edit-note"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
          {canDelete && onDelete && (
            <Button
              size="icon"
              variant="destructive"
              className="h-6 w-6 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              data-testid="button-delete-note"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
