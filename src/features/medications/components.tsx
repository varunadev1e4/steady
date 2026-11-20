import { Check, LifeBuoy, Undo2 } from 'lucide-react';
import { haptic } from '@/utils/haptics';
import type { MedicationDoseRow, MedicationRow } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/feedbackContext';
import { errorMessage } from '@/utils/errors';
import { formatInTimeZone } from 'date-fns-tz';
import { MED_SUPPORT } from './logic';
import { useLogDose, useUndoDose } from './queries';

/** One scheduled dose with Taken / Skip, or its logged state with Undo. */
export function DoseRow({
  med,
  time,
  day,
  logged,
  tz,
}: {
  med: MedicationRow;
  time: string;
  day: string;
  logged: MedicationDoseRow | undefined;
  tz: string;
}) {
  const log = useLogDose();
  const undo = useUndoDose();
  const toast = useToast();
  const onErr = (e: unknown) => toast(errorMessage(e), 'error');
  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{time}</span>
      <span className="min-w-0 flex-1">
        <span className="block break-words font-medium">
          {med.name}
          {med.dose && <span className="font-normal text-muted"> {med.dose}</span>}
        </span>
        {logged ? (
          <span className={logged.status === 'taken' ? 'text-xs text-accent-ink' : 'text-xs text-muted'}>
            {logged.status === 'taken' ? `Taken at ${formatInTimeZone(new Date(logged.taken_at), tz, 'h:mm a')}` : 'Skipped'}
          </span>
        ) : (
          med.instructions && <span className="block truncate text-xs text-muted">{med.instructions}</span>
        )}
      </span>
      {logged ? (
        <Button size="sm" variant="ghost" loading={undo.isPending} onClick={() => undo.mutate(logged.id, { onError: onErr })} aria-label={`Undo ${med.name} at ${time}`}>
          <Undo2 className="h-4 w-4" aria-hidden />
          Undo
        </Button>
      ) : (
        <span className="flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" disabled={log.isPending} onClick={() => log.mutate({ medicationId: med.id, day, time, status: 'skipped' }, { onError: onErr })}>
            Skip
          </Button>
          <Button size="sm" loading={log.isPending} onClick={() => {
            haptic('success');
            log.mutate({ medicationId: med.id, day, time, status: 'taken' }, { onError: onErr });
          }} aria-label={`Mark ${med.name} at ${time} as taken`}>
            <Check className="h-4 w-4" aria-hidden />
            Taken
          </Button>
        </span>
      )}
    </li>
  );
}

/** Calm, always-available support details. */
export function SupportCard({ compact = false }: { compact?: boolean }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4" aria-labelledby="support-h">
      <h2 id="support-h" className="flex items-center gap-2 text-base">
        <LifeBuoy className="h-5 w-5 text-accent-ink" aria-hidden />
        Need support now?
      </h2>
      <p className="mt-1 text-sm text-muted">
        If things feel heavy, or you have thoughts of harming yourself, you don't have to handle it alone.
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>
          <a href={`tel:${MED_SUPPORT.helplineNumber}`} className="link">
            Call {MED_SUPPORT.helplineName}: {MED_SUPPORT.helplineNumber}
          </a>{' '}
          <span className="text-muted">(free, 24/7, India, many languages; also 1-800-891-4416)</span>
        </li>
        <li>
          <a href={`tel:${MED_SUPPORT.emergency}`} className="link">
            Emergency: {MED_SUPPORT.emergency}
          </a>
        </li>
        {!compact && <li className="text-muted">Or reach out to your prescriber, your therapist, or someone you trust.</li>}
      </ul>
    </section>
  );
}
