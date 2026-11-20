import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { useDeleteMeasurement, useMeasurements, useSaveMeasurement, type MeasurementInput } from '@/features/workouts/queries';
import { formatWeight, toKg } from '@/features/workouts/logic';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/Layout';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { ChartCard, LineSeries } from '@/components/charts/Charts';
import { formatISODate, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';

const OPTIONAL = [
  { key: 'waist_cm', label: 'Waist (cm)', min: 10, max: 300 },
  { key: 'hips_cm', label: 'Hips (cm)', min: 10, max: 300 },
  { key: 'chest_cm', label: 'Chest (cm)', min: 10, max: 300 },
  { key: 'arm_cm', label: 'Arm (cm)', min: 5, max: 150 },
  { key: 'thigh_cm', label: 'Thigh (cm)', min: 10, max: 200 },
  { key: 'body_fat_pct', label: 'Body fat (%)', min: 2, max: 70 },
] as const;

type FormState = Record<'day' | 'weight' | (typeof OPTIONAL)[number]['key'], string>;

export function MeasurementsPage() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const units = profile.units;
  const list = useMeasurements();
  const save = useSaveMeasurement();
  const del = useDeleteMeasurement();
  const confirm = useConfirm();
  const toast = useToast();
  const blank: FormState = { day: today, weight: '', waist_cm: '', hips_cm: '', chest_cm: '', arm_cm: '', thigh_cm: '', body_fat_pct: '' };
  const [f, setF] = useState<FormState>(blank);
  const [err, setErr] = useState<string | null>(null);

  const series = useMemo(
    () =>
      (list.data ?? [])
        .filter((m) => m.weight_kg != null)
        .slice(0, 120)
        .reverse()
        .map((m) => ({ x: format(parseISODate(m.day), 'd MMM'), y: Number(formatWeight(Number(m.weight_kg), units)) })),
    [list.data, units],
  );

  const submit = () => {
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
    const weight = num(f.weight);
    const weightKg = weight == null ? null : Math.round(toKg(weight, units) * 100) / 100;
    if (weightKg != null && (Number.isNaN(weightKg) || weightKg < 20 || weightKg > 400)) return setErr('That weight looks out of range.');
    const input: MeasurementInput = { day: f.day, weight_kg: weightKg, notes: null } as MeasurementInput;
    for (const o of OPTIONAL) {
      const v = num(f[o.key]);
      if (v != null && (Number.isNaN(v) || v < o.min || v > o.max)) return setErr(`${o.label} should be between ${o.min} and ${o.max}.`);
      (input as Record<string, unknown>)[o.key] = v;
    }
    if (OPTIONAL.every((o) => input[o.key] == null) && weightKg == null) return setErr('Enter at least one measurement.');
    setErr(null);
    save.mutate(input, {
      onSuccess: () => {
        toast('Measurement saved');
        setF(blank);
      },
    });
  };

  return (
    <>
      <PageHeader title="Measurements" description="Everything here is optional." />
      <div className="space-y-4">
        <ChartCard title={`Body weight (${units})`} caption="Your logged weights over time" empty={series.length < 2} emptyText="Log your weight on two or more days to see a trend.">
          <LineSeries data={series} label="Body weight over time" format={(v) => `${v} ${units}`} />
        </ChartCard>

        <form
          className="card space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2 className="text-base">Log a measurement</h2>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={`Weight (${units})`} inputMode="decimal" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value.replace(/[^\d.]/g, '') })} />
            <TextField label="Date" type="date" max={today} value={f.day} onChange={(e) => e.target.value && setF({ ...f, day: e.target.value })} />
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-accent-ink">More measurements</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {OPTIONAL.map((o) => (
                <TextField key={o.key} label={o.label} inputMode="decimal" value={f[o.key]} onChange={(e) => setF({ ...f, [o.key]: e.target.value.replace(/[^\d.]/g, '') })} />
              ))}
            </div>
          </details>
          <p className="text-xs text-muted">Saving again on the same date replaces that day's entry.</p>
          {(err || save.isError) && <FormMessage tone="error">{err ?? errorMessage(save.error)}</FormMessage>}
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
        </form>

        {list.isPending ? (
          <CardSkeleton />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.length > 0 ? (
          <section aria-labelledby="mh">
            <h2 id="mh" className="mb-2 text-base">
              History
            </h2>
            <ul className="card divide-y divide-border py-1">
              {list.data.slice(0, 60).map((m) => {
                const extras = OPTIONAL.filter((o) => m[o.key] != null).map((o) => `${o.label.split(' (')[0].toLowerCase()} ${Number(m[o.key])}`);
                return (
                  <li key={m.id} className="flex min-h-12 items-center justify-between gap-2 py-1">
                    <span>
                      <span className="font-medium">{formatISODate(m.day, profile.date_format)}</span>
                      <span className="block text-sm text-muted">
                        {[m.weight_kg != null ? `${formatWeight(Number(m.weight_kg), units)} ${units}` : null, ...extras].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <IconButton
                      label="Delete measurement"
                      onClick={async () => {
                        if (await confirm({ title: 'Delete this measurement?', confirmLabel: 'Delete', danger: true })) del.mutate(m.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
