import { Link, useLocation } from 'react-router-dom';
import { TAB_ITEMS, isVisible, sectionFor } from '@/lib/navigation';
import { haptic } from '@/utils/haptics';
import { useLoadedProfile } from '@/features/profile/queries';
import { cn } from '@/utils/cn';

/** Material 3 navigation bar: icon in an active-indicator pill, label below. */
export function BottomTabs() {
  const profile = useLoadedProfile();
  const items = TAB_ITEMS.filter((i) => isVisible(i, profile.disabled_modules));
  const current = sectionFor(useLocation().pathname, false);

  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-border/50 bg-panel/90 pb-safe-b backdrop-blur-lg print:hidden md:hidden">
      <ul className="mx-auto flex h-tabbar max-w-lg items-stretch justify-around">
        {items.map(({ to, label, icon: Icon }) => {
          const isActive = current === to;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => haptic()}
                className="group flex h-full flex-col items-center justify-center gap-1"
              >
                <span
                  className={cn(
                    'flex h-8 items-center justify-center rounded-full transition-all duration-300',
                    isActive ? 'w-16 bg-accent-soft text-ink' : 'w-12 text-muted group-hover:bg-raised',
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                </span>
                <span className={cn('text-xs', isActive ? 'font-bold text-ink' : 'font-medium text-muted')}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
