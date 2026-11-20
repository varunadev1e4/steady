import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useLoadedProfile, useUpdateProfile } from '@/features/profile/queries';
import { ACCENTS, applyAccent, applyTheme, storedAccent, type AccentColour } from '@/features/profile/theme';
import { ChangePinForm } from '@/features/auth/ChangePinForm';
import { useAuth } from '@/features/auth/authContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { SelectField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/States';
import type { DateFormat, ThemePreference } from '@/types/database';
import { browserTimeZone, formatISODate, isValidTimeZone, listTimeZones, todayISO } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';
import { AboutYouSection, DataSection, DeleteAccountSection, JournalLockSection, ModulesSection, TargetsSection } from './SettingsSections';

const DATE_FORMATS: DateFormat[] = ['d MMM yyyy', 'MMM d, yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy'];

const preferencesSchema = z.object({
  display_name: z.string().trim().max(80, 'Keep it under 80 characters'),
  time_zone: z.string().refine(isValidTimeZone, 'Choose a time zone from the list'),
  week_start: z.enum(['0', '1']),
  units: z.enum(['kg', 'lb']),
  date_format: z.enum(DATE_FORMATS as [DateFormat, ...DateFormat[]]),
});
type PreferencesValues = z.infer<typeof preferencesSchema>;

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="card space-y-4">
      <div>
        <h2 id={id} className="text-lg">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function PreferencesForm() {
  const profile = useLoadedProfile();
  const update = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  const browserTz = browserTimeZone();

  const zones = useMemo(() => {
    const all = listTimeZones();
    return all.includes(profile.time_zone) ? all : [profile.time_zone, ...all];
  }, [profile.time_zone]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      display_name: profile.display_name ?? '',
      time_zone: profile.time_zone,
      week_start: String(profile.week_start) as '0' | '1',
      units: profile.units,
      date_format: profile.date_format,
    },
  });

  const tz = watch('time_zone');
  const today = todayISO(isValidTimeZone(tz) ? tz : 'UTC');

  const onSubmit = (values: PreferencesValues) => {
    setSaved(false);
    update.mutate(
      {
        display_name: values.display_name || null,
        time_zone: values.time_zone,
        week_start: Number(values.week_start) as 0 | 1,
        units: values.units,
        date_format: values.date_format,
      },
      {
        onSuccess: () => {
          reset(values);
          setSaved(true);
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate onChange={() => setSaved(false)}>
      <TextField
        label="Your name"
        autoComplete="given-name"
        hint="Used in your greeting on Today."
        error={errors.display_name?.message}
        {...register('display_name')}
      />
      <div>
        <SelectField
          label="Time zone"
          options={zones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))}
          error={errors.time_zone?.message}
          hint={`Days start and end at midnight here. Today is ${formatISODate(today, 'EEEE d MMMM')}.`}
          {...register('time_zone')}
        />
        {tz !== browserTz && (
          <button
            type="button"
            className="link mt-1.5 text-sm"
            onClick={() => setValue('time_zone', browserTz, { shouldDirty: true })}
          >
            Use this device's time zone ({browserTz.replace(/_/g, ' ')})
          </button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Week starts on"
          options={[
            { value: '1', label: 'Monday' },
            { value: '0', label: 'Sunday' },
          ]}
          {...register('week_start')}
        />
        <SelectField
          label="Weight units"
          options={[
            { value: 'kg', label: 'Kilograms (kg)' },
            { value: 'lb', label: 'Pounds (lb)' },
          ]}
          {...register('units')}
        />
      </div>
      <SelectField
        label="Date format"
        options={DATE_FORMATS.map((f) => ({ value: f, label: formatISODate(today, f) }))}
        {...register('date_format')}
      />
      {update.isError && <FormMessage tone="error">{errorMessage(update.error)}</FormMessage>}
      {saved && !isDirty && <FormMessage tone="success">Preferences saved.</FormMessage>}
      <Button type="submit" loading={update.isPending} disabled={!isDirty}>
        Save preferences
      </Button>
    </form>
  );
}

const THEMES: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function ThemePicker() {
  const profile = useLoadedProfile();
  const update = useUpdateProfile();

  const choose = (theme: ThemePreference) => {
    if (theme === profile.theme) return;
    const previous = profile.theme;
    applyTheme(theme); // instant feedback
    update.mutate({ theme }, { onError: () => applyTheme(previous) });
  };

  return (
    <div>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
        {THEMES.map(({ value, label, icon: Icon }) => {
          const active = profile.theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(value)}
              disabled={update.isPending}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-input border text-sm font-medium transition-colors',
                active
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-border bg-surface text-muted hover:text-ink',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      {update.isError && (
        <div className="mt-3">
          <FormMessage tone="error">{errorMessage(update.error)}</FormMessage>
        </div>
      )}
    </div>
  );
}

function AccentPicker() {
  const [accent, setAccent] = useState<AccentColour>(storedAccent);
  const choose = (a: AccentColour) => {
    applyAccent(a);
    setAccent(a);
  };
  return (
    <div className="mt-5">
      <p className="label" id="accent-label">
        Colour
      </p>
      <div role="radiogroup" aria-labelledby="accent-label" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ACCENTS.map(({ value, label, swatch }) => {
          const active = accent === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(value)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-input border text-sm font-medium transition-colors',
                active ? 'border-accent bg-accent-soft text-ink' : 'border-border bg-surface text-muted hover:text-ink',
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: swatch, color: value === 'yellow' ? '#201C00' : '#FFFFFF' }} aria-hidden>
                {active && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted">Saved on this device. Habit colours and charts keep their own colours.</p>
    </div>
  );
}

export function SettingsPage() {
  const { user, signOut } = useAuth();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <Section title="Profile and preferences">
          <PreferencesForm />
        </Section>

        <Section title="Appearance" description="Light, dark or System (follows your device), and the app's main colour.">
          <ThemePicker />
          <AccentPicker />
        </Section>

        <Section title="About you">
          <AboutYouSection />
        </Section>

        <Section title="Modules" description="Turn off anything you don't use.">
          <ModulesSection />
        </Section>

        <Section title="Targets">
          <TargetsSection />
        </Section>

        <Section title="Privacy lock">
          <JournalLockSection />
        </Section>

        <Section title="Your data" description="Everything you've put into Steady, in open formats.">
          <DataSection />
        </Section>

        <Section title="Account" description={user?.email ? `Signed in as ${user.email}` : undefined}>
          <h3 className="text-base">Change PIN</h3>
          <ChangePinForm />
          <div className="border-t border-border pt-4">
            <Button variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </Section>

        <Section title="Delete account">
          <DeleteAccountSection />
        </Section>
      </div>
    </>
  );
}
