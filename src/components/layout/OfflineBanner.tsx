import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/lib/online';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-40 print:hidden border-b border-amber/40 bg-amber-soft px-4 py-2.5 text-sm text-ink">
      <p className="mx-auto flex max-w-content items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0 text-amber-ink" aria-hidden />
        You're offline. You can look around, but changes can't be saved until you reconnect.
      </p>
    </div>
  );
}
