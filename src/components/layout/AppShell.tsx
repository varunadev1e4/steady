import { Outlet, useLocation } from 'react-router-dom';
import { useProfile } from '@/features/profile/queries';
import { useApplyTheme, storedTheme } from '@/features/profile/theme';
import { useAuth } from '@/features/auth/authContext';
import { ErrorState } from '@/components/ui/States';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { BottomTabs } from './BottomTabs';
import { NavRail } from './NavRail';
import { CommandPalette } from './CommandPalette';
import { cn } from '@/utils/cn';
import { OfflineBanner } from './OfflineBanner';
import { QuickCapture } from './QuickCapture';
import { AppLockProvider } from '@/features/lock/AppLock';

/** Dashboards and hubs use the full width on big screens; reading and form pages stay a comfortable line length. */
const WIDE = /^\/(more|body|mind)?$/;

/** Signed-in layout. Waits for the profile so every page can rely on it. */
export function AppShell() {
  const profile = useProfile();
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  useApplyTheme(profile.data?.theme ?? storedTheme());

  if (profile.isPending) return <FullPageSpinner label="Loading your settings" />;
  if (profile.isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6">
        <OfflineBanner />
        <ErrorState
          error={profile.error}
          title="Couldn't load your account"
          onRetry={() => void profile.refetch()}
          className="w-full max-w-md"
        />
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <AppLockProvider>
      <div className="min-h-dvh bg-bg md:flex md:bg-panel">
        <a
          href="#main"
          className="sr-only z-50 rounded-input bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
        <NavRail />
        {/* On computers the page sits on a rounded canvas beside the rail. */}
        <div className="min-w-0 flex-1 md:my-3 md:mr-3 md:min-h-[calc(100dvh-1.5rem)] md:rounded-[28px] md:bg-bg">
          <OfflineBanner />
          <main
            id="main"
            tabIndex={-1}
            className={cn(
              'mx-auto w-full px-4 pb-[calc(5rem+env(safe-area-inset-bottom)+6rem)] pt-6 focus:outline-none sm:px-6 md:px-10 md:pb-16 md:pt-10',
              WIDE.test(pathname) ? 'max-w-wide' : 'max-w-content',
            )}
          >
            <div key={pathname} className="animate-fade-up">
              <Outlet />
            </div>
          </main>
        </div>
        <QuickCapture />
        <CommandPalette />
        <BottomTabs />
      </div>
    </AppLockProvider>
  );
}
