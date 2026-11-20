import { Link } from 'react-router-dom';
import { Lock, LogOut, Search } from 'lucide-react';
import { openPalette } from '@/lib/appEvents';
import { MORE_GROUPS, isVisible } from '@/lib/navigation';
import { useLoadedProfile } from '@/features/profile/queries';
import { useAuth } from '@/features/auth/authContext';
import { useAppLock } from '@/features/lock/lockContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconChip } from '@/components/ui/Layout';

/** Grouped tiles for everything that isn't a bottom tab. */
export function MorePage() {
  const profile = useLoadedProfile();
  const { signOut, user } = useAuth();
  const lock = useAppLock();

  return (
    <>
      <PageHeader title="More" description={user?.email} />
      <button
        type="button"
        onClick={openPalette}
        className="mb-6 flex h-14 w-full items-center gap-3 rounded-full bg-panel px-5 text-left text-muted transition-colors hover:bg-raised"
      >
        <Search className="h-5 w-5" aria-hidden />
        <span className="flex-1">Search pages and actions</span>
        <kbd className="kbd hidden md:inline-flex">Ctrl K</kbd>
      </button>
      <div className="space-y-6">
        {MORE_GROUPS.map((g) => {
          const items = g.items.filter((i) => isVisible(i, profile.disabled_modules));
          if (!items.length) return null;
          return (
            <section key={g.label} aria-labelledby={`more-${g.label}`}>
              <h2 id={`more-${g.label}`} className="mb-2 px-1 text-sm font-bold text-muted">
                {g.label}
              </h2>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {items.map(({ to, label, icon, tone, hint }) => (
                  <li key={to}>
                    <Link to={to} className="card card-link flex h-full flex-col gap-3 p-4">
                      <IconChip icon={icon} tone={tone} />
                      <span>
                        <span className="block font-bold">{label}</span>
                        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <div className="flex flex-col gap-2">
          {lock.enabled && (
            <button type="button" onClick={lock.lockNow} className="flex min-h-14 items-center gap-3 rounded-card bg-panel px-5 text-left font-semibold hover:bg-raised">
              <Lock className="h-5 w-5 text-muted" aria-hidden />
              Lock now
            </button>
          )}
          <button type="button" onClick={() => void signOut()} className="flex min-h-14 items-center gap-3 rounded-card bg-panel px-5 text-left font-semibold hover:bg-raised">
            <LogOut className="h-5 w-5 text-muted" aria-hidden />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
