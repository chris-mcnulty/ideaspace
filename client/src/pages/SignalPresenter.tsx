import { useParams } from 'wouter';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { useSignalDeck, useSignalResponses, useSignalRealtime } from '@/components/signal/useSignal';
import SignalResult from '@/components/signal/SignalResult';
import { entryCount } from '@/components/signal/aggregation';
import type { Space, SignalActivity } from '@shared/schema';

// Full-screen presenter / projector view. Shows the live activity's prompt and
// an aggregating visualization that updates in real time.
export default function SignalPresenter() {
  const params = useParams<{ org: string; space: string }>();
  const spaceId = params.space!;

  useSignalRealtime(spaceId);
  const { data: space } = useQuery<Space>({ queryKey: [`/api/spaces/${spaceId}`] });
  const { data: signal } = useSignalDeck(spaceId);

  const deck = signal?.deck ?? null;
  const activities = signal?.activities ?? [];
  const active: SignalActivity | null = useMemo(
    () => activities.find((a) => a.id === deck?.activeActivityId) ?? null,
    [activities, deck?.activeActivityId],
  );
  const { data: responses = [] } = useSignalResponses(spaceId, active?.id, !!active);

  useEffect(() => {
    document.title = `Signal — ${space?.name ?? 'Presenter'} | Nebula`;
  }, [space]);

  const liveIndex = active ? activities.findIndex((a) => a.id === active.id) : -1;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Radio className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">{deck?.title ?? 'Signal'}</span>
        </div>
        {active && (
          <span className="text-sm text-muted-foreground" data-testid="signal-presenter-progress">
            {liveIndex + 1} / {activities.length}
          </span>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-10">
        {!active ? (
          <div className="text-center text-muted-foreground" data-testid="signal-presenter-idle">
            <Radio className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-2xl font-semibold">Waiting to go live</p>
            <p className="mt-1">The facilitator hasn't started an activity yet.</p>
          </div>
        ) : (
          <div className="w-full max-w-5xl">
            <h1 className="mb-2 text-center text-3xl font-bold sm:text-4xl" data-testid="signal-presenter-prompt">
              {active.prompt || 'Live responses'}
            </h1>
            <p className="mb-8 text-center text-muted-foreground" data-testid="signal-presenter-count">
              {entryCount(active, responses as any)} response{responses.length === 1 ? '' : 's'}
              {deck?.responsesOpen ? '' : ' · closed'}
            </p>
            <SignalResult activity={active} responses={responses as any} height={460} />
          </div>
        )}
      </main>
    </div>
  );
}
