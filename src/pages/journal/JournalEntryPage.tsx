import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import {
  ArrowLeft,
  Bold,
  CloudOff,
  Heading2,
  Italic,
  List,
  Pin,
  PinOff,
  Quote,
  Trash2,
} from 'lucide-react';
import { journalKeys, saveEntry, useDeleteEntry, useJournalEntry, useTags, type EntryDraft } from '@/features/journal/queries';
import {
  composeEvening,
  composeThoughtRecord,
  EMPTY_THOUGHT,
  ENTRY_TYPES,
  entryTypeLabel,
  EVENING_SECTIONS,
  wordCount,
  type ThoughtFields,
} from '@/features/journal/logic';
import { applyFormat, type FormatKind } from '@/features/journal/markdownFormat';
import { useCheckIn } from '@/features/checkin/queries';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import type { EntryType } from '@/types/database';
import { Markdown } from '@/components/ui/Markdown';
import { Chip, RatingPicker, Segmented, TagInput } from '@/components/ui/Controls';
import { moodLabel } from '@/components/ui/scales';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/Layout';
import { Button } from '@/components/ui/Button';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { errorMessage } from '@/utils/errors';
import { formatISODate } from '@/utils/dates';
import { cn } from '@/utils/cn';

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error';

interface LocalDraft {
  draft: EntryDraft;
  thought: ThoughtFields;
  at: number;
}

const draftKey = (id?: string) => `steady-journal-draft:${id ?? 'new'}`;
const readLocal = (id?: string): LocalDraft | null => {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
};
const writeLocal = (id: string | undefined, value: LocalDraft) => {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(value));
  } catch {
    // storage full or unavailable: the server save still runs
  }
};
const clearLocal = (id?: string) => {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    // ignore
  }
};

/** Structured types keep a readable Markdown copy in body for search and export. */
function prepare(d: EntryDraft, t: ThoughtFields): [EntryDraft, ThoughtFields | null] {
  if (d.entry_type === 'evening') return [{ ...d, body: composeEvening(d.fields) }, null];
  if (d.entry_type === 'thought_record') return [{ ...d, fields: {}, body: composeThoughtRecord(t) }, t];
  return [{ ...d, fields: {} }, null];
}

function hasContent(d: EntryDraft, t: ThoughtFields): boolean {
  if (d.title.trim()) return true;
  if (d.entry_type === 'evening') return Object.values(d.fields).some((v) => v.trim());
  if (d.entry_type === 'thought_record') {
    return [t.situation, t.automatic_thought, t.evidence_for, t.evidence_against, t.balanced_thought].some((v) => v.trim());
  }
  return d.body.trim().length > 0;
}

const AUTOSAVE_MS = 2000;

interface EditorProps {
  initialDraft: EntryDraft;
  initialThought: ThoughtFields;
  createdAt: string | null;
  updatedAt: string | null;
  onCreated: (id: string) => void;
}

function Editor({ initialDraft, initialThought, createdAt, updatedAt, onCreated }: EditorProps) {
  const profile = useLoadedProfile();
  const { today, tz } = useToday();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const del = useDeleteEntry();
  const tags = useTags();

  const [draft, setDraft] = useState<EntryDraft>(initialDraft);
  const [thought, setThought] = useState<ThoughtFields>(initialThought);
  const [mode, setMode] = useState<'write' | 'preview'>(initialDraft.id ? 'preview' : 'write');
  const [status, setStatus] = useState<SaveStatus>(initialDraft.id ? 'saved' : 'idle');
  const [savedAt, setSavedAt] = useState<string | null>(updatedAt);
  const [writtenAt, setWrittenAt] = useState<string | null>(createdAt);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restorable, setRestorable] = useState<LocalDraft | null>(() => {
    const local = readLocal(initialDraft.id);
    if (!local) return null;
    if (initialDraft.id && updatedAt && local.at <= Date.parse(updatedAt)) return null;
    return local;
  });

  const latest = useRef({ draft, thought });
  latest.current = { draft, thought };
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const save = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current);
    if (saving.current || !dirty.current) return;
    const [d, t] = prepare(latest.current.draft, latest.current.thought);
    if (!hasContent(latest.current.draft, latest.current.thought)) return;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    saving.current = true;
    dirty.current = false;
    setStatus('saving');
    setSaveError(null);
    try {
      const row = await saveEntry(d, t);
      if (!latest.current.draft.id) {
        latest.current = { ...latest.current, draft: { ...latest.current.draft, id: row.id } };
        setDraft((s) => ({ ...s, id: row.id }));
        clearLocal(undefined);
        setWrittenAt(row.created_at);
        onCreated(row.id);
      }
      clearLocal(row.id);
      qc.setQueryData(journalKeys.entry(row.id), { entry: row, thought: t });
      void qc.invalidateQueries({ queryKey: journalKeys.all, predicate: (q) => q.queryKey[1] !== 'entry' });
      setSavedAt(row.updated_at);
      setStatus(dirty.current ? 'pending' : 'saved');
    } catch (e) {
      dirty.current = true;
      setStatus(navigator.onLine ? 'error' : 'offline');
      setSaveError(errorMessage(e));
    } finally {
      saving.current = false;
      if (dirty.current) timer.current = window.setTimeout(() => void save(), AUTOSAVE_MS);
    }
  }, [onCreated, qc]);

  const changed = (nextDraft: EntryDraft, nextThought: ThoughtFields) => {
    dirty.current = true;
    setStatus('pending');
    writeLocal(nextDraft.id, { draft: nextDraft, thought: nextThought, at: Date.now() });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), AUTOSAVE_MS);
  };

  const update = (patch: Partial<EntryDraft>) => {
    const next = { ...latest.current.draft, ...patch };
    setDraft(next);
    latest.current = { ...latest.current, draft: next };
    changed(next, latest.current.thought);
  };
  const updateThought = (patch: Partial<ThoughtFields>) => {
    const next = { ...latest.current.thought, ...patch };
    setThought(next);
    latest.current = { ...latest.current, thought: next };
    changed(latest.current.draft, next);
  };

  // Save when leaving, hiding the app, or coming back online.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void save();
    const onOnline = () => void save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('online', onOnline);
      void save();
    };
  }, [save]);

  const format = (kind: FormatKind) => {
    const el = bodyRef.current;
    if (!el) return;
    const r = applyFormat(el.value, el.selectionStart, el.selectionEnd, kind);
    update({ body: r.value });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.start, r.end);
    });
  };

  const onDelete = async () => {
    if (!draft.id) {
      if (hasContent(draft, thought)) {
        const ok = await confirm({ title: 'Discard this entry?', body: 'It hasn’t been saved yet.', confirmLabel: 'Discard', danger: true });
        if (!ok) return;
      }
      dirty.current = false;
      window.clearTimeout(timer.current);
      clearLocal(undefined);
      navigate('/journal');
      return;
    }
    const ok = await confirm({
      title: 'Delete this entry?',
      body: 'It will be removed permanently. This can’t be undone.',
      confirmLabel: 'Delete entry',
      danger: true,
    });
    if (!ok) return;
    dirty.current = false;
    del.mutate(draft.id, {
      onSuccess: () => {
        clearLocal(draft.id);
        toast('Entry deleted');
        navigate('/journal');
      },
      onError: (e) => toast(errorMessage(e), 'error'),
    });
  };

  const checkIn = useCheckIn(draft.day);
  // Count only what was written, not the template headings.
  const words = wordCount(
    draft.entry_type === 'evening'
      ? Object.values(draft.fields).join(' ')
      : draft.entry_type === 'thought_record'
        ? [thought.situation, thought.automatic_thought, thought.evidence_for, thought.evidence_against, thought.balanced_thought].join(' ')
        : draft.body,
  );
  const isFreeform = !['evening', 'thought_record'].includes(draft.entry_type);

  const statusText: Record<SaveStatus, ReactNode> = {
    idle: 'Not saved yet',
    pending: 'Unsaved changes…',
    saving: 'Saving…',
    saved: savedAt ? `Saved ${formatInTimeZone(new Date(savedAt), tz, 'h:mm a')}` : 'Saved',
    offline: (
      <span className="inline-flex items-center gap-1 text-amber-ink">
        <CloudOff className="h-3.5 w-3.5" aria-hidden /> Offline: kept on this device until you reconnect
      </span>
    ),
    error: (
      <span className="text-danger">
        Couldn’t save.{' '}
        <button type="button" className="underline" onClick={() => void save()}>
          Try again
        </button>
      </span>
    ),
  };

  return (
    <div className="space-y-4">
      <h1 className="sr-only">{draft.id ? 'Journal entry' : 'New journal entry'}</h1>
      <div className="flex items-center justify-between gap-2">
        <Link to="/journal" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Journal
        </Link>
        <div className="flex items-center">
          <IconButton label={draft.pinned ? 'Unpin entry' : 'Pin entry'} onClick={() => update({ pinned: !draft.pinned })}>
            {draft.pinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
          </IconButton>
          <IconButton label={draft.id ? 'Delete entry' : 'Discard entry'} onClick={() => void onDelete()}>
            <Trash2 className="h-5 w-5" />
          </IconButton>
        </div>
      </div>

      {restorable && (
        <div className="rounded-card border border-amber/50 bg-amber-soft p-3 text-sm">
          <p>There’s a newer unsaved version of this entry on this device.</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const r = restorable;
                setRestorable(null);
                setDraft({ ...r.draft, id: latest.current.draft.id });
                setThought(r.thought);
                latest.current = { draft: { ...r.draft, id: latest.current.draft.id }, thought: r.thought };
                changed(latest.current.draft, r.thought);
              }}
            >
              Restore it
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearLocal(initialDraft.id);
                setRestorable(null);
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted" aria-live="polite">
        <span>
          {entryTypeLabel(draft.entry_type)} · {words} {words === 1 ? 'word' : 'words'}
          {writtenAt && ` · written ${formatInTimeZone(new Date(writtenAt), tz, 'h:mm a')}`}
        </span>
        <span>{statusText[status]}</span>
      </div>

      {!draft.id && (
        <div role="radiogroup" aria-label="Entry type" className="flex flex-wrap gap-2">
          {ENTRY_TYPES.map((t) => (
            <Chip key={t.value} active={draft.entry_type === t.value} onClick={() => update({ entry_type: t.value as EntryType })}>
              {t.label}
            </Chip>
          ))}
        </div>
      )}

      {draft.prompt && (
        <div className="rounded-card border-l-4 border-clay bg-clay-soft/60 px-4 py-3">
          <p className="font-serif text-prose italic">{draft.prompt}</p>
          <button type="button" className="mt-1 text-xs text-muted underline" onClick={() => update({ prompt: null })}>
            Remove prompt
          </button>
        </div>
      )}

      <input
        aria-label="Title (optional)"
        placeholder="Title (optional)"
        value={draft.title}
        maxLength={200}
        onChange={(e) => update({ title: e.target.value })}
        onBlur={() => void save()}
        className="w-full bg-transparent text-2xl font-semibold text-ink outline-none placeholder:text-muted/60"
      />

      {isFreeform ? (
        <div className="card p-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1">
            <div className={cn('flex', mode === 'preview' && 'invisible')}>
              <IconButton label="Bold" onClick={() => format('bold')}>
                <Bold className="h-4 w-4" />
              </IconButton>
              <IconButton label="Italic" onClick={() => format('italic')}>
                <Italic className="h-4 w-4" />
              </IconButton>
              <IconButton label="Heading" onClick={() => format('heading')}>
                <Heading2 className="h-4 w-4" />
              </IconButton>
              <IconButton label="List" onClick={() => format('list')}>
                <List className="h-4 w-4" />
              </IconButton>
              <IconButton label="Quote" onClick={() => format('quote')}>
                <Quote className="h-4 w-4" />
              </IconButton>
            </div>
            <Segmented
              label="Editor mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'write', label: 'Write' },
                { value: 'preview', label: 'Preview' },
              ]}
              className="w-44 bg-bg"
            />
          </div>
          <div className="px-4 py-3">
            {mode === 'write' ? (
              <textarea
                ref={bodyRef}
                aria-label="Entry"
                value={draft.body}
                onChange={(e) => {
                  update({ body: e.target.value });
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onBlur={() => void save()}
                placeholder={
                  draft.entry_type === 'gratitude'
                    ? '1. \n2. \n3. '
                    : draft.entry_type === 'brain_dump'
                      ? 'Everything on your mind, in any order…'
                      : 'Start writing…'
                }
                rows={12}
                autoFocus={!draft.id}
                className="editor-text min-h-[50vh]"
              />
            ) : draft.body.trim() ? (
              <Markdown className="min-h-[30vh]">{draft.body}</Markdown>
            ) : (
              <p className="min-h-[30vh] text-muted">Nothing written yet. Switch to Write to start.</p>
            )}
          </div>
        </div>
      ) : draft.entry_type === 'evening' ? (
        <div className="card space-y-4">
          {EVENING_SECTIONS.map((s) => (
            <TextAreaField
              key={s.key}
              label={s.label}
              value={draft.fields[s.key] ?? ''}
              onChange={(e) => update({ fields: { ...draft.fields, [s.key]: e.target.value } })}
              onBlur={() => void save()}
              className="font-serif text-prose"
              rows={3}
            />
          ))}
        </div>
      ) : (
        <div className="card space-y-4">
          <p className="rounded-input bg-panel px-3 py-2 text-sm text-muted">
            A thought record is a self-help reflection tool, not therapy. If things feel heavy, please talk to someone you
            trust or a professional.
          </p>
          <TextAreaField label="Situation: what happened?" rows={2} value={thought.situation} onChange={(e) => updateThought({ situation: e.target.value })} onBlur={() => void save()} className="font-serif" />
          <TextAreaField label="The thought that showed up" rows={2} value={thought.automatic_thought} onChange={(e) => updateThought({ automatic_thought: e.target.value })} onBlur={() => void save()} className="font-serif" />
          <BeliefSlider label="How strongly did you believe it?" value={thought.belief_before} onChange={(v) => updateThought({ belief_before: v })} />
          <TextAreaField label="Evidence for the thought" rows={3} value={thought.evidence_for} onChange={(e) => updateThought({ evidence_for: e.target.value })} onBlur={() => void save()} className="font-serif" />
          <TextAreaField label="Evidence against the thought" rows={3} value={thought.evidence_against} onChange={(e) => updateThought({ evidence_against: e.target.value })} onBlur={() => void save()} className="font-serif" />
          <TextAreaField label="A more balanced thought" rows={2} value={thought.balanced_thought} onChange={(e) => updateThought({ balanced_thought: e.target.value })} onBlur={() => void save()} className="font-serif" />
          <BeliefSlider label="How much do you believe the original thought now?" value={thought.belief_after} onChange={(v) => updateThought({ belief_after: v })} />
        </div>
      )}

      <details className="card" open={!draft.id}>
        <summary className="cursor-pointer select-none font-medium">Mood, tags and date</summary>
        <div className="mt-4 space-y-4">
          <RatingPicker label="Mood (optional)" kind="mood" value={draft.mood} onChange={(m) => update({ mood: m })} />
          <TagInput value={draft.tags} onChange={(t) => update({ tags: t })} suggestions={tags.data ?? []} />
          <TextField
            label="Date"
            type="date"
            max={today}
            value={draft.day}
            onChange={(e) => e.target.value && update({ day: e.target.value })}
          />
        </div>
      </details>

      <section className="rounded-card border border-border px-4 py-3 text-sm text-muted" aria-label="Check-in that day">
        {checkIn.data?.mood ? (
          <>
            {formatISODate(draft.day, profile.date_format)}: mood {moodLabel(checkIn.data.mood)}
            {checkIn.data.sleep_hours != null && ` · slept ${Number(checkIn.data.sleep_hours)}h`}
            {checkIn.data.energy != null && ` · energy ${checkIn.data.energy}/5`}
          </>
        ) : (
          <>No check-in on {formatISODate(draft.day, profile.date_format)}.</>
        )}
      </section>

      {saveError && status === 'error' && <FormMessage tone="error">{saveError}</FormMessage>}
    </div>
  );
}

function BeliefSlider({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="label">
        {label} <span className="font-normal text-muted">{value == null ? '(not set)' : `${value}%`}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value ?? 50}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[rgb(var(--accent-strong))]"
      />
    </label>
  );
}

/** /journal/write (new) and /journal/write/:id (existing) share one route so the first save doesn't remount the editor. */
export function JournalEntryPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { today } = useToday();
  const created = useRef(new Set<string>());
  const newSession = useRef(location.key);
  if (!id) newSession.current = location.key;
  const isOwnNew = id != null && created.current.has(id);
  const q = useJournalEntry(isOwnNew ? undefined : id);

  const onCreated = useCallback(
    (newId: string) => {
      created.current.add(newId);
      navigate(`/journal/write/${newId}`, { replace: true });
    },
    [navigate],
  );

  const body = (() => {
    if (!id || isOwnNew) {
      const typeParam = params.get('type') as EntryType | null;
      const type = ENTRY_TYPES.some((t) => t.value === typeParam) ? typeParam! : 'free';
      const day = params.get('day');
      return (
        <Editor
          key={`new-${newSession.current}`}
          initialDraft={{
            day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today ? day : today,
            entry_type: type,
            title: '',
            body: '',
            fields: {},
            prompt: params.get('prompt'),
            mood: null,
            tags: [],
            pinned: false,
          }}
          initialThought={EMPTY_THOUGHT}
          createdAt={null}
          updatedAt={null}
          onCreated={onCreated}
        />
      );
    }
    if (q.isPending) return <CardSkeleton lines={8} />;
    if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
    if (!q.data) return <ErrorState error="This entry doesn't exist any more." />;
    const { entry, thought } = q.data;
    return (
      <Editor
        key={entry.id}
        initialDraft={{
          id: entry.id,
          day: entry.day,
          entry_type: entry.entry_type,
          title: entry.title ?? '',
          body: entry.body,
          fields: entry.fields ?? {},
          prompt: entry.prompt,
          mood: entry.mood,
          tags: entry.tags,
          pinned: entry.pinned,
        }}
        initialThought={thought ? { ...EMPTY_THOUGHT, ...thought } : EMPTY_THOUGHT}
        createdAt={entry.created_at}
        updatedAt={entry.updated_at}
        onCreated={onCreated}
      />
    );
  })();

  return body;
}
