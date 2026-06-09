import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Radio, Plus, Trash2, Play, RotateCcw, ExternalLink, ChevronLeft, ChevronRight,
  Cloud, BarChart3, Hash, Pencil, Loader2,
} from 'lucide-react';
import { useSignalDeck, useSignalResponses, useSignalRealtime } from '@/components/signal/useSignal';
import SignalResult from '@/components/signal/SignalResultLazy';
import { entryCount } from '@/components/signal/aggregation';
import {
  SIGNAL_ACTIVITY_TYPES, type SignalActivity, type SignalActivityType,
  type Note, type Category,
} from '@shared/schema';
import { Sparkles } from 'lucide-react';

const TYPE_META: Record<SignalActivityType, { label: string; icon: typeof Cloud }> = {
  word_cloud: { label: 'Word cloud', icon: Cloud },
  multiple_choice: { label: 'Multiple choice', icon: BarChart3 },
  numeric: { label: 'Numeric / scale', icon: Hash },
};

interface DraftConfig {
  // word cloud
  maxEntriesPerParticipant?: number;
  normalizeCase?: boolean;
  // multiple choice
  options?: { id: string; label: string }[];
  allowMultiple?: boolean;
  // numeric
  min?: number;
  max?: number;
  step?: number;
  chartStyle?: 'histogram' | 'bar';
}

function defaultConfig(type: SignalActivityType): DraftConfig {
  if (type === 'word_cloud') return { maxEntriesPerParticipant: 3, normalizeCase: true };
  if (type === 'numeric') return { min: 0, max: 10, step: 1, chartStyle: 'histogram' };
  return { options: [{ id: '', label: '' }, { id: '', label: '' }], allowMultiple: false };
}

export default function SignalFacilitator({ spaceId, orgSlug }: { spaceId: string; orgSlug?: string }) {
  const { toast } = useToast();
  useSignalRealtime(spaceId);
  const { data: signal, isLoading } = useSignalDeck(spaceId);

  const deck = signal?.deck ?? null;
  const activities = signal?.activities ?? [];
  const active = useMemo(
    () => activities.find((a) => a.id === deck?.activeActivityId) ?? null,
    [activities, deck?.activeActivityId],
  );
  const { data: responses = [] } = useSignalResponses(spaceId, active?.id, !!active);

  const [editing, setEditing] = useState<SignalActivity | null>(null);
  const [creatingType, setCreatingType] = useState<SignalActivityType | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/spaces/${spaceId}/signal`] });

  const updateDeck = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest('PUT', `/api/spaces/${spaceId}/signal/deck`, body),
    onSuccess: invalidate,
  });
  const deleteActivity = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/spaces/${spaceId}/signal/activities/${id}`),
    onSuccess: invalidate,
  });
  const resetResponses = useMutation({
    mutationFn: (id: string) => apiRequest('POST', `/api/spaces/${spaceId}/signal/activities/${id}/reset`, {}),
    onSuccess: () => toast({ title: 'Responses cleared' }),
  });
  const pushToIdeas = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/spaces/${spaceId}/signal/activities/${id}/push-to-ideas`, {});
      return res.json() as Promise<{ created: number }>;
    },
    onSuccess: (r) => toast({
      title: r.created > 0 ? `Added ${r.created} idea${r.created === 1 ? '' : 's'}` : 'No new ideas',
      description: r.created > 0 ? 'New words were added to the workspace ideas.' : 'All words already exist as ideas.',
    }),
    onError: (e: any) => toast({ title: 'Could not push to ideas', description: e?.message, variant: 'destructive' }),
  });

  const goLive = (id: string) => updateDeck.mutate({ activeActivityId: id, responsesOpen: true });
  const liveIndex = active ? activities.findIndex((a) => a.id === active.id) : -1;
  const goPrev = () => { if (liveIndex > 0) goLive(activities[liveIndex - 1].id); };
  const goNext = () => { if (liveIndex >= 0 && liveIndex < activities.length - 1) goLive(activities[liveIndex + 1].id); };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* Deck builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Input
            defaultValue={deck?.title ?? 'Live Session'}
            onBlur={(e) => { if (e.target.value !== deck?.title) updateDeck.mutate({ title: e.target.value }); }}
            className="max-w-[260px] font-semibold"
            data-testid="input-signal-deck-title"
          />
          {orgSlug && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/o/${orgSlug}/s/${spaceId}/signal/present`} target="_blank" rel="noreferrer" data-testid="button-open-presenter">
                <ExternalLink className="mr-2 h-4 w-4" /> Open Presenter
              </a>
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {activities.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No activities yet. Add a word cloud, poll, or numeric question below.
            </p>
          )}
          {activities.map((a, i) => {
            const Meta = TYPE_META[a.type];
            const isLive = active?.id === a.id;
            return (
              <Card key={a.id} className={isLive ? 'border-primary' : ''} data-testid={`signal-activity-${a.id}`}>
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                  <Meta.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.prompt || <span className="text-muted-foreground">Untitled {Meta.label}</span>}</p>
                    <p className="text-xs text-muted-foreground">{Meta.label}</p>
                  </div>
                  {isLive && <Badge className="shrink-0">Live</Badge>}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="icon" variant={isLive ? 'default' : 'ghost'} onClick={() => goLive(a.id)} title="Go live" data-testid={`button-golive-${a.id}`}>
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(a)} title="Edit" data-testid={`button-edit-${a.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => resetResponses.mutate(a.id)} title="Clear responses" data-testid={`button-reset-${a.id}`}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteActivity.mutate(a.id)} title="Delete" data-testid={`button-delete-${a.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {SIGNAL_ACTIVITY_TYPES.map((t) => {
            const Meta = TYPE_META[t];
            return (
              <Button key={t} variant="outline" size="sm" onClick={() => setCreatingType(t)} data-testid={`button-add-${t}`}>
                <Plus className="mr-1.5 h-4 w-4" /> <Meta.icon className="mr-1.5 h-4 w-4" /> {Meta.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Live control + preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={goPrev} disabled={liveIndex <= 0} data-testid="button-prev"><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={goNext} disabled={liveIndex < 0 || liveIndex >= activities.length - 1} data-testid="button-next"><ChevronRight className="h-4 w-4" /></Button>
            <span className="text-sm text-muted-foreground">{active ? `Live: ${liveIndex + 1}/${activities.length}` : 'Nothing live'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="responses-open" className="text-sm">Responses open</Label>
            <Switch
              id="responses-open"
              checked={!!deck?.responsesOpen}
              onCheckedChange={(v) => updateDeck.mutate({ responsesOpen: v })}
              disabled={!active}
              data-testid="switch-responses-open"
            />
          </div>
        </div>

        <Card>
          <CardContent className="py-6">
            {active ? (
              <>
                <h3 className="mb-1 text-center text-xl font-semibold">{active.prompt || 'Live responses'}</h3>
                <p className="mb-3 text-center text-sm text-muted-foreground">
                  {entryCount(active, responses as any)} response{responses.length === 1 ? '' : 's'}
                </p>
                {active.type === 'word_cloud' && responses.length > 0 && (
                  <div className="mb-3 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => pushToIdeas.mutate(active.id)}
                      disabled={pushToIdeas.isPending}
                      data-testid="button-push-to-ideas"
                    >
                      {pushToIdeas.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Send words to Ideas
                    </Button>
                  </div>
                )}
                <SignalResult activity={active} responses={responses as any} height={360} />
              </>
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                <Radio className="mx-auto mb-3 h-8 w-8 opacity-50" />
                <p>Press <Play className="inline h-4 w-4" /> on an activity to go live.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(creatingType || editing) && (
        <ActivityDialog
          spaceId={spaceId}
          activity={editing}
          createType={creatingType}
          onClose={() => { setCreatingType(null); setEditing(null); }}
          onSaved={() => { setCreatingType(null); setEditing(null); invalidate(); }}
        />
      )}
    </div>
  );
}

function ActivityDialog({
  spaceId, activity, createType, onClose, onSaved,
}: {
  spaceId: string;
  activity: SignalActivity | null;
  createType: SignalActivityType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const type = (activity?.type ?? createType)!;
  const Meta = TYPE_META[type];
  const [prompt, setPrompt] = useState(activity?.prompt ?? '');
  const [config, setConfig] = useState<DraftConfig>(
    activity ? { ...(activity.config as DraftConfig) } : defaultConfig(type),
  );
  const [seedCategory, setSeedCategory] = useState<string>('all');

  // v2 hook — seed multiple-choice options from existing workspace ideas.
  const isMC = type === 'multiple_choice';
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: [`/api/spaces/${spaceId}/categories`], enabled: isMC });
  const { data: notes = [] } = useQuery<Note[]>({ queryKey: [`/api/spaces/${spaceId}/notes`], enabled: isMC });

  const seedFromIdeas = () => {
    const pool = seedCategory === 'all' ? notes : notes.filter((n) => n.manualCategoryId === seedCategory);
    const existingLabels = new Set((config.options ?? []).map((o) => o.label.trim().toLowerCase()).filter(Boolean));
    const additions: { id: string; label: string }[] = [];
    for (const n of pool) {
      const label = (n.content ?? '').replace(/<[^>]*>?/gm, '').trim().slice(0, 80);
      const key = label.toLowerCase();
      if (!label || existingLabels.has(key)) continue;
      existingLabels.add(key);
      additions.push({ id: '', label });
      if (additions.length >= 20) break;
    }
    if (additions.length === 0) {
      toast({ title: 'No new ideas to add', description: 'No matching ideas, or they are already options.' });
      return;
    }
    // Replace empty placeholder options, then append the seeded ones.
    setConfig((c) => {
      const kept = (c.options ?? []).filter((o) => o.label.trim().length > 0);
      return { ...c, options: [...kept, ...additions] };
    });
    toast({ title: `Added ${additions.length} option${additions.length === 1 ? '' : 's'} from ideas` });
  };

  const save = useMutation({
    mutationFn: () => {
      const body = { prompt, config };
      return activity
        ? apiRequest('PUT', `/api/spaces/${spaceId}/signal/activities/${activity.id}`, body)
        : apiRequest('POST', `/api/spaces/${spaceId}/signal/activities`, { type, ...body });
    },
    onSuccess: () => { toast({ title: activity ? 'Activity updated' : 'Activity added' }); onSaved(); },
    onError: (e: any) => toast({ title: 'Could not save', description: e?.message, variant: 'destructive' }),
  });

  const updateOption = (i: number, label: string) => {
    setConfig((c) => {
      const options = [...(c.options ?? [])];
      options[i] = { ...options[i], label };
      return { ...c, options };
    });
  };
  const addOption = () => setConfig((c) => ({ ...c, options: [...(c.options ?? []), { id: '', label: '' }] }));
  const removeOption = (i: number) => setConfig((c) => ({ ...c, options: (c.options ?? []).filter((_, idx) => idx !== i) }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Meta.icon className="h-5 w-5" /> {activity ? 'Edit' : 'New'} {Meta.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="activity-prompt">Question / prompt</Label>
            <Textarea id="activity-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What would you like to ask?" data-testid="input-activity-prompt" />
          </div>

          {type === 'word_cloud' && (
            <div className="space-y-1.5">
              <Label htmlFor="max-entries">Max words per participant</Label>
              <Input id="max-entries" type="number" min={1} max={10} value={config.maxEntriesPerParticipant ?? 3}
                onChange={(e) => setConfig((c) => ({ ...c, maxEntriesPerParticipant: parseInt(e.target.value) || 1 }))} data-testid="input-max-entries" />
            </div>
          )}

          {type === 'numeric' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="num-min">Min</Label>
                <Input id="num-min" type="number" value={config.min ?? 0} onChange={(e) => setConfig((c) => ({ ...c, min: Number(e.target.value) }))} data-testid="input-num-min" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="num-max">Max</Label>
                <Input id="num-max" type="number" value={config.max ?? 10} onChange={(e) => setConfig((c) => ({ ...c, max: Number(e.target.value) }))} data-testid="input-num-max" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="num-step">Step</Label>
                <Input id="num-step" type="number" min={0.01} step="any" value={config.step ?? 1} onChange={(e) => setConfig((c) => ({ ...c, step: Number(e.target.value) || 1 }))} data-testid="input-num-step" />
              </div>
              <div className="col-span-3 space-y-1.5">
                <Label>Chart style</Label>
                <Select value={config.chartStyle ?? 'histogram'} onValueChange={(v) => setConfig((c) => ({ ...c, chartStyle: v as 'histogram' | 'bar' }))}>
                  <SelectTrigger data-testid="select-chart-style"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="histogram">Distribution (bell curve)</SelectItem>
                    <SelectItem value="bar">Bar chart (left → right)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {type === 'multiple_choice' && (
            <div className="space-y-2">
              <div className="flex items-end gap-2 rounded-md border bg-muted/30 p-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Seed options from workspace ideas</Label>
                  <Select value={seedCategory} onValueChange={setSeedCategory}>
                    <SelectTrigger data-testid="select-seed-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ideas</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" onClick={seedFromIdeas} data-testid="button-seed-from-ideas">
                  <Sparkles className="mr-1.5 h-4 w-4" /> Add from ideas
                </Button>
              </div>
              <Label>Options</Label>
              {(config.options ?? []).map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={o.label} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} data-testid={`input-option-${i}`} />
                  <Button size="icon" variant="ghost" onClick={() => removeOption(i)} disabled={(config.options ?? []).length <= 2}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addOption} data-testid="button-add-option"><Plus className="mr-1.5 h-4 w-4" /> Add option</Button>
              <div className="flex items-center gap-2 pt-1">
                <Switch id="allow-multiple" checked={!!config.allowMultiple} onCheckedChange={(v) => setConfig((c) => ({ ...c, allowMultiple: v }))} data-testid="switch-allow-multiple" />
                <Label htmlFor="allow-multiple" className="text-sm">Allow multiple selections</Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-activity">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
