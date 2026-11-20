import { useEffect } from 'react';
import type { ThemePreference } from '@/types/database';

const STORAGE_KEY = 'steady-theme';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(pref: ThemePreference): void {
  const dark = pref === 'dark' || (pref === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
  try {
    // Lets index.html apply the theme before first paint on the next visit.
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies.
  }
}

export function storedTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignore
  }
  return 'system';
}

/** Applies the preference and follows OS changes while it is "system". */
export function useApplyTheme(pref: ThemePreference): void {
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);
}

/* ---------------------------------------------------------------- accent -- */

export type AccentColour = 'green' | 'blue' | 'purple' | 'orange' | 'yellow' | 'pink';

const ACCENT_KEY = 'steady-accent';

/** Options for Settings → Appearance. `swatch` is the light-mode primary, for the picker only. */
export const ACCENTS: Array<{ value: AccentColour; label: string; swatch: string }> = [
  { value: 'green', label: 'Green', swatch: '#1F6B5A' },
  { value: 'blue', label: 'Blue', swatch: '#2F628C' },
  { value: 'purple', label: 'Purple', swatch: '#6750A4' },
  { value: 'orange', label: 'Orange', swatch: '#9A4A1E' },
  { value: 'yellow', label: 'Yellow', swatch: '#C9A227' },
  { value: 'pink', label: 'Pink', swatch: '#8C4A60' },
];

const isAccent = (v: unknown): v is AccentColour => ACCENTS.some((a) => a.value === v);

export function storedAccent(): AccentColour {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    if (isAccent(v)) return v;
  } catch {
    // ignore
  }
  return 'green';
}

/** Applies an accent colour now and remembers it on this device. */
export function applyAccent(accent: AccentColour): void {
  if (accent === 'green') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
  try {
    localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    // Storage can be unavailable (private mode); the colour still applies for this visit.
  }
}
