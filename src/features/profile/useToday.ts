import { useEffect, useState } from 'react';
import type { ModuleKey } from '@/types/database';
import { todayISO, type ISODate } from '@/utils/dates';
import type { WeekStart } from '@/features/habits/streaks';
import { useLoadedProfile } from './queries';

/** Re-renders every minute so "today" rolls over at local midnight. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Today's date in the user's time zone, plus the settings date maths needs. */
export function useToday(): { today: ISODate; tz: string; weekStart: WeekStart; now: Date } {
  const profile = useLoadedProfile();
  const now = useNow();
  return { today: todayISO(profile.time_zone, now), tz: profile.time_zone, weekStart: profile.week_start, now };
}

export function useModuleEnabled(key: ModuleKey): boolean {
  return !useLoadedProfile().disabled_modules.includes(key);
}
