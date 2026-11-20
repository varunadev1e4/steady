import { Link, useLocation } from 'react-router-dom';
import { Lock, Plus, Search, Settings } from 'lucide-react';
import { RAIL_ITEMS, isVisible, sectionFor } from '@/lib/navigation';
import { openCapture, openPalette } from '@/lib/appEvents';
import { useLoadedProfile } from '@/features/profile/queries';
import { useModuleEnabled } from '@/features/profile/useToday';
import { useAppLock } from '@/features/lock/lockContext';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';

function RailButton({ label, hint, onClick, icon: Icon }: { label: string; hint: string; onClick: () => void; icon: typeof Search }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className="group flex w-full flex-col items-center gap-1 py-1 text-xs font-medium text-muted hover:text-ink"
    >
      <span className="flex h-8 w-14 items-center justify-center rounded-full transition-colors group-hover:bg-raised">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      {label}
    </button>
  );
}

/**
 * Material 3 navigation rail for tablets and computers: a Capture button,
 * the main destinations with an active-indicator pill, and search, lock and
 * settings at the bottom. Leaves the rest of the screen to the content.
 */
export function NavRail() {
  const profile = useLoadedProfile();
  const lock = useAppLock();
  const notesOn = useModuleEnabled('notes');
  const tasksOn = useModuleEnabled('tasks');
  const { pathname } = useLocation();
  const current = sectionFor(pathname, true);
  const items = RAIL_ITEMS.filter((i) => isVisible(i, profile.disabled_modules));

  return (
    <aside className="sticky top-0 hidden h-dvh w-24 shrink-0 flex-col items-center py-5 print:!hidden md:flex">
      <Link to="/" className="mb-5 rounded-full p-1" aria-label="Steady, go to Today">
        <Logo markOnly />
      </Link>
      {(notesOn || tasksOn) && (
        <button
          type="button"
          onClick={openCapture}
          title="Capture a note, task or water (C)"
          aria-label="Quick capture: note, task or water"
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-container text-accent-on-container shadow-soft transition-all hover:shadow-lift active:scale-95"
        >
          <Plus className="h-6 w-6" aria-hidden />
        </button>
      )}
      <nav aria-label="Main" className="flex w-full flex-1 flex-col items-center gap-3">
        {items.map(({ to, label, icon: Icon }) => {
          const active = current === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className="group flex w-full flex-col items-center gap-1 text-xs"
            >
              <span
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300',
                  active ? 'bg-accent-soft text-ink' : 'text-muted group-hover:bg-raised group-hover:text-ink',
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              </span>
              <span className={active ? 'font-bold text-ink' : 'font-medium text-muted group-hover:text-ink'}>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex w-full flex-col items-center gap-2">
        <RailButton label="Search" hint="Search and jump anywhere (Ctrl+K)" onClick={openPalette} icon={Search} />
        {lock.enabled && <RailButton label="Lock" hint="Lock Steady now" onClick={lock.lockNow} icon={Lock} />}
        <Link
          to="/settings"
          aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
          className="group flex w-full flex-col items-center gap-1 py-1 text-xs font-medium text-muted hover:text-ink"
        >
          <span
            className={cn(
              'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
              pathname.startsWith('/settings') ? 'bg-accent-soft text-ink' : 'group-hover:bg-raised',
            )}
          >
            <Settings className="h-5 w-5" aria-hidden />
          </span>
          Settings
        </Link>
      </div>
    </aside>
  );
}
