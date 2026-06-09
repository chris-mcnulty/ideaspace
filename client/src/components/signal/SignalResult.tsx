import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts';
import type { SignalActivity, SignalMultipleChoiceConfig, SignalNumericConfig } from '@shared/schema';
import WordCloud from './WordCloud';
import {
  wordCounts, choiceCounts, numericStats, histogram, SIGNAL_PALETTE,
  type SignalResponseLite,
} from './aggregation';

interface SignalResultProps {
  activity: SignalActivity;
  responses: SignalResponseLite[];
  height?: number;
}

// Renders the live aggregated visualization for a Signal activity. Pure: given
// the activity + current responses, it draws the right chart.
export default function SignalResult({ activity, responses, height = 360 }: SignalResultProps) {
  if (activity.type === 'word_cloud') {
    return <WordCloud words={wordCounts(responses)} height={height} />;
  }

  if (activity.type === 'multiple_choice') {
    const cfg = activity.config as SignalMultipleChoiceConfig;
    const data = choiceCounts(responses, cfg.options ?? []);
    if ((cfg.options ?? []).length === 0) {
      return <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>No options configured.</div>;
    }
    return (
      <div style={{ height }} data-testid="signal-mc-result">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 40, top: 8, bottom: 8 }}>
            <XAxis type="number" allowDecimals={false} hide />
            <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 13 }} />
            <Tooltip formatter={(v: number, _n, p: any) => [`${v} (${p.payload.pct}%)`, 'Votes']} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {data.map((_, i) => <Cell key={i} fill={SIGNAL_PALETTE[i % SIGNAL_PALETTE.length]} />)}
              <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // numeric
  const cfg = activity.config as SignalNumericConfig;
  const stats = numericStats(responses);
  if (stats.count === 0) {
    return <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>Waiting for responses…</div>;
  }

  if (cfg.chartStyle === 'bar') {
    // Left-to-right bar chart of each distinct value's frequency.
    const freq = new Map<number, number>();
    for (const v of stats.values) freq.set(v, (freq.get(v) ?? 0) + 1);
    const data = Array.from(freq.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({ label: `${value}`, count }));
    return (
      <div data-testid="signal-numeric-result">
        <NumericSummary stats={stats} />
        <div style={{ height: height - 48 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill={SIGNAL_PALETTE[1]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // histogram (distribution)
  const bins = histogram(stats.values, cfg.min, cfg.max, 10);
  return (
    <div data-testid="signal-numeric-result">
      <NumericSummary stats={stats} />
      <div style={{ height: height - 48 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <ReferenceLine x={`${Math.round(stats.avg * 10) / 10}`} stroke="#EF4444" strokeDasharray="4 4" />
            <Bar dataKey="count" fill={SIGNAL_PALETTE[0]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function NumericSummary({ stats }: { stats: ReturnType<typeof numericStats> }) {
  return (
    <div className="flex items-baseline gap-4 px-2 pb-1 text-sm">
      <span className="text-2xl font-bold" data-testid="signal-numeric-avg">{Math.round(stats.avg * 100) / 100}</span>
      <span className="text-muted-foreground">average</span>
      <span className="text-muted-foreground">· {stats.count} responses · range {stats.min}–{stats.max}</span>
    </div>
  );
}
