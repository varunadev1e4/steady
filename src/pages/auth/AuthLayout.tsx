import type { ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';
import { OfflineBanner } from '@/components/layout/OfflineBanner';

export function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg">
      <OfflineBanner />
      <main className="mx-auto flex w-full max-w-sm flex-col px-4 pb-12 pt-12 sm:pt-20">
        <div className="mb-8">
          <Logo />
        </div>
        <h1 className="text-2xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </main>
    </div>
  );
}
