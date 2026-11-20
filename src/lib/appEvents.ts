import { useEffect } from 'react';

/** App-wide UI events, so the rail, keyboard shortcuts and palette can open shared sheets. */
type AppEvent = 'steady:capture' | 'steady:palette';

export const openCapture = () => window.dispatchEvent(new Event('steady:capture'));
export const openPalette = () => window.dispatchEvent(new Event('steady:palette'));

export function useAppEvent(name: AppEvent, handler: () => void): void {
  useEffect(() => {
    window.addEventListener(name, handler);
    return () => window.removeEventListener(name, handler);
  }, [name, handler]);
}

/** True when the user is typing, so single-key shortcuts stay out of the way. */
export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
}
