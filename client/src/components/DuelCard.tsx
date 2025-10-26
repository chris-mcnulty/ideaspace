import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import type { Note } from "@shared/schema";

interface DuelCardProps {
  noteA: Note;
  noteB: Note;
  onChoose: (winnerId: string, loserId: string) => void;
  isLoading?: boolean;
}

export function DuelCard({ noteA, noteB, onChoose, isLoading = false }: DuelCardProps) {
  return (
    <div className="flex flex-col md:flex-row gap-8 items-stretch w-full max-w-7xl mx-auto" data-testid="duel-container">
      {/* Left Note */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card 
          className={cn(
            "flex-1 p-8 transition-all cursor-pointer relative",
            "hover-elevate active-elevate-2"
          )}
          onClick={() => !isLoading && onChoose(noteA.id, noteB.id)}
          data-testid={`duel-option-${noteA.id}`}
        >
          <div className="absolute -top-3 left-4">
            <Badge variant="outline" className="text-xs font-mono bg-background">
              Press 1
            </Badge>
          </div>
          {noteA.category && (
            <div className="absolute -top-3 right-4">
              <Badge variant="secondary" className="text-xs">
                {noteA.category}
              </Badge>
            </div>
          )}
          
          <div className="flex flex-col h-full justify-between gap-6 mt-2">
            <div className="flex-1 min-h-[120px]">
              <p className="text-base leading-relaxed text-foreground">
                {noteA.content}
              </p>
            </div>
            <Button 
              variant="default" 
              size="lg"
              className="w-full gap-2"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                onChoose(noteA.id, noteB.id);
              }}
              data-testid={`button-choose-${noteA.id}`}
            >
              Choose This
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>
      </div>

      {/* VS Divider */}
      <div className="flex items-center justify-center md:py-8">
        <div className="relative">
          <div className="text-6xl font-bold text-muted-foreground/20 select-none">
            VS
          </div>
        </div>
      </div>

      {/* Right Note */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card 
          className={cn(
            "flex-1 p-8 transition-all cursor-pointer relative",
            "hover-elevate active-elevate-2"
          )}
          onClick={() => !isLoading && onChoose(noteB.id, noteA.id)}
          data-testid={`duel-option-${noteB.id}`}
        >
          <div className="absolute -top-3 left-4">
            <Badge variant="outline" className="text-xs font-mono bg-background">
              Press 2
            </Badge>
          </div>
          {noteB.category && (
            <div className="absolute -top-3 right-4">
              <Badge variant="secondary" className="text-xs">
                {noteB.category}
              </Badge>
            </div>
          )}
          
          <div className="flex flex-col h-full justify-between gap-6 mt-2">
            <div className="flex-1 min-h-[120px]">
              <p className="text-base leading-relaxed text-foreground">
                {noteB.content}
              </p>
            </div>
            <Button 
              variant="default" 
              size="lg"
              className="w-full gap-2"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                onChoose(noteB.id, noteA.id);
              }}
              data-testid={`button-choose-${noteB.id}`}
            >
              Choose This
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default DuelCard;
