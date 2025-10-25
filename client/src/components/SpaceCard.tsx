import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Users, EyeOff } from "lucide-react";
import StatusBadge from "./StatusBadge";

type SpaceStatus = "draft" | "open" | "closed" | "processing";

interface SpaceCardProps {
  name: string;
  purpose: string;
  status: SpaceStatus;
  participantCount: number;
  isHidden?: boolean;
  onEnter?: () => void;
}

export default function SpaceCard({
  name,
  purpose,
  status,
  participantCount,
  isHidden,
  onEnter,
}: SpaceCardProps) {
  return (
    <Card className="hover-elevate transition-all" data-testid={`space-card-${name}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{name}</h3>
            {isHidden && (
              <Badge variant="secondary" className="mt-2 gap-1">
                <EyeOff className="h-3 w-3" />
                Hidden
              </Badge>
            )}
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">{purpose}</p>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{participantCount} participants</span>
        </div>
        <Button onClick={onEnter} size="sm" data-testid="button-enter-space">
          Enter
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
