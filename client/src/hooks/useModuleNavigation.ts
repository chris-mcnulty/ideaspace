import { useWebSocket } from "@/hooks/useWebSocket";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAnnouncer } from "@/components/LiveAnnouncer";

interface UseModuleNavigationOptions {
  spaceId: string;
  orgSlug: string;
  onMessage?: (message: { type: string; data: any }) => void;
}

export function useModuleNavigation({ spaceId, orgSlug, onMessage }: UseModuleNavigationOptions) {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { announce } = useAnnouncer();

  const ws = useWebSocket({
    spaceId,
    enabled: !!spaceId,
    onMessage: (message) => {
      if (message.type === 'navigate_to_phase') {
        const { phase, spaceId: msgSpaceId } = message.data;
        if (msgSpaceId === spaceId) {
          const phaseRoutes: Record<string, string> = {
            vote: `/o/${orgSlug}/s/${spaceId}/vote`,
            rank: `/o/${orgSlug}/s/${spaceId}/rank`,
            marketplace: `/o/${orgSlug}/s/${spaceId}/marketplace`,
            survey: `/o/${orgSlug}/s/${spaceId}/survey`,
            'priority-matrix': `/o/${orgSlug}/s/${spaceId}/priority-matrix`,
            staircase: `/o/${orgSlug}/s/${spaceId}/staircase`,
            ideate: `/o/${orgSlug}/s/${spaceId}/participate`,
            results: `/o/${orgSlug}/s/${spaceId}/results`,
          };
          const route = phaseRoutes[phase as string];
          if (route && route !== location) {
            const dest = phase === 'results' ? 'results page' : `${String(phase).replace('-', ' ')} phase`;
            toast({
              title: "Phase Change",
              description: `Navigating to ${dest}...`,
            });
            announce(`Facilitator moved the session to the ${dest}`, "assertive");
            navigate(route);
          }
        }
      }
      onMessage?.(message);
    },
  });

  return ws;
}
