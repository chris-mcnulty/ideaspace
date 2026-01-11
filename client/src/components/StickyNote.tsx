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
  isNew?: boolean;
}

export default function StickyNote({
  id,
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
  isNew = false,
}: StickyNoteProps) {
  const colors = [
    "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700",
    "bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700",
    "bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700",
    "bg-pink-100 dark:bg-pink-900/20 border-pink-300 dark:border-pink-700",
    "bg-purple-100 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700",
    "bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700",
  ];
  
  // Deterministic color based on note ID for consistency across re-renders
  const colorIndex = id ? id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length : 0;
  const noteColor = colors[colorIndex];

  return (
    <div
      className={cn(
        "group relative flex min-h-[180px] w-full cursor-pointer flex-col rounded-lg border-2 p-4 shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5",
        noteColor,
        selected && "ring-2 ring-primary ring-offset-2",
        isNew && "animate-pulse ring-2 ring-primary/50",
        className
      )}
      onClick={onClick}
      data-testid={`sticky-note-${content.substring(0, 10)}`}
    >
      {/* Author Header */}
      <div className="mb-3 flex items-center justify-between border-b border-current/10 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
          <User className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
          <span className="truncate max-w-[120px]">{author || "Anonymous"}</span>
        </div>
        <GripVertical className="h-4 w-4 text-gray-500 dark:text-gray-400 opacity-40 group-hover:opacity-70 transition-opacity" />
      </div>

      {/* Main Content - Improved Typography */}
      <div className="flex-1 overflow-y-auto text-base leading-relaxed text-gray-800 dark:text-gray-100 font-medium tracking-wide">
        {content}
      </div>

      {/* Category Badge */}
      {category && (
        <div className="mt-3 pt-2 border-t border-current/10">
          <Badge variant="secondary" className="text-xs font-semibold">
            {isAiCategory && <span className="mr-1 text-primary italic">AI:</span>}
            {category}
          </Badge>
        </div>
      )}

      {/* Timestamp Footer */}
      {timestamp && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Edit/Delete buttons - shown on hover */}
      {(canEdit || canDelete) && (
        <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {canEdit && onEdit && (
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              data-testid="button-edit-note"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {canDelete && onDelete && (
            <Button
              size="icon"
              variant="destructive"
              className="rounded-full shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              data-testid="button-delete-note"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
