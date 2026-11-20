import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Cake, Check, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { z } from 'zod';
import {
  useDeleteInteraction,
  useDeletePerson,
  useFollowUpMutations,
  useFollowUps,
  useInteractions,
  useInteractionsRange,
  usePeople,
  useSavePerson,
  type PersonInput,
} from '@/features/people/queries';
import { daysSinceContact, KIND_LABEL, reachOutList, upcomingBirthdays } from '@/features/people/logic';
import { LogInteractionSheet } from '@/features/people/LogInteraction';
import { ReachOutRow } from '@/features/people/ReachOutRow';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import type { PersonRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { IconButton, StatTile } from '@/components/ui/Layout';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { CardSkeleton, EmptyState, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { formatISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

export function PeoplePage() {
  const { today } = useToday();
  const people = usePeople();
  const monthStart = `${today.slice(0, 7)}-01`;
  const month = useInteractionsRange(monthStart, today);
  const [logging, setLogging] = useState<PersonRow | null>(null);

  if (people.isPending) return <CardSkeleton lines={5} />;
  if (people.isError) return <ErrorState error={people.error} onRetry={() => void people.refetch()} />;

  const active = people.data.filter((p) => !p.archived_at);
  const archived = people.data.filter((p) => p.archived_at);
  const reach = reachOutList(active, today);
  const birthdays = upcomingBirthdays(active, today);
  const contacted = new Set((month.data ?? []).map((i) => i.person_id)).size;
  const inPerson = (month.data ?? []).filter((i) => i.kind === 'in_person').length;

  return (
    <>
      <PageHeader
        title="People"
        actions={
          <Link to="/people/new" className={buttonClasses('primary', 'sm')}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Add person
          </Link>
        }
      />
      <LogInteractionSheet person={logging} onClose={() => setLogging(null)} />
      {active.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Who matters to you?"
          action={
            <Link to="/people/new" className={buttonClasses('primary')}>
              Add someone
            </Link>
          }
        >
          Add the people you want to stay close to and how often you'd like to be in touch. Steady will gently remind you.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <section className="card" aria-labelledby="reach">
            <h2 id="reach" className="text-base">
              Reach out
            </h2>
            {reach.length === 0 ? (
              <p className="mt-1 text-sm text-muted">You're in touch with everyone on your list. Lovely.</p>
            ) : (
              <ul className="mt-1 divide-y divide-border">
                {reach.map((p) => (
                  <ReachOutRow key={p.id} person={p} overdue={p.overdue} onLog={() => setLogging(p)} />
                ))}
              </ul>
            )}
          </section>

          {birthdays.length > 0 && (
            <section className="card" aria-labelledby="bdays">
              <h2 id="bdays" className="flex items-center gap-2 text-base">
                <Cake className="h-4 w-4 text-clay-ink" aria-hidden />
                Birthdays in the next 30 days
              </h2>
              <ul className="mt-2 space-y-1">
                {birthdays.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <Link to={`/people/${p.id}`} className="hover:text-accent-ink">
                      {p.name}
                    </Link>
                    <span className="text-sm text-muted">
                      {p.inDays === 0 ? 'Today' : p.inDays === 1 ? 'Tomorrow' : `${formatISODate(p.date, 'EEE d MMM')} · in ${p.inDays} days`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="month-social">
            <h2 id="month-social" className="mb-2 text-base">
              This month
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="People contacted" value={month.isPending ? '…' : contacted} />
              <StatTile label="Met in person" value={month.isPending ? '…' : inPerson} />
              <StatTile label="Due a message" value={reach.length} />
            </div>
          </section>

          <section aria-labelledby="everyone">
            <h2 id="everyone" className="mb-2 text-base">
              Everyone
            </h2>
            <ul className="card divide-y divide-border py-1">
              {active.map((p) => (
                <li key={p.id}>
                  <Link to={`/people/${p.id}`} className="flex min-h-12 items-center justify-between gap-2 hover:text-accent-ink">
                    <span>
                      {p.name}
                      {p.relationship && <span className="ml-2 text-sm text-muted">{p.relationship}</span>}
                    </span>
                    <span className="text-sm text-muted">
                      {p.last_contacted_on ? `${daysSinceContact(p, today)}d ago` : 'Not yet'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {archived.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted">Archived ({archived.length})</summary>
                <ul className="card mt-2 divide-y divide-border py-1">
                  {archived.map((p) => (
                    <li key={p.id}>
                      <Link to={`/people/${p.id}`} className="flex min-h-12 items-center hover:text-accent-ink">
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------- detail -- */

export function PersonPage() {
  const { id = '' } = useParams();
  const { today } = useToday();
  const profile = useLoadedProfile();
  const people = usePeople();
  const interactions = useInteractions(id);
  const followUps = useFollowUps(id);
  const fu = useFollowUpMutations(id);
  const delInteraction = useDeleteInteraction();
  const save = useSavePerson();
  const del = useDeletePerson();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const [logging, setLogging] = useState<PersonRow | null>(null);
  const [newFollowUp, setNewFollowUp] = useState('');

  if (people.isPending) return <CardSkeleton lines={5} />;
  if (people.isError) return <ErrorState error={people.error} onRetry={() => void people.refetch()} />;
  const person = people.data.find((p) => p.id === id);
  if (!person) return <ErrorState error="This person isn't in your list any more." />;

  const since = daysSinceContact(person, today);

  return (
    <>
      <PageHeader
        title={person.name}
        description={[person.relationship, person.archived_at ? 'archived' : null].filter(Boolean).join(' · ') || undefined}
        actions={
          <Link to={`/people/${person.id}/edit`} className={buttonClasses('secondary', 'sm')}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </Link>
        }
      />
      <LogInteractionSheet person={logging} onClose={() => setLogging(null)} />
      <div className="space-y-4">
        <section className="card flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">{person.last_contacted_on ? `Last in touch ${since === 0 ? 'today' : `${since} days ago`}` : 'No contact logged yet'}</p>
            <p className="text-sm text-muted">
              {person.contact_every_days ? `You'd like to be in touch every ${person.contact_every_days} days` : 'No contact rhythm set'}
              {person.birthday_month && person.birthday_day
                ? ` · birthday ${formatISODate(`2000-${String(person.birthday_month).padStart(2, '0')}-${String(person.birthday_day).padStart(2, '0')}`, 'd MMMM')}`
                : ''}
            </p>
          </div>
          <Button onClick={() => setLogging(person)}>Log contact</Button>
        </section>

        {person.notes && (
          <section className="card">
            <h2 className="text-base">Notes</h2>
            <p className="mt-1 whitespace-pre-wrap font-serif">{person.notes}</p>
          </section>
        )}

        <section className="card" aria-labelledby="fu">
          <h2 id="fu" className="text-base">
            Things to follow up on
          </h2>
          <ul className="mt-2 space-y-1">
            {(followUps.data ?? []).map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!f.done_at}
                  aria-label={f.text}
                  onClick={() => fu.toggle.mutate({ id: f.id, isDone: !f.done_at })}
                  className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2', f.done_at ? 'border-accent bg-accent text-accent-fg' : 'border-border')}
                >
                  {f.done_at && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                </button>
                <span className={cn('flex-1', f.done_at && 'text-muted line-through')}>{f.text}</span>
                <IconButton label="Delete follow-up" onClick={() => fu.remove.mutate(f.id)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = newFollowUp.trim();
              if (!t) return;
              fu.add.mutate(t, { onSuccess: () => setNewFollowUp('') });
            }}
          >
            <TextField label="New follow-up" hideLabel wrapperClassName="flex-1" placeholder="e.g. Ask how the interview went" value={newFollowUp} maxLength={300} onChange={(e) => setNewFollowUp(e.target.value)} />
            <Button type="submit" variant="secondary" aria-label="Add follow-up" loading={fu.add.isPending}>
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          </form>
        </section>

        <section aria-labelledby="hist">
          <h2 id="hist" className="mb-2 text-base">
            History
          </h2>
          {interactions.isError ? (
            <ErrorState error={interactions.error} onRetry={() => void interactions.refetch()} />
          ) : interactions.data && interactions.data.length > 0 ? (
            <ul className="card divide-y divide-border py-1">
              {interactions.data.map((i) => (
                <li key={i.id} className="flex min-h-12 items-center justify-between gap-2 py-1">
                  <span>
                    <span className="font-medium">{KIND_LABEL[i.kind]}</span>
                    <span className="ml-2 text-sm text-muted">{formatISODate(i.day, profile.date_format)}</span>
                    {i.note && <span className="block text-sm text-muted">{i.note}</span>}
                  </span>
                  <IconButton
                    label="Delete this entry"
                    onClick={async () => {
                      if (await confirm({ title: 'Delete this contact entry?', confirmLabel: 'Delete', danger: true })) delInteraction.mutate(i.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing logged yet.</p>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              save.mutate(
                { id: person.id, input: { archived_at: person.archived_at ? null : new Date().toISOString() } },
                { onSuccess: () => toast(person.archived_at ? 'Restored' : 'Archived. They won’t appear in reminders.') },
              )
            }
          >
            {person.archived_at ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
            {person.archived_at ? 'Restore' : 'Archive'}
          </Button>
          <Button
            variant="ghost"
            className="text-danger"
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${person.name}?`,
                body: 'Their notes, follow-ups and contact history will be deleted too.',
                confirmLabel: 'Delete permanently',
                danger: true,
              });
              if (ok) del.mutate(person.id, { onSuccess: () => navigate('/people'), onError: (e) => toast(errorMessage(e), 'error') });
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete
          </Button>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- form -- */

const personSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(80),
    relationship: z.string().trim().max(40),
    birthday: z.string().regex(/^(\d{2}-\d{2})?$/, 'Use MM-DD'),
    birth_year: z.string().regex(/^(\d{4})?$/, 'Use a 4-digit year'),
    notes: z.string().max(5000),
    contact_every_days: z.string(),
  })
  .refine((v) => !v.birthday || (Number(v.birthday.slice(0, 2)) >= 1 && Number(v.birthday.slice(0, 2)) <= 12 && Number(v.birthday.slice(3)) >= 1 && Number(v.birthday.slice(3)) <= 31), {
    path: ['birthday'],
    message: 'That date doesn’t exist',
  });

const RHYTHMS = [
  { value: '', label: 'No reminder' },
  { value: '7', label: 'Every week' },
  { value: '14', label: 'Every 2 weeks' },
  { value: '30', label: 'Every month' },
  { value: '60', label: 'Every 2 months' },
  { value: '90', label: 'Every 3 months' },
  { value: '180', label: 'Every 6 months' },
  { value: '365', label: 'Once a year' },
];

export function PersonFormPage() {
  const { id } = useParams();
  const people = usePeople();
  const person = id ? people.data?.find((p) => p.id === id) : undefined;
  if (id && people.isPending) return <CardSkeleton lines={5} />;
  if (id && !person) return <ErrorState error="This person isn't in your list any more." />;
  return (
    <>
      <PageHeader title={person ? `Edit ${person.name}` : 'Add a person'} />
      <PersonForm key={person?.id ?? 'new'} person={person} />
    </>
  );
}

function PersonForm({ person }: { person?: PersonRow }) {
  const save = useSavePerson();
  const navigate = useNavigate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const [v, setV] = useState({
    name: person?.name ?? '',
    relationship: person?.relationship ?? '',
    birthday: person?.birthday_month ? `${pad(person.birthday_month)}-${pad(person.birthday_day!)}` : '',
    birth_year: person?.birth_year ? String(person.birth_year) : '',
    notes: person?.notes ?? '',
    contact_every_days: person?.contact_every_days ? String(person.contact_every_days) : '30',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const rhythmOptions = RHYTHMS.some((r) => r.value === v.contact_every_days)
    ? RHYTHMS
    : [...RHYTHMS, { value: v.contact_every_days, label: `Every ${v.contact_every_days} days` }];

  return (
    <form
      className="card space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = personSchema.safeParse(v);
        if (!parsed.success) {
          setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
          return;
        }
        setErrors({});
        const d = parsed.data;
        const input: PersonInput = {
          name: d.name,
          relationship: d.relationship || null,
          birthday_month: d.birthday ? Number(d.birthday.slice(0, 2)) : null,
          birthday_day: d.birthday ? Number(d.birthday.slice(3)) : null,
          birth_year: d.birth_year ? Number(d.birth_year) : null,
          notes: d.notes.trim() || null,
          contact_every_days: d.contact_every_days ? Number(d.contact_every_days) : null,
        };
        save.mutate({ id: person?.id, input }, { onSuccess: (row) => navigate(`/people/${row.id}`, { replace: true }) });
      }}
    >
      <TextField label="Name" value={v.name} maxLength={80} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.name} autoFocus={!person} />
      <TextField label="Relationship (optional)" placeholder="friend, family, colleague…" value={v.relationship} maxLength={40} onChange={(e) => setV({ ...v, relationship: e.target.value })} />
      <SelectField label="How often would you like to be in touch?" value={v.contact_every_days} onChange={(e) => setV({ ...v, contact_every_days: e.target.value })} options={rhythmOptions} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Birthday (MM-DD, optional)" placeholder="07-21" inputMode="numeric" value={v.birthday} maxLength={5} onChange={(e) => setV({ ...v, birthday: e.target.value })} error={errors.birthday} />
        <TextField label="Birth year (optional)" inputMode="numeric" value={v.birth_year} maxLength={4} onChange={(e) => setV({ ...v, birth_year: e.target.value.replace(/\D/g, '') })} error={errors.birth_year} />
      </div>
      <TextAreaField label="Notes (optional)" rows={4} value={v.notes} maxLength={5000} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      {save.isError && <FormMessage tone="error">{errorMessage(save.error)}</FormMessage>}
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>
          {person ? 'Save changes' : 'Add person'}
        </Button>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
