import { useParams } from 'wouter';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Radio, Loader2, Lock } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '@/hooks/use-auth';
import { useSignalDeck, useSignalResponses, useSignalRealtime } from '@/components/signal/useSignal';
import SignalResult from '@/components/signal/SignalResultLazy';
import { entryCount } from '@/components/signal/aggregation';
import type { Space, SignalActivity } from '@shared/schema';

// Chrome-free embed view — no header, no nav. Designed to be opened in a
// browser window or tab alongside a presentation deck. Shows the live chart,
// QR code, and workspace join code, auto-updating via WebSocket.
export default function SignalEmbed() {
  const params = useParams<{ org: string; space: string }>();
  const spaceId = params.space!;

  const { user, isLoading: authLoading } = useAuth();
  const canView = !!user;

  useSignalRealtime(spaceId);
  const { data: space } = useQuery<Space>({ queryKey: [`/api/spaces/${spaceId}`] });
  const { data: signal } = useSignalDeck(spaceId, { enabled: canView, refetchInterval: 5000 });

  const deck = signal?.deck ?? null;
  const activities = signal?.activities ?? [];
  const active: SignalActivity | null = useMemo(
    () => activities.find((a) => a.id === deck?.activeActivityId) ?? null,
    [activities, deck?.activeActivityId],
  );
  const { data: responses = [] } = useSignalResponses(spaceId, active?.id, !!active && canView);

  const joinUrl = `${window.location.origin}/o/${params.org}/s/${params.space}/signal`;
  const displayCode = space?.code ?? params.space;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 180,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [joinUrl]);

  useEffect(() => {
    document.title = `Signal Embed — ${space?.name ?? 'Live'} | Nebula`;
  }, [space]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <Lock className="mb-4 h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-semibold">Sign in to view</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Please sign in with an account that has access to this workspace.
        </p>
      </div>
    );
  }

  // QR + code panel — same in both idle and active states
  const JoinPanel = ({ large = false }: { large?: boolean }) => (
    <div className={`flex flex-col items-center gap-2 ${large ? 'gap-4' : 'gap-2'}`}>
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="Join QR code"
          className={large ? 'w-44 h-44 rounded' : 'w-32 h-32 rounded'}
          data-testid="img-embed-qr"
        />
      ) : (
        <div className={`flex items-center justify-center rounded bg-muted ${large ? 'w-44 h-44' : 'w-32 h-32'}`}>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div className="text-center">
        <p className={`text-muted-foreground ${large ? 'text-sm' : 'text-xs'}`}>Join at nebula.synozur.com</p>
        <p
          className={`font-mono font-bold tracking-widest text-foreground ${large ? 'text-4xl' : 'text-2xl'}`}
          data-testid="text-embed-code"
        >
          {displayCode}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background p-6">
      {!active ? (
        /* ── Idle: centred waiting message + large join panel ── */
        <div className="flex flex-1 flex-col items-center justify-center gap-10 lg:flex-row lg:items-center lg:justify-center">
          <div className="text-center" data-testid="embed-idle">
            <Radio className="mx-auto mb-5 h-14 w-14 opacity-30" />
            <p className="text-4xl font-bold">Waiting to go live</p>
            <p className="mt-2 text-xl text-muted-foreground">
              {deck?.title ?? 'The facilitator hasn\'t started an activity yet.'}
            </p>
          </div>
          <JoinPanel large />
        </div>
      ) : (
        /* ── Active: chart fills the space, QR + code in corner ── */
        <div className="flex flex-1 gap-6 items-start">
          <div className="flex flex-1 flex-col min-w-0">
            <p
              className="mb-2 text-4xl font-bold leading-tight sm:text-5xl"
              data-testid="embed-prompt"
            >
              {active.prompt || 'Live responses'}
            </p>
            <p className="mb-6 text-xl text-muted-foreground" data-testid="embed-count">
              {entryCount(active, responses as any)}&nbsp;
              {responses.length === 1 ? 'response' : 'responses'}
              {deck?.responsesOpen ? '' : ' · closed'}
            </p>
            <SignalResult activity={active} responses={responses as any} height={420} large />
          </div>

          <div className="sticky top-6 shrink-0 flex flex-col items-center gap-3 rounded-lg border bg-card p-4 shadow-md">
            <JoinPanel />
          </div>
        </div>
      )}
    </div>
  );
}
