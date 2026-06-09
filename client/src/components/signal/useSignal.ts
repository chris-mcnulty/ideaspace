import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { SignalActivity, SignalDeck } from '@shared/schema';
import type { SignalResponseLite } from './aggregation';

export interface SignalDeckData {
  deck: SignalDeck | null;
  activities: SignalActivity[];
}

export function useSignalDeck(spaceId: string, enabled = true) {
  return useQuery<SignalDeckData>({
    queryKey: [`/api/spaces/${spaceId}/signal`],
    enabled: !!spaceId && enabled,
    staleTime: 0,
  });
}

export function useSignalResponses(spaceId: string, activityId: string | null | undefined, enabled = true) {
  return useQuery<SignalResponseLite[]>({
    queryKey: [`/api/spaces/${spaceId}/signal/activities/${activityId}/responses`],
    enabled: !!spaceId && !!activityId && enabled,
    staleTime: 0,
  });
}

interface RealtimeOptions {
  onActivityChanged?: (activeActivityId: string | null) => void;
}

// Subscribes to Signal WebSocket events and invalidates the relevant queries so
// the deck, activities, and live responses stay in sync across all screens.
export function useSignalRealtime(spaceId: string, opts: RealtimeOptions = {}) {
  return useWebSocket({
    spaceId,
    enabled: !!spaceId,
    onMessage: (message) => {
      switch (message.type) {
        case 'signal_deck_updated':
        case 'signal_activities_updated':
          queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/signal`] });
          break;
        case 'signal_activity_changed':
          queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/signal`] });
          opts.onActivityChanged?.(message.data?.activeActivityId ?? null);
          break;
        case 'signal_response_added': {
          const activityId = message.data?.activityId;
          if (activityId) {
            queryClient.invalidateQueries({
              queryKey: [`/api/spaces/${spaceId}/signal/activities/${activityId}/responses`],
            });
          }
          break;
        }
      }
    },
  });
}
