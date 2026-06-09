import { useParams } from 'wouter';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserProfileMenu } from '@/components/UserProfileMenu';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Radio, CheckCircle2 } from 'lucide-react';
import { useModuleNavigation } from '@/hooks/useModuleNavigation';
import { useSignalDeck, useSignalRealtime } from '@/components/signal/useSignal';
import type { Organization, Space, SignalActivity, SignalMultipleChoiceConfig, SignalNumericConfig, SignalWordCloudConfig } from '@shared/schema';

export default function SignalParticipant() {
  const params = useParams<{ org: string; space: string }>();
  const spaceId = params.space!;
  const { toast } = useToast();

  useModuleNavigation({ spaceId, orgSlug: params.org! });
  useSignalRealtime(spaceId, { onActivityChanged: () => setSubmitted(false) });

  const { data: org } = useQuery<Organization>({ queryKey: [`/api/organizations/${params.org}`] });
  const { data: space } = useQuery<Space>({ queryKey: [`/api/spaces/${spaceId}`] });
  const { data: signal, isLoading } = useSignalDeck(spaceId);

  const deck = signal?.deck ?? null;
  const activities = signal?.activities ?? [];
  const active: SignalActivity | null = useMemo(
    () => activities.find((a) => a.id === deck?.activeActivityId) ?? null,
    [activities, deck?.activeActivityId],
  );
  const open = !!deck?.responsesOpen && !!active;

  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (org && space) document.title = `Nebula - ${org.name} ${space.name} | The Synozur Alliance`;
    else document.title = 'Nebula - Signal | The Synozur Alliance';
  }, [org, space]);

  // Reset the submitted flag whenever the live activity changes.
  useEffect(() => { setSubmitted(false); }, [active?.id]);

  const submit = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('POST', `/api/spaces/${spaceId}/signal/activities/${active!.id}/responses`, payload),
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: 'Response sent' });
    },
    onError: (e: any) => {
      toast({ title: 'Could not send', description: e?.message || 'Please try again.', variant: 'destructive' });
    },
  });

  if (!org || !space || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold truncate">{space.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" /> Signal</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <ThemeToggle />
              <UserProfileMenu />
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 p-3 sm:p-6 focus:outline-none">
        <div className="mx-auto max-w-xl">
          {!open ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground" data-testid="signal-waiting">
                <Radio className="mx-auto mb-3 h-8 w-8 opacity-60" />
                <p className="text-lg font-medium">Hang tight</p>
                <p className="text-sm">Waiting for the facilitator to start the next question…</p>
              </CardContent>
            </Card>
          ) : submitted && active!.type !== 'word_cloud' ? (
            <Card>
              <CardContent className="py-16 text-center" data-testid="signal-submitted">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
                <p className="text-lg font-medium">Response sent</p>
                <p className="text-sm text-muted-foreground">Watch the shared screen for live results.</p>
                <Button variant="outline" className="mt-4" onClick={() => setSubmitted(false)} data-testid="button-change-response">
                  Change my answer
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6">
                <h2 className="mb-4 text-xl font-semibold" data-testid="signal-prompt">{active!.prompt || 'Respond below'}</h2>
                <ActivityInput
                  activity={active!}
                  pending={submit.isPending}
                  onSubmit={(payload) => submit.mutate(payload)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

function ActivityInput({
  activity, pending, onSubmit,
}: {
  activity: SignalActivity;
  pending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  if (activity.type === 'word_cloud') {
    return <WordCloudInput config={activity.config as SignalWordCloudConfig} pending={pending} onSubmit={onSubmit} />;
  }
  if (activity.type === 'numeric') {
    return <NumericInput config={activity.config as SignalNumericConfig} pending={pending} onSubmit={onSubmit} />;
  }
  return <ChoiceInput config={activity.config as SignalMultipleChoiceConfig} pending={pending} onSubmit={onSubmit} />;
}

function WordCloudInput({ config, pending, onSubmit }: { config: SignalWordCloudConfig; pending: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [word, setWord] = useState('');
  const max = config.maxEntriesPerParticipant ?? 3;
  const send = () => {
    const w = word.trim();
    if (!w) return;
    onSubmit({ words: [w] });
    setWord('');
  };
  return (
    <div className="space-y-3">
      <Input
        value={word}
        onChange={(e) => setWord(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        placeholder="Type a word…"
        maxLength={80}
        data-testid="input-signal-word"
      />
      <Button className="w-full" onClick={send} disabled={pending || !word.trim()} data-testid="button-signal-submit-word">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send word'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">You can submit up to {max} word{max === 1 ? '' : 's'}.</p>
    </div>
  );
}

function NumericInput({ config, pending, onSubmit }: { config: SignalNumericConfig; pending: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const min = config.min ?? 0;
  const max = config.max ?? 10;
  const step = config.step ?? 1;
  const [value, setValue] = useState((min + max) / 2);
  return (
    <div className="space-y-6">
      <div className="text-center">
        <span className="text-4xl font-bold" data-testid="signal-numeric-value">{value}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => setValue(v[0])}
        data-testid="slider-signal-numeric"
      />
      <div className="flex justify-between text-xs text-muted-foreground"><span>{min}</span><span>{max}</span></div>
      <Button className="w-full" onClick={() => onSubmit({ value })} disabled={pending} data-testid="button-signal-submit-numeric">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
      </Button>
    </div>
  );
}

function ChoiceInput({ config, pending, onSubmit }: { config: SignalMultipleChoiceConfig; pending: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const options = config.options ?? [];
  const allowMultiple = !!config.allowMultiple;
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) => {
    if (allowMultiple) {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setSelected([id]);
    }
  };
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {options.map((o) => {
          const isSel = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={`w-full rounded-md border-2 px-4 py-3 text-left text-sm font-medium transition ${isSel ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
              data-testid={`signal-option-${o.id}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <Button
        className="w-full"
        onClick={() => onSubmit(allowMultiple ? { optionIds: selected } : { optionId: selected[0] })}
        disabled={pending || selected.length === 0}
        data-testid="button-signal-submit-choice"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
      </Button>
      {allowMultiple && <p className="text-center text-xs text-muted-foreground">Select all that apply.</p>}
    </div>
  );
}
