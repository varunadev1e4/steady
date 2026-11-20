import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Download, FileJson, FileText, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import { useLoadedProfile, useUpdateProfile } from '@/features/profile/queries';
import { forgetEmail } from '@/features/auth/rememberedEmail';
import { useUser } from '@/features/auth/authContext';
import { deleteAllPhotoFiles } from '@/features/photos/queries';
import {
  downloadJournalZip,
  downloadJSON,
  downloadModuleCSV,
  MODULE_TABLES,
  readImportFile,
  runImport,
  type ImportPreview,
} from '@/features/data/exportImport';
import type { ModuleKey } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { TagInput } from '@/components/ui/Controls';
import { FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { errorMessage } from '@/utils/errors';
import { formatISODate } from '@/utils/dates';

const MODULES: Array<{ key: ModuleKey; label: string; hint: string }> = [
  { key: 'checkin', label: 'Daily check-in', hint: 'Mood, energy, stress, sleep and water' },
  { key: 'habits', label: 'Habits', hint: 'Streaks and consistency' },
  { key: 'journal', label: 'Journal', hint: 'Entries, prompts and thought records' },
  { key: 'workouts', label: 'Workouts', hint: 'Sets, templates and progress' },
  { key: 'food', label: 'Food', hint: 'Meals, protein and water' },
  { key: 'people', label: 'People', hint: 'Staying in touch' },
  { key: 'tasks', label: 'Tasks', hint: 'A simple to-do list' },
  { key: 'notes', label: 'Notes', hint: 'Quick notes and ideas' },
  { key: 'review', label: 'Weekly review', hint: 'Summaries and reflections' },
  { key: 'insights', label: 'Insights', hint: 'Patterns in your own data' },
  { key: 'medications', label: 'Medications', hint: 'Doses, refills and notes' },
];

export function ModulesSection() {
  const profile = useLoadedProfile();
  const update = useUpdateProfile();
  const toggle = (key: ModuleKey, on: boolean) => {
    const set = new Set(profile.disabled_modules);
    if (on) set.delete(key);
    else set.add(key);
    update.mutate({ disabled_modules: [...set] });
  };
  return (
    <div className="space-y-1">
      {MODULES.map((m) => (
        <label key={m.key} className="flex min-h-14 flex-row-reverse items-center justify-between gap-4">
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={!profile.disabled_modules.includes(m.key)}
            disabled={update.isPending}
            onChange={(e) => toggle(m.key, e.target.checked)}
          />
          <span>
            <span className="font-medium">{m.label}</span>
            <span className="block text-sm text-muted">{m.hint}</span>
          </span>
        </label>
      ))}
      <p className="pt-1 text-sm text-muted">Switched-off modules disappear from navigation and Today. Your data is kept.</p>
      {update.isError && <FormMessage tone="error">{errorMessage(update.error)}</FormMessage>}
    </div>
  );
}

const optionalInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= min && Number(v) <= max), `${label} must be ${min}–${max}, or empty`);

const targetsSchema = z.object({
  protein: optionalInt(1, 500, 'Protein'),
  water: optionalInt(1, 40, 'Water'),
  workouts: optionalInt(1, 14, 'Workouts'),
  calories: optionalInt(500, 10000, 'Calories'),
  steps: optionalInt(1000, 50000, 'Steps'),
  increment: z
    .string()
    .trim()
    .refine((v) => Number(v) > 0 && Number(v) <= 50, 'Increment must be more than 0 and at most 50'),
});

export function TargetsSection() {
  const profile = useLoadedProfile();
  const update = useUpdateProfile();
  const toast = useToast();
  const s = (n: number | null) => (n == null ? '' : String(n));
  const [v, setV] = useState({
    protein: s(profile.protein_target_g),
    water: s(profile.water_target_glasses),
    workouts: s(profile.weekly_workout_target),
    calories: s(profile.calorie_target),
    increment: String(Number(profile.overload_increment)),
    steps: s(profile.steps_target),
  });
  const [glucoseUnit, setGlucoseUnit] = useState(profile.glucose_unit);
  const [caloriesOn, setCaloriesOn] = useState(profile.calories_enabled);
  const [mealTags, setMealTags] = useState(profile.meal_tags);
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = targetsSchema.safeParse(v);
        if (!parsed.success) {
          setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
          return;
        }
        setErrors({});
        const n = (x: string) => (x.trim() === '' ? null : Number(x));
        update.mutate(
          {
            protein_target_g: n(v.protein),
            water_target_glasses: n(v.water),
            weekly_workout_target: n(v.workouts),
            calories_enabled: caloriesOn,
            calorie_target: caloriesOn ? n(v.calories) : profile.calorie_target,
            overload_increment: Number(v.increment),
            meal_tags: mealTags.length ? mealTags : profile.meal_tags,
            steps_target: n(v.steps),
            glucose_unit: glucoseUnit,
          },
          { onSuccess: () => toast('Targets saved') },
        );
      }}
    >
      <p className="text-sm text-muted">All optional. Leave a box empty for no target.</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Protein (g a day)" inputMode="numeric" value={v.protein} onChange={(e) => setV({ ...v, protein: e.target.value })} error={errors.protein} />
        <TextField label="Water (glasses a day)" inputMode="numeric" value={v.water} onChange={(e) => setV({ ...v, water: e.target.value })} error={errors.water} />
        <TextField label="Workouts a week" inputMode="numeric" value={v.workouts} onChange={(e) => setV({ ...v, workouts: e.target.value })} error={errors.workouts} />
        <TextField label="Steps a day" inputMode="numeric" value={v.steps} onChange={(e) => setV({ ...v, steps: e.target.value })} error={errors.steps} />
        <SelectField
          label="Blood sugar unit"
          value={glucoseUnit}
          onChange={(e) => setGlucoseUnit(e.target.value as 'mg/dL' | 'mmol/L')}
          options={[
            { value: 'mg/dL', label: 'mg/dL (India, US)' },
            { value: 'mmol/L', label: 'mmol/L (UK, Europe)' },
          ]}
        />
        <TextField
          label={`Overload step (${profile.units})`}
          inputMode="decimal"
          value={v.increment}
          onChange={(e) => setV({ ...v, increment: e.target.value })}
          error={errors.increment}
          hint="Added when every set hit the top of the range"
        />
      </div>
      <label className="flex flex-row-reverse items-center justify-between gap-4">
        <input type="checkbox" role="switch" className="switch" checked={caloriesOn} onChange={(e) => setCaloriesOn(e.target.checked)} />
        <span>
          <span className="font-medium">Show calories</span>
          <span className="block text-sm text-muted">Off by default. Steady never shows shortfalls or “over budget” warnings.</span>
        </span>
      </label>
      {caloriesOn && (
        <TextField label="Calorie target (optional)" inputMode="numeric" value={v.calories} onChange={(e) => setV({ ...v, calories: e.target.value })} error={errors.calories} />
      )}
      <TagInput label="Meal tags" value={mealTags} onChange={setMealTags} max={12} />
      <p className="-mt-2 text-sm text-muted">“home-cooked” and “whole-food” count towards the home-cooked share.</p>
      {update.isError && <FormMessage tone="error">{errorMessage(update.error)}</FormMessage>}
      <Button type="submit" loading={update.isPending}>
        Save targets
      </Button>
    </form>
  );
}

export function AboutYouSection() {
  const profile = useLoadedProfile();
  const update = useUpdateProfile();
  const toast = useToast();
  const [v, setV] = useState({
    birthday: profile.birthday ?? '',
    height: profile.height_cm == null ? '' : String(Number(profile.height_cm)),
    sex: profile.sex ?? '',
    activity: profile.activity_level ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const h = v.height.trim() === '' ? null : Number(v.height);
        if (h != null && (Number.isNaN(h) || h < 100 || h > 250)) return setErr('Height should be in centimetres, between 100 and 250.');
        setErr(null);
        update.mutate(
          {
            birthday: v.birthday || null,
            height_cm: h,
            sex: (v.sex || null) as 'male' | 'female' | null,
            activity_level: (v.activity || null) as 'sedentary' | 'light' | 'moderate' | 'active' | null,
          },
          { onSuccess: () => toast('Saved') },
        );
      }}
    >
      <p className="text-sm text-muted">All optional. Your birthday gives goals a countdown (and a hello on the day); the rest is only used for a calorie estimate on your weight goal.</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Birthday" type="date" value={v.birthday} onChange={(e) => setV({ ...v, birthday: e.target.value })} />
        <TextField label="Height (cm)" inputMode="decimal" value={v.height} onChange={(e) => setV({ ...v, height: e.target.value.replace(/[^\d.]/g, '') })} />
        <SelectField
          label="Sex (for the estimate)"
          value={v.sex}
          onChange={(e) => setV({ ...v, sex: e.target.value })}
          options={[
            { value: '', label: 'Prefer not to say' },
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ]}
        />
        <SelectField
          label="Activity level"
          value={v.activity}
          onChange={(e) => setV({ ...v, activity: e.target.value })}
          options={[
            { value: '', label: 'Not set' },
            { value: 'sedentary', label: 'Mostly sitting' },
            { value: 'light', label: 'Light (1–3 days)' },
            { value: 'moderate', label: 'Moderate (3–5 days)' },
            { value: 'active', label: 'Active (most days)' },
          ]}
        />
      </div>
      {(err || update.isError) && <FormMessage tone="error">{err ?? errorMessage(update.error)}</FormMessage>}
      <Button type="submit" loading={update.isPending}>
        Save
      </Button>
    </form>
  );
}

export function JournalLockSection() {
  const profile = useLoadedProfile();
  const update = useUpdateProfile();
  return (
    <label className="flex flex-row-reverse items-center justify-between gap-4">
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={profile.journal_lock_enabled}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ journal_lock_enabled: e.target.checked })}
      />
      <span>
        <span className="font-semibold">Lock Steady after 10 minutes without use</span>
        <span className="block text-sm text-muted">The whole app locks, including when you reopen it after a break. One PIN unlocks everything, and you can also lock it any time from the menu.</span>
        {update.isError && <span className="block text-sm text-danger">{errorMessage(update.error)}</span>}
      </span>
    </label>
  );
}

export function DataSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [includeSettings, setIncludeSettings] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-base">Export</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy === 'json'} onClick={() => void run('json', downloadJSON)}>
            <FileJson className="h-4 w-4" aria-hidden />
            Everything (JSON)
          </Button>
          <Button
            variant="secondary"
            loading={busy === 'journal'}
            onClick={() => void run('journal', async () => toast(`Exported ${await downloadJournalZip()} journal entries`))}
          >
            <FileText className="h-4 w-4" aria-hidden />
            Journal as Markdown (.zip)
          </Button>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-medium text-accent-ink">Spreadsheet (CSV) by module</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODULE_TABLES.map((m) => (
              <Button key={m.key} size="sm" variant="ghost" loading={busy === m.key} onClick={() => void run(m.key, () => downloadModuleCSV(m.key))}>
                <Download className="h-4 w-4" aria-hidden />
                {m.label}
              </Button>
            ))}
          </div>
        </details>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-base">Import</h3>
        <p className="text-sm text-muted">
          Restore a Steady JSON export. You'll see what's in it before anything is written. Items already here are skipped, and
          nothing is deleted.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Choose a Steady export file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            setResult(null);
            setPreview(null);
            if (f) void run('read', async () => setPreview(await readImportFile(f)));
          }}
        />
        {!preview && (
          <Button variant="secondary" loading={busy === 'read'} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden />
            Choose file
          </Button>
        )}
        {preview && (
          <div className="rounded-input border border-border bg-surface p-3">
            <p className="font-medium">Exported {formatISODate(preview.exportedAt.slice(0, 10), 'd MMM yyyy')}</p>
            {preview.counts.length === 0 ? (
              <p className="text-sm text-muted">This file has no rows to import.</p>
            ) : (
              <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm text-muted">
                {preview.counts.map((c) => (
                  <li key={c.table}>
                    {c.table.replace(/_/g, ' ')}: {c.rows}
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-3 flex flex-row-reverse items-center justify-between gap-3 text-sm">
              <input type="checkbox" role="switch" className="switch" checked={includeSettings} onChange={(e) => setIncludeSettings(e.target.checked)} />
              Also restore settings and targets
            </label>
            <div className="mt-3 flex gap-2">
              <Button
                loading={busy === 'import'}
                disabled={preview.counts.length === 0 && !includeSettings}
                onClick={() =>
                  void run('import', async () => {
                    const r = await runImport(preview, includeSettings);
                    setResult(r);
                    setPreview(null);
                    await qc.invalidateQueries();
                  })
                }
              >
                Import
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {result && (
          <FormMessage tone="success">
            Imported {Object.values(result).reduce((a, b) => a + b, 0)} new items
            {Object.keys(result).length ? ` (${Object.entries(result).filter(([, n]) => n > 0).map(([t, n]) => `${t.replace(/_/g, ' ')} ${n}`).join(', ') || 'everything was already here'})` : ''}.
          </FormMessage>
        )}
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  );
}

export function DeleteAccountSection() {
  const user = useUser();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        This permanently deletes your account and everything in it: journal, check-ins, habits, workouts, food, people, tasks,
        notes, reviews, health readings, goals, medications and progress photos. Export first if you might want it later.
      </p>
      <TextField label='Type DELETE to confirm' value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <Button
        variant="danger"
        disabled={typed !== 'DELETE'}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            assertOnline();
            // Photo files live in Storage, which account deletion doesn't reach, so remove them first.
            await deleteAllPhotoFiles(user.id);
            unwrap(await supabase.rpc('delete_my_account'));
            await supabase.auth.signOut().catch(() => undefined);
            qc.clear();
            forgetEmail();
            try {
              for (const k of Object.keys(localStorage)) if (k.startsWith('steady-journal-draft')) localStorage.removeItem(k);
            } catch {
              // ignore
            }
            navigate('/setup', { replace: true });
          } catch (e) {
            setError(errorMessage(e));
            setBusy(false);
          }
        }}
      >
        Delete my account and all data
      </Button>
    </div>
  );
}
