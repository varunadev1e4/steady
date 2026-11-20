import type { ReactNode } from 'react';

/** Material 3 large top app bar: headline title, supporting text, trailing actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[1.875rem] font-extrabold leading-tight lg:text-[2.25rem]">{title}</h1>
        {description && <p className="mt-1.5 text-[0.9375rem] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>}
    </header>
  );
}
