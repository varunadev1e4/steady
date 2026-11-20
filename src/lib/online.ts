import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export class OfflineError extends Error {
  constructor() {
    super("You're offline, so this wasn't saved. Try again once you're connected.");
    this.name = 'OfflineError';
  }
}

/**
 * Call at the start of every write. Writes are blocked while offline rather
 * than queued, so nothing is ever silently lost.
 */
export function assertOnline(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new OfflineError();
}
