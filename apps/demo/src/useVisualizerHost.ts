import { useEffect, useState, useSyncExternalStore } from 'react';
import type { VisualizerHost, VisualizerSnapshot } from '@r-a-i-t-h/viz-host';

/** React subscription helper for optional UI consumers. */
export function useVisualizerSnapshot(
  host: VisualizerHost | null,
): VisualizerSnapshot | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!host) return () => {};
      return host.subscribe(() => onStoreChange());
    },
    () => (host ? host.getSnapshot() : null),
    () => (host ? host.getSnapshot() : null),
  );
}

/** Prefer {@link useVisualizerSnapshot}; kept for apps that want useState. */
export function useVisualizerHostState(
  host: VisualizerHost | null,
): VisualizerSnapshot | null {
  const [snapshot, setSnapshot] = useState<VisualizerSnapshot | null>(
    () => host?.getSnapshot() ?? null,
  );

  useEffect(() => {
    if (!host) {
      setSnapshot(null);
      return;
    }
    return host.subscribe(setSnapshot);
  }, [host]);

  return snapshot;
}
