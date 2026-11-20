import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { assertOnline } from '@/lib/online';
import { useLoadedProfile } from '@/features/profile/queries';
import { useAuth, useUser } from '@/features/auth/authContext';
import { pinErrorMessage } from '@/features/auth/pinErrors';
import { Logo } from '@/components/layout/Logo';
import { FormMessage } from '@/components/ui/States';
import { AppLockContext, IDLE_MS, type AppLockApi } from './lockContext';
import { PinPad } from './PinPad';

const LAST_ACTIVE_KEY = 'steady-last-active';

const readLastActive = () => {
  try {
    return Number(localStorage.getItem(LAST_ACTIVE_KEY)) || 0;
  } catch {
    return 0;
  }
};

const writeLastActive = (t: number) => {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(t));
  } catch {
    // ignore
  }
};

function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const user = useUser();
  const profile = useLoadedProfile();
  const { signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      assertOnline();
      const { error: e } = await supabase.auth.signInWithPassword({ email: user.email!, password: value });
      if (e) throw e;
      onUnlocked();
    } catch (e) {
      setError(pinErrorMessage(e));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-10">
      <Logo />
      <span className="mt-10 flex h-14 w-14 items-center justify-center rounded-full bg-accent-container text-accent-on-container">
        <Lock className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl">{profile.display_name ? `Welcome back, ${profile.display_name}` : 'Welcome back'}</h1>
      <p className="mt-1 mb-8 text-muted">Enter your PIN to unlock Steady</p>
      <PinPad value={pin} onChange={setPin} onComplete={(v) => void submit(v)} disabled={busy} />
      <div className="mt-6 min-h-12 w-full max-w-[18rem]">{error && <FormMessage tone="error">{error}</FormMessage>}</div>
      <button type="button" className="mt-2 text-sm font-semibold text-accent-ink hover:underline" onClick={() => void signOut()}>
        Sign out instead
      </button>
    </main>
  );
}

/**
 * App-wide lock (Settings → Privacy lock). After 10 minutes without a tap or
 * key press, or when the app is reopened after a break, the whole app is
 * replaced by the lock screen; nothing private is rendered behind it. One PIN
 * entry unlocks everything.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const enabled = useLoadedProfile().journal_lock_enabled;
  const lastActive = useRef(readLastActive());
  const [locked, setLocked] = useState(() => enabled && Date.now() - readLastActive() > IDLE_MS);

  const touch = useCallback(() => {
    const now = Date.now();
    if (now - lastActive.current < 5000) return; // throttle writes
    lastActive.current = now;
    writeLastActive(now);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLocked(false);
      return;
    }
    const check = () => {
      if (Date.now() - lastActive.current > IDLE_MS) setLocked(true);
    };
    const onActivity = () => {
      check();
      touch();
    };
    const onVisible = () => document.visibilityState === 'visible' && check();
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(check, 15_000);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [enabled, touch]);

  const lockNow = useCallback(() => {
    lastActive.current = 0;
    writeLastActive(0);
    setLocked(true);
  }, []);

  const api = useMemo<AppLockApi>(() => ({ enabled, lockNow }), [enabled, lockNow]);

  if (enabled && locked) {
    return (
      <LockScreen
        onUnlocked={() => {
          lastActive.current = Date.now();
          writeLastActive(lastActive.current);
          setLocked(false);
        }}
      />
    );
  }
  return <AppLockContext.Provider value={api}>{children}</AppLockContext.Provider>;
}
