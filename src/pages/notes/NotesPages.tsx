import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowLeft, Pin, PinOff, Plus, Search, StickyNote, Trash2 } from 'lucide-react';
import { noteKeys, saveNote, useDeleteNote, useNote, useNotes, type NoteInput } from '@/features/notes/queries';
import { useTags } from '@/features/journal/queries';
import { preview } from '@/features/journal/logic';
import { useLoadedProfile } from '@/features/profile/queries';
import type { NoteRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Segmented, TagInput } from '@/components/ui/Controls';
import { IconButton } from '@/components/ui/Layout';
import { Markdown } from '@/components/ui/Markdown';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { formatInTimeZone } from 'date-fns-tz';
import { errorMessage } from '@/utils/errors';

export function NotesPage() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [archived, setArchived] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);
  const notes = useNotes({ q, tag, archived });
  const tags = [...new Set((notes.data ?? []).flatMap((n) => n.tags))].sort();

  return (
    <>
      <PageHeader
        title="Notes"
        actions={
          <Link to="/notes/write" className={buttonClasses('primary', 'sm')}>
            <Plus className="h-4 w-4" aria-hidden />
            New note
          </Link>
        }
      />
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" aria-label="Search notes" placeholder="Search notes" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" />
        </div>
      </div>
      <Segmented
        label="Show"
        value={archived ? 'archived' : 'active'}
        onChange={(v) => setArchived(v === 'archived')}
        options={[
          { value: 'active', label: 'Notes' },
          { value: 'archived', label: 'Archived' },
        ]}
        className="mb-3"
      />
      {(tags.length > 0 || tag) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {tag && (
            <button type="button" className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent-ink" onClick={() => setTag('')}>
              #{tag} ✕
            </button>
          )}
          {!tag &&
            tags.map((t) => (
              <button key={t} type="button" className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:text-ink" onClick={() => setTag(t)}>
                #{t}
              </button>
            ))}
        </div>
      )}
      {notes.isPending ? (
        <CardSkeleton />
      ) : notes.isError ? (
        <ErrorState error={notes.error} onRetry={() => void notes.refetch()} />
      ) : notes.data.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={q || tag ? 'No notes match' : archived ? 'No archived notes' : 'No notes yet'}
          action={
            !q && !tag && !archived ? (
              <Link to="/notes/write" className={buttonClasses('primary')}>
                Write a note
              </Link>
            ) : undefined
          }
        >
          {!q && !tag && !archived && 'Or tap the + button anywhere to jot one down.'}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {notes.data.map((n) => (
            <li key={n.id}>
              <Link to={`/notes/write/${n.id}`} className="card block hover:bg-surface">
                <span className="flex items-center gap-2 font-medium">
                  {n.pinned && <Pin className="h-4 w-4 text-clay-ink" aria-label="Pinned" />}
                  {n.title || preview(n.body, 60) || 'Untitled'}
                </span>
                {n.title && n.body && <span className="mt-1 line-clamp-2 block text-sm text-muted">{preview(n.body)}</span>}
                {n.tags.length > 0 && <span className="mt-1 block text-xs text-muted">{n.tags.map((t) => `#${t}`).join(' ')}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NoteEditor({ note, onCreated }: { note: NoteRow | null; onCreated: (id: string) => void }) {
  const profile = useLoadedProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const del = useDeleteNote();
  const tags = useTags();
  const [v, setV] = useState<NoteInput>({
    title: note?.title ?? '',
    body: note?.body ?? '',
    tags: note?.tags ?? [],
    pinned: note?.pinned ?? false,
    archived: note?.archived ?? false,
  });
  const [mode, setMode] = useState<'write' | 'preview'>(note ? 'preview' : 'write');
  const [status, setStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>(note ? 'saved' : 'idle');
  const [savedAt, setSavedAt] = useState(note?.updated_at ?? null);
  const latest = useRef({ id: note?.id, v });
  latest.current.v = v;
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const save = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (saving.current || !dirty.current) return;
    const { id, v: cur } = latest.current;
    if (!id && !cur.title?.trim() && !cur.body.trim()) return;
    if (!navigator.onLine) {
      setStatus('error');
      return;
    }
    saving.current = true;
    dirty.current = false;
    setStatus('saving');
    try {
      const row = await saveNote(id, { ...cur, title: cur.title?.trim() || null });
      if (!id) {
        latest.current.id = row.id;
        onCreated(row.id);
      }
      qc.setQueryData(noteKeys.one(row.id), row);
      void qc.invalidateQueries({ queryKey: noteKeys.all, predicate: (q) => q.queryKey[1] !== 'one' });
      setSavedAt(row.updated_at);
      setStatus(dirty.current ? 'pending' : 'saved');
    } catch (e) {
      dirty.current = true;
      setStatus('error');
      toast(errorMessage(e), 'error');
    } finally {
      saving.current = false;
      if (dirty.current) timer.current = window.setTimeout(() => void save(), 2000);
    }
  }, [onCreated, qc, toast]);

  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('online', save);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('online', save);
      void save();
    };
  }, [save]);

  const update = (patch: Partial<NoteInput>) => {
    setV((s) => {
      const next = { ...s, ...patch };
      latest.current.v = next;
      return next;
    });
    dirty.current = true;
    setStatus('pending');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), 2000);
  };

  return (
    <div className="space-y-4">
      <h1 className="sr-only">{note ? 'Note' : 'New note'}</h1>
      <div className="flex items-center justify-between gap-2">
        <Link to="/notes" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Notes
        </Link>
        <div className="flex items-center">
          <span className="mr-2 text-xs text-muted" aria-live="polite">
            {status === 'saving'
              ? 'Saving…'
              : status === 'pending'
                ? 'Unsaved changes…'
                : status === 'error'
                  ? navigator.onLine ? 'Couldn’t save' : 'Offline: not saved yet'
                  : status === 'saved' && savedAt
                    ? `Saved ${formatInTimeZone(new Date(savedAt), profile.time_zone, 'h:mm a')}`
                    : ''}
          </span>
          <IconButton label={v.pinned ? 'Unpin' : 'Pin'} onClick={() => update({ pinned: !v.pinned })}>
            {v.pinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
          </IconButton>
          <IconButton label={v.archived ? 'Unarchive' : 'Archive'} onClick={() => update({ archived: !v.archived })}>
            {v.archived ? <ArchiveRestore className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
          </IconButton>
          <IconButton
            label="Delete note"
            onClick={async () => {
              const id = latest.current.id;
              if (!id) {
                dirty.current = false;
                navigate('/notes');
                return;
              }
              if (!(await confirm({ title: 'Delete this note?', body: 'This can’t be undone.', confirmLabel: 'Delete', danger: true }))) return;
              dirty.current = false;
              window.clearTimeout(timer.current);
              del.mutate(id, { onSuccess: () => navigate('/notes'), onError: (e) => toast(errorMessage(e), 'error') });
            }}
          >
            <Trash2 className="h-5 w-5" />
          </IconButton>
        </div>
      </div>
      <input
        aria-label="Title"
        placeholder="Title"
        value={v.title ?? ''}
        maxLength={200}
        onChange={(e) => update({ title: e.target.value })}
        onBlur={() => void save()}
        className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-muted/60"
      />
      <div className="card p-0">
        <div className="flex justify-end border-b border-border px-2 py-1">
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
              aria-label="Note"
              value={v.body}
              onChange={(e) => update({ body: e.target.value })}
              onBlur={() => void save()}
              placeholder="Write in Markdown: **bold**, _italic_, - lists, ## headings, > quotes"
              rows={14}
              autoFocus={!note}
              className="editor-text min-h-[45vh]"
            />
          ) : v.body.trim() ? (
            <Markdown className="min-h-[30vh]">{v.body}</Markdown>
          ) : (
            <p className="min-h-[30vh] text-muted">Empty note.</p>
          )}
        </div>
      </div>
      <TagInput value={v.tags} onChange={(t) => update({ tags: t })} suggestions={tags.data ?? []} />
    </div>
  );
}

export function NoteEditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const created = useRef(new Set<string>());
  const session = useRef(location.key);
  if (!id) session.current = location.key;
  const own = id != null && created.current.has(id);
  const q = useNote(own ? undefined : id);
  const onCreated = useCallback(
    (newId: string) => {
      created.current.add(newId);
      navigate(`/notes/write/${newId}`, { replace: true });
    },
    [navigate],
  );

  if (!id || own) return <NoteEditor key={`new-${session.current}`} note={null} onCreated={onCreated} />;
  if (q.isPending) return <CardSkeleton lines={8} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <ErrorState error="This note doesn't exist any more." />;
  return <NoteEditor key={q.data.id} note={q.data} onCreated={onCreated} />;
}
