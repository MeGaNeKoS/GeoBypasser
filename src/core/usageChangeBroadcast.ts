export const USAGE_BROADCAST_INTERVAL_MS = 1000;

export type Scheduler = (run: () => void, afterMs: number) => void;

export function createUsageChangeBroadcast (send: () => void, schedule: Scheduler): () => void {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    schedule(() => {
      pending = false;
      send();
    }, USAGE_BROADCAST_INTERVAL_MS);
  };
}
