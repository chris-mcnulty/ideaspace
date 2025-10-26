import { WORKSPACE_ICONS, WorkspaceIcon, type WorkspaceIconType } from "./WorkspaceIcon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check } from "lucide-react";

interface WorkspaceIconSelectorProps {
  selectedIcon: string;
  onSelectIcon: (iconId: WorkspaceIconType) => void;
  size?: "sm" | "md" | "lg";
}

export function WorkspaceIconSelector({
  selectedIcon,
  onSelectIcon,
  size = "md",
}: WorkspaceIconSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-12 w-12 p-0 hover-elevate"
          data-testid="button-select-workspace-icon"
        >
          <WorkspaceIcon iconId={selectedIcon} size={size} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" data-testid="dropdown-workspace-icons">
        <DropdownMenuLabel>Choose Icon</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-2 gap-1 p-1">
          {WORKSPACE_ICONS.map((icon) => (
            <DropdownMenuItem
              key={icon.id}
              onClick={() => onSelectIcon(icon.id)}
              className="flex items-center gap-3 cursor-pointer"
              data-testid={`option-icon-${icon.id}`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/30">
                <WorkspaceIcon iconId={icon.id} size="md" />
              </div>
              <div className="flex-1">
                <span className="text-sm">{icon.label}</span>
              </div>
              {selectedIcon === icon.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
