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
  // High-contrast, vibrant colors for maximum visibility in both light and dark modes
  const colors = [
    // Yellow - warm and inviting
    "bg-amber-200 dark:bg-amber-500/30 border-amber-400 dark:border-amber-400/60 text-amber-950 dark:text-amber-50",
    // Blue - calm and professional
    "bg-sky-200 dark:bg-sky-500/30 border-sky-400 dark:border-sky-400/60 text-sky-950 dark:text-sky-50",
    // Green - fresh and positive
    "bg-emerald-200 dark:bg-emerald-500/30 border-emerald-400 dark:border-emerald-400/60 text-emerald-950 dark:text-emerald-50",
    // Pink - vibrant and energetic
    "bg-rose-200 dark:bg-rose-500/30 border-rose-400 dark:border-rose-400/60 text-rose-950 dark:text-rose-50",
    // Purple - creative and unique
    "bg-violet-200 dark:bg-violet-500/30 border-violet-400 dark:border-violet-400/60 text-violet-950 dark:text-violet-50",
    // Orange - warm and attention-grabbing
    "bg-orange-200 dark:bg-orange-500/30 border-orange-400 dark:border-orange-400/60 text-orange-950 dark:text-orange-50",
  ];
  
  // Deterministic color based on note ID for consistency across re-renders
  const colorIndex = id ? id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length : 0;
  const noteColor = colors[colorIndex];

  return (
    <div
      className={cn(
        "group relative flex min-h-[200px] w-full cursor-pointer flex-col rounded-xl border-2 p-5 shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5",
        noteColor,
        selected && "ring-2 ring-primary ring-offset-2",
        isNew && "animate-pulse ring-2 ring-primary/50",
        className
      )}
      onClick={onClick}
      data-testid={`sticky-note-${content.substring(0, 10)}`}
    >
      {/* Author Header */}
      <div className="mb-3 flex items-center justify-between border-b border-current/20 pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold opacity-80">
          <User className="h-4 w-4" />
          <span className="truncate max-w-[140px]">{author || "Anonymous"}</span>
        </div>
        <GripVertical className="h-4 w-4 opacity-40 group-hover:opacity-70 transition-opacity" />
      </div>

      {/* Main Content - Maximum Legibility Typography */}
      <div className="flex-1 overflow-y-auto text-lg leading-relaxed font-semibold tracking-normal">
        {content}
      </div>

      {/* Category Badge */}
      {category && (
        <div className="mt-4 pt-3 border-t border-current/20">
          <Badge variant="secondary" className="text-xs font-bold px-2.5 py-1">
            {isAiCategory && <span className="mr-1 text-primary italic">AI:</span>}
            {category}
          </Badge>
        </div>
      )}

      {/* Timestamp Footer */}
      {timestamp && (
        <div className="mt-2 text-sm opacity-70 font-mono tabular-nums">
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
