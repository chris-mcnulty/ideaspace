// Client-side aggregation helpers for Signal activities. Responses arrive as
// anonymous rows; these turn them into the shapes each visualization needs.
import type { SignalActivity, SignalMultipleChoiceConfig } from '@shared/schema';

export interface SignalResponseLite {
  id: string;
  valueText: string | null;
  valueNumber: number | null;
  optionId: string | null;
  createdAt: string;
}

export interface WordCount {
  text: string;
  value: number;
}

export function wordCounts(responses: SignalResponseLite[]): WordCount[] {
  const counts = new Map<string, number>();
  for (const r of responses) {
    const w = (r.valueText ?? '').trim();
    if (!w) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value);
}

export interface ChoiceCount {
  id: string;
  label: string;
  count: number;
  pct: number;
}

export function choiceCounts(
  responses: SignalResponseLite[],
  options: SignalMultipleChoiceConfig['options'],
): ChoiceCount[] {
  const counts = new Map<string, number>();
  for (const r of responses) {
    if (!r.optionId) continue;
    counts.set(r.optionId, (counts.get(r.optionId) ?? 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
  return options.map((o) => {
    const count = counts.get(o.id) ?? 0;
    return { id: o.id, label: o.label, count, pct: Math.round((count / total) * 100) };
  });
}

export interface NumericStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  values: number[];
}

export function numericStats(responses: SignalResponseLite[]): NumericStats {
  const values = responses
    .map((r) => r.valueNumber)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return { count: 0, avg: 0, min: 0, max: 0, values: [] };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    values,
  };
}

// Bin numeric values into a histogram across [min, max].
export interface HistogramBin {
  label: string;
  start: number;
  count: number;
}

export function histogram(values: number[], min: number, max: number, binCount = 10): HistogramBin[] {
  const span = max - min || 1;
  const size = span / binCount;
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    label: `${Math.round((min + i * size) * 10) / 10}`,
    start: min + i * size,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / size);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].count += 1;
  }
  return bins;
}

// Total respondents shown beneath a chart. For word cloud / multi-select this is
// an entry count rather than a unique-participant count.
export function entryCount(activity: SignalActivity, responses: SignalResponseLite[]): number {
  return responses.length;
}

export const SIGNAL_PALETTE = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16',
];
