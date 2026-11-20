import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ArrowLeft, FileText, Printer, Trash2 } from 'lucide-react';
import { useAddReading, useDeleteReading, useHealthReadings, type HealthInput } from '@/features/health/queries';
import {
  average,
  bpReference,
  fromDisplayGlucose,
  glucoseReference,
  HEALTH_SOURCES,
  heartRateReference,
  toDisplayGlucose,
  type GlucoseContext,
  type Reference,
} from '@/features/health/logic';
import { useMeasurements } from '@/features/workouts/queries';
import { formatWeight } from '@/features/workouts/logic';
import { useLoadedProfile } from '@/features/profile/queries';
import { useToday } from '@/features/profile/useToday';
import type { HealthReadingRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Segmented } from '@/components/ui/Controls';
import { SelectField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { IconButton, StatTile } from '@/components/ui/Layout';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { ChartCard, LineSeries, TwoLineSeries } from '@/components/charts/Charts';
import { addDaysISO, formatISODate, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

type Kind = 'bp' | 'glucose' | 'hr';
const CONTEXT_LABEL: Record<GlucoseContext, string> = { fasting: 'Fasting', after_meal: 'After a meal', random: 'Other time' };

function RefNote({ r }: { r: Reference }) {
  return (
    <p
      className={cn(
        'mt-0.5 text-xs',
        r.level === 'urgent' ? 'font-semibold text-danger' : r.level === 'notice' ? 'text-amber-ink' : 'text-muted',
      )}
    >
      {r.label}
    </p>
  );
}

function ReadingForm() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const add = useAddReading();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>('bp');
  const [v, setV] = useState({ sys: '', dia: '', hr: '', glucose: '', context: 'fasting' as GlucoseContext, day: today, note: '' });
  const [err, setErr] = useState<string | null>(null);
  const unit = profile.glucose_unit;

  const submit = () => {
    const n = (s: string) => (s.trim() === '' ? null : Number(s));
    const input: HealthInput = { day: v.day, systolic: null, diastolic: null, resting_hr: null, glucose_mg_dl: null, glucose_context: null, note: v.note.trim() || null };
    if (kind === 'bp') {
      const sys = n(v.sys);
      const dia = n(v.dia);
      if (sys == null || dia == null) return setErr('Enter both numbers, e.g. 128 over 82.');
      if (sys < 60 || sys > 260 || dia < 30 || dia > 160 || sys <= dia) return setErr('Those numbers look out of range. The top number should be the larger one.');
      input.systolic = sys;
      input.diastolic = dia;
      const hr = n(v.hr);
      if (hr != null) {
        if (hr < 25 || hr > 220) return setErr('Pulse should be between 25 and 220.');
        input.resting_hr = hr;
      }
    } else if (kind === 'glucose') {
      const g = n(v.glucose);
      if (g == null) return setErr('Enter the reading.');
      const mg = fromDisplayGlucose(g, unit);
      if (mg < 20 || mg > 700) return setErr(`That reading looks out of range for ${unit}.`);
      input.glucose_mg_dl = mg;
      input.glucose_context = v.context;
    } else {
      const hr = n(v.hr);
      if (hr == null || hr < 25 || hr > 220) return setErr('Resting heart rate should be between 25 and 220.');
      input.resting_hr = hr;
    }
    setErr(null);
    add.mutate(input, {
      onSuccess: () => {
        toast('Reading saved');
        setV({ ...v, sys: '', dia: '', hr: '', glucose: '', note: '' });
      },
    });
  };

  return (
    <form
      className="card space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className="text-base">Add a reading</h2>
      <Segmented
        label="Reading type"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setErr(null);
        }}
        options={[
          { value: 'bp', label: 'Blood pressure' },
          { value: 'glucose', label: 'Blood sugar' },
          { value: 'hr', label: 'Heart rate' },
        ]}
      />
      {kind === 'bp' && (
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Top (systolic)" inputMode="numeric" value={v.sys} onChange={(e) => setV({ ...v, sys: e.target.value.replace(/\D/g, '') })} />
          <TextField label="Bottom (diastolic)" inputMode="numeric" value={v.dia} onChange={(e) => setV({ ...v, dia: e.target.value.replace(/\D/g, '') })} />
          <TextField label="Pulse (optional)" inputMode="numeric" value={v.hr} onChange={(e) => setV({ ...v, hr: e.target.value.replace(/\D/g, '') })} />
        </div>
      )}
      {kind === 'glucose' && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label={`Reading (${unit})`} inputMode="decimal" value={v.glucose} onChange={(e) => setV({ ...v, glucose: e.target.value.replace(/[^\d.]/g, '') })} />
          <SelectField
            label="When"
            value={v.context}
            onChange={(e) => setV({ ...v, context: e.target.value as GlucoseContext })}
            options={Object.entries(CONTEXT_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </div>
      )}
      {kind === 'hr' && (
        <TextField
          label="Resting heart rate (beats per minute)"
          inputMode="numeric"
          value={v.hr}
          onChange={(e) => setV({ ...v, hr: e.target.value.replace(/\D/g, '') })}
          hint="Measure after sitting quietly for 5 minutes, ideally in the morning."
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Date" type="date" max={today} value={v.day} onChange={(e) => e.target.value && setV({ ...v, day: e.target.value })} />
        <TextField label="Note (optional)" maxLength={500} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
      </div>
      {kind === 'bp' && <p className="text-xs text-muted">Sit quietly for 5 minutes first, feet flat, arm supported at heart level.</p>}
      {(err || add.isError) && <FormMessage tone="error">{err ?? errorMessage(add.error)}</FormMessage>}
      <Button type="submit" loading={add.isPending}>
        Save reading
      </Button>
    </form>
  );
}

function describe(r: HealthReadingRow, unit: 'mg/dL' | 'mmol/L') {
  const parts: Array<{ text: string; ref: Reference }> = [];
  if (r.systolic != null && r.diastolic != null) parts.push({ text: `BP ${r.systolic}/${r.diastolic}`, ref: bpReference(r.systolic, r.diastolic) });
  if (r.glucose_mg_dl != null && r.glucose_context) {
    parts.push({ text: `Sugar ${toDisplayGlucose(Number(r.glucose_mg_dl), unit)} ${unit} (${CONTEXT_LABEL[r.glucose_context].toLowerCase()})`, ref: glucoseReference(Number(r.glucose_mg_dl), r.glucose_context) });
  }
  if (r.resting_hr != null) parts.push({ text: `${r.systolic != null ? 'Pulse' : 'Resting HR'} ${r.resting_hr} bpm`, ref: heartRateReference(r.resting_hr) });
  return parts;
}

export function HealthPage() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const unit = profile.glucose_unit;
  const readings = useHealthReadings(addDaysISO(today, -365));
  const del = useDeleteReading();
  const confirm = useConfirm();
  const [range, setRange] = useState<'30' | '90' | '365'>('90');
  const from = addDaysISO(today, -(Number(range) - 1));

  const inRange = useMemo(() => (readings.data ?? []).filter((r) => r.day >= from).slice().reverse(), [readings.data, from]);
  const tick = (d: string) => format(parseISODate(d), 'd MMM');
  const bp = inRange.filter((r) => r.systolic != null).map((r) => ({ x: tick(r.day), sys: r.systolic, dia: r.diastolic }));
  const fasting = inRange.filter((r) => r.glucose_mg_dl != null && r.glucose_context === 'fasting').map((r) => ({ x: tick(r.day), y: toDisplayGlucose(Number(r.glucose_mg_dl), unit) }));
  const hr = inRange.filter((r) => r.resting_hr != null).map((r) => ({ x: tick(r.day), y: r.resting_hr }));

  return (
    <>
      <PageHeader
        title="Health readings"
        description="Blood pressure, blood sugar and resting heart rate, ready to show your doctor."
        actions={
          <Link to={`/body/health/report?days=${range}`} className={buttonClasses('secondary', 'sm')}>
            <FileText className="h-4 w-4" aria-hidden />
            Summary
          </Link>
        }
      />
      <div className="space-y-4">
        <ReadingForm />
        <Segmented
          label="Chart range"
          value={range}
          onChange={setRange}
          options={[
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
            { value: '365', label: '1 year' },
          ]}
        />
        {readings.isPending ? (
          <CardSkeleton lines={4} />
        ) : readings.isError ? (
          <ErrorState error={readings.error} onRetry={() => void readings.refetch()} />
        ) : (
          <>
            <ChartCard title="Blood pressure (mmHg)" caption="Under 120/80 is the normal range" empty={bp.length < 2} emptyText="Log two or more readings to see a trend.">
              <TwoLineSeries
                data={bp}
                label="Blood pressure over time"
                series={[
                  { key: 'sys', label: 'Systolic (top)' },
                  { key: 'dia', label: 'Diastolic (bottom)' },
                ]}
              />
            </ChartCard>
            <ChartCard
              title={`Fasting blood sugar (${unit})`}
              caption={unit === 'mg/dL' ? 'Typical fasting range is under 100' : 'Typical fasting range is under 5.6'}
              empty={fasting.length < 2}
              emptyText="Log two or more fasting readings to see a trend."
            >
              <LineSeries data={fasting} label="Fasting blood sugar over time" format={(v) => `${v} ${unit}`} />
            </ChartCard>
            <ChartCard title="Resting heart rate (bpm)" caption="Usual adult range 60–100" empty={hr.length < 2} emptyText="Log two or more readings to see a trend.">
              <LineSeries data={hr} label="Resting heart rate over time" format={(v) => `${v} bpm`} />
            </ChartCard>

            {readings.data.length > 0 && (
              <section aria-labelledby="hist">
                <h2 id="hist" className="mb-2 text-base">
                  Recent readings
                </h2>
                <ul className="card divide-y divide-border py-1">
                  {readings.data.slice(0, 40).map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">
                          {formatISODate(r.day, profile.date_format)} · {formatInTimeZone(new Date(r.taken_at), profile.time_zone, 'h:mm a')}
                        </p>
                        {describe(r, unit).map((p) => (
                          <div key={p.text}>
                            <p className="font-medium tabular-nums">{p.text}</p>
                            <RefNote r={p.ref} />
                          </div>
                        ))}
                        {r.note && <p className="text-sm text-muted">{r.note}</p>}
                      </div>
                      <IconButton
                        label="Delete reading"
                        onClick={async () => {
                          if (await confirm({ title: 'Delete this reading?', confirmLabel: 'Delete', danger: true })) del.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
        <p className="text-xs text-muted">
          Reference ranges are for orientation only (2017 ACC/AHA blood pressure categories; ADA glucose thresholds). One reading is never a
          diagnosis. Talk to your doctor about your numbers.
        </p>
      </div>
    </>
  );
}

/** A clean, printable summary for appointments (Print → Save as PDF also works). */
export function HealthReportPage() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const unit = profile.glucose_unit;
  const [params] = useSearchParams();
  const days = [30, 90, 365].includes(Number(params.get('days'))) ? Number(params.get('days')) : 90;
  const from = addDaysISO(today, -(days - 1));
  const readings = useHealthReadings(from);
  const measurements = useMeasurements();

  if (readings.isPending) return <CardSkeleton lines={6} />;
  if (readings.isError) return <ErrorState error={readings.error} onRetry={() => void readings.refetch()} />;

  const rows = readings.data;
  const bpRows = rows.filter((r) => r.systolic != null);
  const fastRows = rows.filter((r) => r.glucose_context === 'fasting' && r.glucose_mg_dl != null);
  const hrRows = rows.filter((r) => r.resting_hr != null);
  const weights = (measurements.data ?? []).filter((m) => m.day >= from && m.weight_kg != null);
  const waists = (measurements.data ?? []).filter((m) => m.day >= from && m.waist_cm != null);
  const sysAvg = average(bpRows.map((r) => r.systolic));
  const diaAvg = average(bpRows.map((r) => r.diastolic));
  const fastAvg = average(fastRows.map((r) => toDisplayGlucose(Number(r.glucose_mg_dl), unit)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/body/health" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Health readings
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden />
          Print or save as PDF
        </Button>
      </div>
      <header>
        <h1 className="text-2xl">Health summary</h1>
        <p className="text-sm text-muted">
          {profile.display_name ? `${profile.display_name} · ` : ''}
          {formatISODate(from, profile.date_format)} – {formatISODate(today, profile.date_format)} (last {days} days)
        </p>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Average blood pressure" value={sysAvg != null && diaAvg != null ? `${Math.round(sysAvg)}/${Math.round(diaAvg)}` : '–'} hint={`${bpRows.length} readings`} />
        <StatTile label={`Average fasting sugar (${unit})`} value={fastAvg ?? '–'} hint={`${fastRows.length} readings`} />
        <StatTile label="Average resting HR" value={average(hrRows.map((r) => r.resting_hr)) != null ? `${Math.round(average(hrRows.map((r) => r.resting_hr))!)} bpm` : '–'} hint={`${hrRows.length} readings`} />
        <StatTile
          label={`Weight (${profile.units})`}
          value={weights.length ? formatWeight(Number(weights[0].weight_kg), profile.units) : '–'}
          hint={weights.length > 1 ? `was ${formatWeight(Number(weights[weights.length - 1].weight_kg), profile.units)} on ${formatISODate(weights[weights.length - 1].day, 'd MMM')}` : 'latest'}
        />
      </div>
      {waists.length > 0 && (
        <p className="text-sm">
          Waist: {Number(waists[0].waist_cm)} cm ({formatISODate(waists[0].day, 'd MMM')})
          {waists.length > 1 && `, was ${Number(waists[waists.length - 1].waist_cm)} cm on ${formatISODate(waists[waists.length - 1].day, 'd MMM')}`}.
        </p>
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-1.5 pr-2 font-medium">Date</th>
            <th className="py-1.5 pr-2 font-medium">Blood pressure</th>
            <th className="py-1.5 pr-2 font-medium">Sugar ({unit})</th>
            <th className="py-1.5 pr-2 font-medium">Heart rate</th>
            <th className="py-1.5 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60 align-top">
              <td className="py-1.5 pr-2 tabular-nums">{formatISODate(r.day, profile.date_format)}</td>
              <td className="py-1.5 pr-2 tabular-nums">{r.systolic != null ? `${r.systolic}/${r.diastolic}` : ''}</td>
              <td className="py-1.5 pr-2 tabular-nums">
                {r.glucose_mg_dl != null ? `${toDisplayGlucose(Number(r.glucose_mg_dl), unit)} ${r.glucose_context ? `(${CONTEXT_LABEL[r.glucose_context].toLowerCase()})` : ''}` : ''}
              </td>
              <td className="py-1.5 pr-2 tabular-nums">{r.resting_hr ?? ''}</td>
              <td className="py-1.5">{r.note}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-muted">
                No readings in this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="text-xs text-muted">
        <p>Self-recorded at home with the user's own devices. Reference ranges used in the app:</p>
        <ul className="mt-1 list-disc pl-5">
          {HEALTH_SOURCES.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
