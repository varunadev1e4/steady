/**
 * A short vibration on phones that support it (Android Chrome). iPhone browsers
 * ignore it. Never used for errors or nagging, only to confirm a tap.
 */
export function haptic(kind: 'tap' | 'success' = 'tap'): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(kind === 'success' ? [12, 60, 18] : 10);
  } catch {
    // Some browsers throw when vibration isn't allowed; it's only a nicety.
  }
}
