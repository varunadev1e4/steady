import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { AlertTriangle, ArrowLeft, CalendarPlus, FileText, Pencil, Pill, Plus, Printer, Trash2, X } from 'lucide-react';
import {
  useAddMedNote,
  useDeleteMedication,
  useDeleteMedNote,
  useDoses,
  useLogDose,
  useMedications,
  useMedNotes,
  useSaveMedication,
  type MedicationInput,
} from '@/features/medications/queries';
import { adherence, daysOfSupply, doseKey, dosesOn, hhmm, isActiveOn, needsRefill } from '@/features/medications/logic';
import { DoseRow, SupportCard } from '@/features/medications/components';
import { buildRecurringIcs } from '@/features/plans/ics';
import { WEEKDAY_CHIPS } from '@/features/plans/logic';
import { download } from '@/features/data/exportImport';
import { useCheckInRange } from '@/features/checkin/queries';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import type { MedicationRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Controls';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { IconButton, StatTile } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton, EmptyState, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { ChartCard, LineSeries } from '@/components/charts/Charts';
import { addDaysISO, formatISODate, parseISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';

const FORMS = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'liquid', label: 'Liquid' },
  { value: 'injection', label: 'Injection' },
  { value: 'other', label: 'Other' },
];

function MedForm({ med, onDone }: { med: MedicationRow | null; onDone: () => void }) {
  const { today } = useToday();
  const save = useSaveMedication();
  const n = (v: number | null) => (v == null ? '' : String(Number(v)));
  const [v, setV] = useState({
    name: med?.name ?? '',
    dose: med?.dose ?? '',
    form: med?.form ?? 'tablet',
    purpose: med?.purpose ?? '',
    instructions: med?.instructions ?? '',
    asNeeded: med?.as_needed ?? false,
    times: med?.schedule_times.map(hhmm) ?? ['08:00'],
    weekdays: med?.weekdays ?? [],
    start: med?.start_date ?? today,
    end: med?.end_date ?? '',
    pillsLeft: n(med?.pills_left ?? null),
    perDose: med ? String(Number(med.pills_per_dose)) : '1',
    refillAt: n(med?.refill_at ?? null),
  });
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.name.trim()) return setErr('Enter the medicine name.');
        const times = [...new Set(v.times.filter(Boolean))].sort();
        if (!v.asNeeded && times.length === 0) return setErr('Add at least one time, or mark it as “as needed”.');
        if (v.end && v.end < v.start) return setErr('The end date is before the start date.');
        const num = (s: string) => (s.trim() === '' ? null : Number(s));
        const pillsLeft = num(v.pillsLeft);
        const perDose = Number(v.perDose) || 1;
        if (pillsLeft != null && (Number.isNaN(pillsLeft) || pillsLeft < 0)) return setErr('Pills left should be a number.');
        setErr(null);
        const input: MedicationInput = {
          name: v.name.trim(),
          dose: v.dose.trim() || null,
          form: v.form as MedicationInput['form'],
          purpose: v.purpose.trim() || null,
          instructions: v.instructions.trim() || null,
          as_needed: v.asNeeded,
          schedule_times: v.asNeeded ? [] : times,
          weekdays: v.asNeeded ? [] : v.weekdays,
          start_date: v.start,
          end_date: v.end || null,
          pills_left: pillsLeft,
          pills_per_dose: perDose,
          refill_at: num(v.refillAt),
        };
        save.mutate({ id: med?.id, input }, { onSuccess: onDone });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Medicine name" value={v.name} maxLength={100} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus={!med} />
        <TextField label="Dose (optional)" value={v.dose} maxLength={50} placeholder="e.g. 50 mg" onChange={(e) => setV({ ...v, dose: e.target.value })} />
        <SelectField label="Form" value={v.form} onChange={(e) => setV({ ...v, form: e.target.value as MedicationRow['form'] })} options={FORMS} />
        <TextField label="What it's for (optional)" value={v.purpose} maxLength={100} onChange={(e) => setV({ ...v, purpose: e.target.value })} />
      </div>
      <TextField label="Instructions (optional)" value={v.instructions} maxLength={300} placeholder="e.g. after breakfast, with water" onChange={(e) => setV({ ...v, instructions: e.target.value })} />
      <label className="flex flex-row-reverse items-center justify-between gap-3">
        <input type="checkbox" role="switch" className="switch" checked={v.asNeeded} onChange={(e) => setV({ ...v, asNeeded: e.target.checked })} />
        Only as needed (no fixed times)
      </label>
      {!v.asNeeded && (
        <>
          <fieldset>
            <legend className="label">Times</legend>
            <div className="space-y-2">
              {v.times.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TextField label={`Time ${i + 1}`} hideLabel type="time" value={t} wrapperClassName="flex-1" onChange={(e) => setV({ ...v, times: v.times.map((x, j) => (j === i ? e.target.value : x)) })} />
                  {v.times.length > 1 && (
                    <IconButton label={`Remove time ${i + 1}`} onClick={() => setV({ ...v, times: v.times.filter((_, j) => j !== i) })}>
                      <X className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
              ))}
              {v.times.length < 8 && (
                <Button size="sm" variant="ghost" onClick={() => setV({ ...v, times: [...v.times, '21:00'] })}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add a time
                </Button>
              )}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Days (leave all off for every day)</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_CHIPS.map((d) => (
                <Chip key={d.v} active={v.weekdays.includes(d.v)} onClick={() => setV({ ...v, weekdays: v.weekdays.includes(d.v) ? v.weekdays.filter((x) => x !== d.v) : [...v.weekdays, d.v] })}>
                  {d.l}
                </Chip>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Started" type="date" value={v.start} onChange={(e) => e.target.value && setV({ ...v, start: e.target.value })} />
        <TextField label="Ends (optional)" type="date" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} />
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-medium text-accent-ink">Pill count and refill reminder (optional)</summary>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <TextField label="Pills left" inputMode="decimal" value={v.pillsLeft} onChange={(e) => setV({ ...v, pillsLeft: e.target.value.replace(/[^\d.]/g, '') })} />
          <TextField label="Per dose" inputMode="decimal" value={v.perDose} onChange={(e) => setV({ ...v, perDose: e.target.value.replace(/[^\d.]/g, '') })} />
          <TextField label="Remind at" inputMode="numeric" value={v.refillAt} placeholder="7 days" onChange={(e) => setV({ ...v, refillAt: e.target.value.replace(/\D/g, '') })} hint="pills left" />
        </div>
        <p className="mt-1 text-xs text-muted">The count goes down each time you mark a dose taken. Without “remind at”, Steady warns when about a week is left.</p>
      </details>
      {(err || save.isError) && <FormMessage tone="error">{err ?? errorMessage(save.error)}</FormMessage>}
      <Button type="submit" loading={save.isPending}>
        {med ? 'Save changes' : 'Add medicine'}
      </Button>
    </form>
  );
}

function RemindersSheet({ meds, open, onClose }: { meds: MedicationRow[]; open: boolean; onClose: () => void }) {
  const { today } = useToday();
  const toast = useToast();
  const [alarm, setAlarm] = useState('0');
  const scheduled = meds.filter((m) => !m.archived_at && !m.as_needed && (!m.end_date || m.end_date >= today));
  const events = scheduled.flatMap((m) =>
    m.schedule_times.map((t) => ({
      uid: `med-${m.id}-${hhmm(t).replace(':', '')}`,
      title: `Take ${m.name}${m.dose ? ` ${m.dose}` : ''}`,
      description: `${m.instructions ?? ''}\nMark it as taken in Steady.`.trim(),
      startDay: m.start_date > today ? m.start_date : today,
      time: hhmm(t),
      durationMin: 5,
      weekdays: m.weekdays,
      until: m.end_date,
      alarmMinutes: alarm === 'none' ? null : Number(alarm),
    })),
  );
  return (
    <Sheet open={open} onClose={onClose} title="Medication reminders" description="Repeating events in your phone's calendar. Steady itself never sends notifications.">
      <div className="space-y-4">
        <SelectField
          label="Alert"
          value={alarm}
          onChange={(e) => setAlarm(e.target.value)}
          options={[
            { value: '0', label: 'At the dose time' },
            { value: '10', label: '10 minutes before' },
            { value: 'none', label: 'No alert' },
          ]}
        />
        <p className="text-sm text-muted">{events.length} daily reminder{events.length === 1 ? '' : 's'} for {scheduled.length} medicine{scheduled.length === 1 ? '' : 's'}.</p>
        <Button
          block
          disabled={events.length === 0}
          onClick={() => {
            download(new Blob([buildRecurringIcs('Steady: medication', events)], { type: 'text/calendar;charset=utf-8' }), 'steady-medication.ics');
            toast('Calendar file downloaded. Open it to add the reminders.');
            onClose();
          }}
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Download calendar file
        </Button>
        <p className="text-xs text-muted">
          Reminder titles show the medicine name on your lock screen. If you'd rather they didn't, rename the events in your calendar after
          importing. Changed a time? Download again; most calendars update the same events.
        </p>
      </div>
    </Sheet>
  );
}

function MedicationsHome() {
  const { today, tz, now } = useToday();
  const profile = useLoadedProfile();
  const meds = useMedications();
  const from30 = addDaysISO(today, -29);
  const doses = useDoses(from30, today);
  const notes = useMedNotes();
  const addNote = useAddMedNote();
  const delNote = useDeleteMedNote();
  const del = useDeleteMedication();
  const save = useSaveMedication();
  const logDose = useLogDose();
  const mood = useCheckInRange(from30, today);
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<MedicationRow | 'new' | null>(null);
  const [reminders, setReminders] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteMed, setNoteMed] = useState('');
  const nowHHmm = formatInTimeZone(now, tz, 'HH:mm');

  const all = meds.data ?? [];
  const active = all.filter((m) => !m.archived_at);
  const logged = useMemo(() => new Map((doses.data ?? []).map((d) => [doseKey(d.medication_id, d.day, d.scheduled_time), d])), [doses.data]);
  const todays = dosesOn(active, today);
  const prnToday = (doses.data ?? []).filter((d) => d.day === today && d.scheduled_time == null);
  const refills = active.filter(needsRefill);
  const overall7 = adherence(active, doses.data ?? [], addDaysISO(today, -6), today, today, nowHHmm);
  const overall30 = adherence(active, doses.data ?? [], from30, today, today, nowHHmm);
  const moodSeries = useMemo(() => {
    const byDay = new Map((mood.data ?? []).map((c) => [c.day, c.mood]));
    const out: Array<{ x: string; y: number | null }> = [];
    for (let d = from30; d <= today; d = addDaysISO(d, 1)) out.push({ x: format(parseISODate(d), 'd MMM'), y: byDay.get(d) ?? null });
    return out;
  }, [mood.data, from30, today]);

  if (meds.isPending) return <CardSkeleton lines={5} />;
  if (meds.isError) return <ErrorState error={meds.error} onRetry={() => void meds.refetch()} />;

  return (
    <>
      <PageHeader
        title="Medications"
        description="Doses, refills and how you're feeling, in one private place."
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        }
      />
      <Sheet open={editing != null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add a medicine' : 'Edit medicine'}>
        <MedForm
          med={editing === 'new' ? null : editing}
          onDone={() => {
            toast('Saved');
            setEditing(null);
          }}
        />
      </Sheet>
      <RemindersSheet meds={active} open={reminders} onClose={() => setReminders(false)} />

      <div className="space-y-4">
        {active.length === 0 ? (
          <EmptyState icon={Pill} title="No medicines yet" action={<Button onClick={() => setEditing('new')}>Add a medicine</Button>}>
            Add each medicine with its times. Then mark doses as taken in one tap, here or on Today.
          </EmptyState>
        ) : (
          <>
            {refills.length > 0 && (
              <div className="flex items-start gap-2 rounded-card bg-amber-soft px-4 py-3 text-sm" role="status">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-ink" aria-hidden />
                <p>
                  Time to arrange a refill: {refills.map((m) => `${m.name} (${Number(m.pills_left)} left${daysOfSupply(m) != null ? `, about ${daysOfSupply(m)} days` : ''})`).join('; ')}.
                </p>
              </div>
            )}

            <section className="card" aria-labelledby="today-doses">
              <div className="flex items-center justify-between">
                <h2 id="today-doses" className="text-base">
                  Today
                </h2>
                <span className="text-sm text-muted">
                  {todays.filter((d) => logged.get(doseKey(d.medicationId, today, d.time))?.status === 'taken').length} of {todays.length} taken
                </span>
              </div>
              {todays.length === 0 ? (
                <p className="mt-1 text-sm text-muted">No scheduled doses today.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {todays.map((d) => (
                    <DoseRow key={`${d.medicationId}-${d.time}`} med={d.med} time={d.time} day={today} logged={logged.get(doseKey(d.medicationId, today, d.time))} tz={tz} />
                  ))}
                </ul>
              )}
              {active.some((m) => m.as_needed) && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-sm font-medium">As needed</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {active
                      .filter((m) => m.as_needed)
                      .map((m) => (
                        <Button
                          key={m.id}
                          size="sm"
                          variant="secondary"
                          loading={logDose.isPending}
                          onClick={() => logDose.mutate({ medicationId: m.id, day: today, time: null, status: 'taken' }, { onSuccess: () => toast(`Logged ${m.name}`), onError: (e) => toast(errorMessage(e), 'error') })}
                        >
                          Took {m.name}
                        </Button>
                      ))}
                  </div>
                  {prnToday.length > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      Today:{' '}
                      {prnToday
                        .map((d) => `${all.find((m) => m.id === d.medication_id)?.name ?? 'Medicine'} at ${formatInTimeZone(new Date(d.taken_at), tz, 'h:mm a')}`)
                        .join(', ')}
                    </p>
                  )}
                </div>
              )}
            </section>

            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Taken on schedule, 7 days" value={overall7.percent == null ? '–' : `${overall7.percent}%`} hint={`${overall7.taken} of ${overall7.expected} doses`} />
              <StatTile label="Taken on schedule, 30 days" value={overall30.percent == null ? '–' : `${overall30.percent}%`} hint={`${overall30.taken} of ${overall30.expected} doses`} />
            </div>

            <section aria-labelledby="your-meds">
              <h2 id="your-meds" className="mb-2 text-base">
                Your medicines
              </h2>
              <ul className="space-y-2">
                {active.map((m) => {
                  const a = adherence([m], doses.data ?? [], from30, today, today, nowHHmm);
                  const supply = daysOfSupply(m);
                  return (
                    <li key={m.id} className="card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {m.name} {m.dose && <span className="font-normal text-muted">{m.dose}</span>}
                          </p>
                          <p className="text-sm text-muted">
                            {m.as_needed ? 'As needed' : `${m.schedule_times.map(hhmm).join(', ')}${m.weekdays.length ? ` · ${WEEKDAY_CHIPS.filter((d) => m.weekdays.includes(d.v)).map((d) => d.l).join(', ')}` : ' · every day'}`}
                            {m.purpose && ` · ${m.purpose}`}
                          </p>
                          <p className="text-xs text-muted">
                            {!m.as_needed && `30 days: ${a.percent == null ? '–' : `${a.percent}%`} taken`}
                            {m.pills_left != null && ` · ${Number(m.pills_left)} left${supply != null ? ` (~${supply} days)` : ''}`}
                            {!isActiveOn(m, today) && !m.as_needed && ' · not scheduled today'}
                          </p>
                        </div>
                        <div className="flex shrink-0">
                          <IconButton label={`Edit ${m.name}`} onClick={() => setEditing(m)}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label={`Stop tracking ${m.name}`}
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Stop tracking ${m.name}?`,
                                body: 'Its history is kept, and it moves to “Past medicines”. This only changes Steady, not your prescription.',
                                confirmLabel: 'Stop tracking',
                              });
                              if (ok) save.mutate({ id: m.id, input: { archived_at: new Date().toISOString() } });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setReminders(true)}>
                  <CalendarPlus className="h-4 w-4" aria-hidden />
                  Calendar reminders
                </Button>
                <Link to="/meds/summary" className={buttonClasses('secondary', 'sm')}>
                  <FileText className="h-4 w-4" aria-hidden />
                  Summary for my appointment
                </Link>
              </div>
            </section>
          </>
        )}

        <section className="card space-y-3" aria-labelledby="feel">
          <div>
            <h2 id="feel" className="text-base">
              How I'm feeling on it
            </h2>
            <p className="text-sm text-muted">Side effects, sleep, appetite, mood changes: anything worth telling your prescriber.</p>
          </div>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = noteText.trim();
              if (!t) return;
              addNote.mutate({ medication_id: noteMed || null, day: today, text: t }, { onSuccess: () => setNoteText('') });
            }}
          >
            <TextAreaField label="Note" hideLabel rows={2} maxLength={1000} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. Sleepy for an hour after the morning dose" />
            <div className="flex gap-2">
              {active.length > 0 && (
                <SelectField label="Medicine" hideLabel wrapperClassName="flex-1" value={noteMed} onChange={(e) => setNoteMed(e.target.value)} options={[{ value: '', label: 'General' }, ...active.map((m) => ({ value: m.id, label: m.name }))]} />
              )}
              <Button type="submit" loading={addNote.isPending} disabled={!noteText.trim()}>
                Save note
              </Button>
            </div>
          </form>
          {notes.data && notes.data.length > 0 && (
            <ul className="divide-y divide-border border-t border-border">
              {notes.data.slice(0, 20).map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-2 py-2">
                  <span className="text-sm">
                    <span className="text-xs text-muted">
                      {formatISODate(n.day, profile.date_format)}
                      {n.medication_id && ` · ${all.find((m) => m.id === n.medication_id)?.name ?? ''}`}
                    </span>
                    <span className="block">{n.text}</span>
                  </span>
                  <IconButton label="Delete note" onClick={() => delNote.mutate(n.id)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ChartCard title="Mood, last 30 days" caption="From your check-ins, to look at alongside your medicines (a pattern, not proof of cause)" empty={moodSeries.filter((m) => m.y != null).length < 2} emptyText="Check in on a few days to see your mood here.">
          <LineSeries data={moodSeries} label="Mood over the last 30 days" domain={[1, 5]} />
        </ChartCard>

        <section className="rounded-card bg-panel px-4 py-3 text-sm text-muted">
          <p className="font-medium text-ink">Good to know</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Don't stop or change a dose without talking to your prescriber. Stopping antidepressants or anti-anxiety medicines suddenly can cause withdrawal-type symptoms.</li>
            <li>Missed a dose? Follow your medicine's leaflet or ask a pharmacist. Don't take a double dose to make up for it unless you've been told to.</li>
            <li>Many of these medicines take a few weeks to work fully. Notes about how you feel help your prescriber adjust things with you.</li>
          </ul>
        </section>

        <SupportCard />

        {all.some((m) => m.archived_at) && (
          <details className="card">
            <summary className="cursor-pointer font-medium">Past medicines</summary>
            <ul className="mt-2 divide-y divide-border">
              {all
                .filter((m) => m.archived_at)
                .map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {m.name} {m.dose && <span className="text-muted">{m.dose}</span>}
                    </span>
                    <span className="flex">
                      <Button size="sm" variant="ghost" onClick={() => save.mutate({ id: m.id, input: { archived_at: null } })}>
                        Restore
                      </Button>
                      <IconButton
                        label={`Delete ${m.name} and its history`}
                        onClick={async () => {
                          if (await confirm({ title: `Delete ${m.name}?`, body: 'This removes it and its whole dose history from Steady.', confirmLabel: 'Delete', danger: true })) {
                            del.mutate(m.id, { onError: (e) => toast(errorMessage(e), 'error') });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>
    </>
  );
}

export function MedicationsPage() {
  return (
    <>
      <MedicationsHome />
    </>
  );
}

/** Printable summary for appointments: medicines, how often doses were taken, notes and mood. */
export function MedicationSummaryPage() {
  const { today, tz, now } = useToday();
  const profile = useLoadedProfile();
  const from = addDaysISO(today, -29);
  const meds = useMedications();
  const doses = useDoses(from, today);
  const notes = useMedNotes();
  const mood = useCheckInRange(from, today);
  const nowHHmm = formatInTimeZone(now, tz, 'HH:mm');
  if (meds.isPending || doses.isPending) return <CardSkeleton lines={6} />;
  if (meds.isError) return <ErrorState error={meds.error} onRetry={() => void meds.refetch()} />;
  const active = meds.data.filter((m) => !m.archived_at);
  const moods = (mood.data ?? []).filter((c) => c.mood != null).map((c) => c.mood!);
  const sleeps = (mood.data ?? []).filter((c) => c.sleep_hours != null).map((c) => Number(c.sleep_hours));
  const avg = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link to="/meds" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Medications
          </Link>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden />
            Print or save as PDF
          </Button>
        </div>
        <header>
          <h1 className="text-2xl">Medication summary</h1>
          <p className="text-sm text-muted">
            {profile.display_name ? `${profile.display_name} · ` : ''}last 30 days ({formatISODate(from, profile.date_format)} – {formatISODate(today, profile.date_format)})
          </p>
        </header>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-1.5 pr-2 font-medium">Medicine</th>
              <th className="py-1.5 pr-2 font-medium">Schedule</th>
              <th className="py-1.5 pr-2 font-medium">Since</th>
              <th className="py-1.5 font-medium">Doses taken</th>
            </tr>
          </thead>
          <tbody>
            {active.map((m) => {
              const a = adherence([m], doses.data ?? [], from, today, today, nowHHmm);
              return (
                <tr key={m.id} className="border-b border-border/60 align-top">
                  <td className="py-1.5 pr-2">
                    {m.name} {m.dose}
                    {m.purpose && <span className="block text-xs text-muted">{m.purpose}</span>}
                  </td>
                  <td className="py-1.5 pr-2">{m.as_needed ? 'As needed' : m.schedule_times.map(hhmm).join(', ')}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{formatISODate(m.start_date, profile.date_format)}</td>
                  <td className="py-1.5 tabular-nums">
                    {m.as_needed
                      ? `${(doses.data ?? []).filter((d) => d.medication_id === m.id && d.status === 'taken').length} times`
                      : a.percent == null
                        ? '–'
                        : `${a.taken} of ${a.expected} (${a.percent}%)`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-sm">
          Average mood {avg(moods) ?? '–'} / 5 over {moods.length} check-ins · average sleep {avg(sleeps) ?? '–'} h.
        </p>
        <section>
          <h2 className="text-base">Notes</h2>
          {(notes.data ?? []).filter((n) => n.day >= from).length === 0 ? (
            <p className="text-sm text-muted">No notes in this period.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {(notes.data ?? [])
                .filter((n) => n.day >= from)
                .map((n) => (
                  <li key={n.id}>
                    <span className="tabular-nums text-muted">{formatISODate(n.day, profile.date_format)}</span>
                    {n.medication_id && ` (${meds.data.find((m) => m.id === n.medication_id)?.name ?? ''})`}: {n.text}
                  </li>
                ))}
            </ul>
          )}
        </section>
        <p className="text-xs text-muted">Self-recorded in the Steady app. Doses count as taken when marked taken on the day.</p>
      </div>
    </>
  );
}
