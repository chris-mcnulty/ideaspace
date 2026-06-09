import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { SignalResultProps } from './SignalResult';

// Lazy boundary for the Signal visualizations. Keeps the heavy charting deps
// (recharts + d3-cloud) out of the main bundle — they load only when a Signal
// result is actually rendered (facilitator preview or presenter screen).
const SignalResult = lazy(() => import('./SignalResult'));

export default function SignalResultLazy(props: SignalResultProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center" style={{ height: props.height ?? 360 }}>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SignalResult {...props} />
    </Suspense>
  );
}
