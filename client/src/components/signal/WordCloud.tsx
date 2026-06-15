import { useEffect, useMemo, useRef, useState } from 'react';
import cloud from 'd3-cloud';
import { SIGNAL_PALETTE, type WordCount } from './aggregation';

interface PlacedWord {
  text: string;
  size: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
}

interface WordCloudProps {
  words: WordCount[];
  height?: number;
  large?: boolean;
}

// Renders an aggregating word cloud using d3-cloud for spiral layout. Recomputes
// whenever the word frequencies or container width change.
export default function WordCloud({ words, height = 360, large = false }: WordCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [placed, setPlaced] = useState<PlacedWord[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setWidth(el.clientWidth || 600);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Stable signature so layout only recomputes when counts actually change.
  const signature = useMemo(
    () => words.map((w) => `${w.text}:${w.value}`).join('|') + `@${width}x${height}`,
    [words, width, height],
  );

  useEffect(() => {
    if (words.length === 0) {
      setPlaced([]);
      return;
    }
    const max = Math.max(...words.map((w) => w.value));
    const min = Math.min(...words.map((w) => w.value));
    const scale = (v: number) => {
      if (large) {
        if (max === min) return 80;
        return 40 + ((v - min) / (max - min)) * 100; // 40px..140px
      }
      if (max === min) return 36;
      return 16 + ((v - min) / (max - min)) * 56; // 16px..72px
    };

    let cancelled = false;
    const layout = cloud<{ text: string; size: number }>()
      .size([width, height])
      .words(words.slice(0, 80).map((w) => ({ text: w.text, size: scale(w.value) })))
      .padding(3)
      .rotate(() => (Math.random() < 0.5 ? 0 : 90))
      .font('Inter, sans-serif')
      .fontSize((d) => d.size as number)
      .on('end', (computed: any[]) => {
        if (cancelled) return;
        setPlaced(
          computed.map((d, i) => ({
            text: d.text,
            size: d.size,
            x: d.x,
            y: d.y,
            rotate: d.rotate,
            color: SIGNAL_PALETTE[i % SIGNAL_PALETTE.length],
          })),
        );
      });
    layout.start();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div ref={containerRef} className="w-full" style={{ height }} data-testid="signal-wordcloud">
      {words.length === 0 ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Waiting for responses…
        </div>
      ) : (
        <svg width={width} height={height} role="img" aria-label="Word cloud of responses">
          <g transform={`translate(${width / 2},${height / 2})`}>
            {placed.map((w, i) => (
              <text
                key={`${w.text}-${i}`}
                textAnchor="middle"
                transform={`translate(${w.x},${w.y}) rotate(${w.rotate})`}
                style={{ fontSize: w.size, fontFamily: 'Inter, sans-serif', fontWeight: 600, fill: w.color }}
              >
                {w.text}
              </text>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}
