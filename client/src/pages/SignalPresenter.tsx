import { useParams } from 'wouter';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radio, Lock, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '@/hooks/use-auth';
import { useSignalDeck, useSignalResponses, useSignalRealtime } from '@/components/signal/useSignal';
import SignalResult from '@/components/signal/SignalResultLazy';
import { entryCount } from '@/components/signal/aggregation';
import type { Space, SignalActivity } from '@shared/schema';

export default function SignalPresenter() {
  const params = useParams<{ org: string; space: string }>();
  const spaceId = params.space!;

  const { user, isLoading: authLoading } = useAuth();
  const canPresent = !!user && ["facilitator", "company_admin", "global_admin"].includes(user.role);

  useSignalRealtime(spaceId);
  const { data: space } = useQuery<Space>({ queryKey: [`/api/spaces/${spaceId}`] });
  const { data: signal } = useSignalDeck(spaceId, canPresent);

  const deck = signal?.deck ?? null;
  const activities = signal?.activities ?? [];
  const active: SignalActivity | null = useMemo(
    () => activities.find((a) => a.id === deck?.activeActivityId) ?? null,
    [activities, deck?.activeActivityId],
  );
  const { data: responses = [] } = useSignalResponses(spaceId, active?.id, !!active && canPresent);

  const joinUrl = `${window.location.origin}/o/${params.org}/s/${params.space}/signal`;
  const displayCode = space?.code ?? params.space;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [joinUrl]);

  useEffect(() => {
    document.title = `Signal — ${space?.name ?? 'Presenter'} | Nebula`;
  }, [space]);

  const liveIndex = active ? activities.findIndex((a) => a.id === active.id) : -1;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canPresent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <Lock className="mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Presenter screen</h1>
        <p className="mt-1 max-w-sm text-muted-foreground">
          The Signal presenter view is only available to facilitators. Please sign in with a facilitator account.
        </p>
      </div>
    );
  }

  const JoinPanel = () => (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-4 text-center shadow-md w-52 shrink-0">
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="Join QR code"
          className="w-40 h-40 rounded"
          data-testid="img-signal-presenter-qr"
        />
      ) : (
        <div className="w-40 h-40 flex items-center justify-center rounded bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Workspace code</p>
        <p className="font-mono text-2xl font-bold tracking-widest text-foreground" data-testid="text-signal-presenter-code">
          {displayCode}
        </p>
      </div>
      <div className="w-full">
        <p className="text-xs text-muted-foreground mb-1">Or visit</p>
        <p
          className="text-sm font-semibold text-foreground"
          data-testid="text-signal-presenter-url"
        >
          nebula.synozur.com
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-8 py-5">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-muted-foreground" />
          <span className="text-lg font-semibold tracking-wide">{deck?.title ?? 'Signal'}</span>
          {space?.name && (
            <span className="text-base text-muted-foreground">— {space.name}</span>
          )}
        </div>
        {active && (
          <span className="text-lg font-medium text-muted-foreground" data-testid="signal-presenter-progress">
            {liveIndex + 1} / {activities.length}
          </span>
        )}
      </header>

      <main className="flex flex-1 px-8 py-10 gap-8">
        {!active ? (
          /* ── Idle state: centred prompt + large join panel side by side ── */
          <div className="flex flex-1 flex-col items-center justify-center gap-10 lg:flex-row lg:items-center lg:justify-center">
            <div className="text-center" data-testid="signal-presenter-idle">
              <Radio className="mx-auto mb-6 h-16 w-16 opacity-30" />
              <p className="text-5xl font-bold">Waiting to go live</p>
              <p className="mt-3 text-2xl text-muted-foreground">
                The facilitator hasn't started an activity yet.
              </p>
              <p className="mt-6 text-xl text-muted-foreground">
                Scan the code or visit the URL below to join now.
              </p>
            </div>

            {/* Large join panel for idle state */}
            <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center shadow-lg w-72 shrink-0">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Join QR code"
                  className="w-56 h-56 rounded"
                  data-testid="img-signal-presenter-qr-idle"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center rounded bg-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Workspace code</p>
                <p className="font-mono text-4xl font-bold tracking-widest text-foreground" data-testid="text-signal-presenter-code-idle">
                  {displayCode}
                </p>
              </div>
              <div className="w-full">
                <p className="text-sm text-muted-foreground mb-1">Or visit</p>
                <p className="text-xl font-semibold text-foreground">
                  nebula.synozur.com
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ── Active state: large result on left, compact join panel pinned right ── */
          <div className="flex flex-1 gap-8 items-start">
            <div className="flex flex-1 flex-col min-w-0">
              <h1
                className="mb-3 text-5xl font-bold leading-tight sm:text-6xl"
                data-testid="signal-presenter-prompt"
              >
                {active.prompt || 'Live responses'}
              </h1>
              <p
                className="mb-10 text-2xl text-muted-foreground"
                data-testid="signal-presenter-count"
              >
                {entryCount(active, responses as any)}&nbsp;
                {responses.length === 1 ? 'response' : 'responses'}
                {deck?.responsesOpen ? '' : ' · closed'}
              </p>
              <SignalResult activity={active} responses={responses as any} height={500} />
            </div>

            {/* Compact join panel stays visible while activity runs */}
            <div className="sticky top-8 pt-2">
              <JoinPanel />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
