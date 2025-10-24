import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Participant {
  id: string;
  name: string;
  isOnline: boolean;
}

interface ParticipantListProps {
  participants: Participant[];
  maxVisible?: number;
}

export default function ParticipantList({
  participants,
  maxVisible = 8,
}: ParticipantListProps) {
  const visibleParticipants = participants.slice(0, maxVisible);
  const remainingCount = Math.max(0, participants.length - maxVisible);
  const onlineCount = participants.filter(p => p.isOnline).length;

  return (
    <div className="flex items-center gap-3" data-testid="participant-list">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {onlineCount} / {participants.length}
        </span>
      </div>

      <div className="flex -space-x-2">
        {visibleParticipants.map((participant) => (
          <div key={participant.id} className="relative">
            <Avatar className="h-8 w-8 border-2 border-background">
              <AvatarFallback className="text-xs">
                {participant.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {participant.isOnline && (
              <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-background bg-green-500" />
            )}
          </div>
        ))}
        {remainingCount > 0 && (
          <Badge variant="secondary" className="ml-3 h-8 rounded-full px-3">
            +{remainingCount}
          </Badge>
        )}
      </div>
    </div>
  );
}
