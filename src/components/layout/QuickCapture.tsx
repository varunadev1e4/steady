import { useCallback, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Droplet, Plus } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Segmented } from '@/components/ui/Controls';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { useSaveNote } from '@/features/notes/queries';
import { useSaveTask } from '@/features/tasks/queries';
import { useCheckIn, useSetWater } from '@/features/checkin/queries';
import { useModuleEnabled, useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import { errorMessage } from '@/utils/errors';
import { useAppEvent } from '@/lib/appEvents';
import { haptic } from '@/utils/haptics';

type Mode = 'note' | 'task' | 'water';
const KEY = 'steady-capture-mode';

/** Floating + button on phones (the rail has its own on computers): jot a note, add a task or log water from anywhere. */
export function QuickCapture() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('capture');
  const shortcutMode = requested === 'note' || requested === 'task' || requested === 'water' ? requested : null;
  const [open, setOpenState] = useState(shortcutMode != null);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    if (!v && requested) setParams({}, { replace: true });
  };
  const openNow = useCallback(() => setOpenState(true), []);
  useAppEvent('steady:capture', openNow);
  const notesOn = useModuleEnabled('notes');
  const tasksOn = useModuleEnabled('tasks');
  const { pathname } = useLocation();
  // Editors and the workout logger stay distraction-free.
  const focused = /^\/(journal\/write|notes\/write|workouts\/log|plans\/[^/]+\/session)/.test(pathname);
  if ((!notesOn && !tasksOn) || focused) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic();
          setOpen(true);
        }}
        aria-label="Quick capture: note, task or water"
        className={`fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent-container font-bold text-accent-on-container shadow-lift transition-all hover:brightness-95 active:scale-95 print:hidden md:hidden ${pathname === '/' ? 'px-5' : 'w-14'}`}
      >
        <Plus className="h-6 w-6" aria-hidden />
        {pathname === '/' && <span>Capture</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Quick capture">
        <CaptureBody onDone={() => setOpen(false)} notesOn={notesOn} tasksOn={tasksOn} initialMode={shortcutMode} />
      </Sheet>
    </>
  );
}

function CaptureBody({ onDone, notesOn, tasksOn, initialMode }: { onDone: () => void; notesOn: boolean; tasksOn: boolean; initialMode: Mode | null }) {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const toast = useToast();
  const options = [
    ...(notesOn ? [{ value: 'note' as const, label: 'Note' }] : []),
    ...(tasksOn ? [{ value: 'task' as const, label: 'Task' }] : []),
    { value: 'water' as const, label: 'Water' },
  ];
  const [mode, setModeState] = useState<Mode>(() => {
    if (initialMode && (initialMode === 'water' || options.some((o) => o.value === initialMode))) return initialMode;
    try {
      const m = localStorage.getItem(KEY) as Mode | null;
      if (m && options.some((o) => o.value === m)) return m;
    } catch {
      // ignore
    }
    return options[0].value;
  });
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      // ignore
    }
  };

  const saveNote = useSaveNote();
  const saveTask = useSaveTask();
  const checkIn = useCheckIn(today);
  const setWater = useSetWater();
  const [text, setText] = useState('');
  const [dueToday, setDueToday] = useState(true);
  const glasses = checkIn.data?.water_glasses ?? 0;

  const submitNote = () => {
    const t = text.trim();
    if (!t) return;
    const [first, ...rest] = t.split('\n');
    const title = rest.length ? first.slice(0, 200) : null;
    const body = rest.length ? rest.join('\n').trim() : t;
    saveNote.mutate(
      { input: { title, body } },
      {
        onSuccess: () => {
          toast('Note saved');
          onDone();
        },
      },
    );
  };

  const submitTask = () => {
    const t = text.trim();
    if (!t) return;
    saveTask.mutate(
      { input: { title: t.slice(0, 200), due_date: dueToday ? today : null } },
      {
        onSuccess: () => {
          toast('Task added');
          onDone();
        },
      },
    );
  };

  const error = saveNote.error ?? saveTask.error;

  return (
    <div className="space-y-4">
      <Segmented label="Capture" value={mode} onChange={setMode} options={options} />
      {mode === 'note' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitNote();
          }}
        >
          <TextAreaField label="Note" hideLabel rows={4} autoFocus placeholder="Jot it down. The first line becomes the title if you write more than one." value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" loading={saveNote.isPending} disabled={!text.trim()}>
            Save note
          </Button>
        </form>
      )}
      {mode === 'task' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitTask();
          }}
        >
          <TextField label="Task" hideLabel autoFocus placeholder="What needs doing?" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
          <label className="flex flex-row-reverse items-center justify-between gap-3 text-sm">
            <input type="checkbox" role="switch" className="switch" checked={dueToday} onChange={(e) => setDueToday(e.target.checked)} />
            Due today
          </label>
          <Button type="submit" loading={saveTask.isPending} disabled={!text.trim()}>
            Add task
          </Button>
        </form>
      )}
      {mode === 'water' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-muted">
            {glasses} {glasses === 1 ? 'glass' : 'glasses'} today
            {profile.water_target_glasses ? ` of ${profile.water_target_glasses}` : ''}
          </p>
          <Button
            size="lg"
            disabled={checkIn.isPending}
            onClick={() =>
              setWater.mutate(
                { day: today, glasses: Math.min(40, glasses + 1) },
                { onSuccess: () => toast('Water logged'), onError: (e) => toast(errorMessage(e), 'error') },
              )
            }
          >
            <Droplet className="h-5 w-5" aria-hidden />
            Add a glass
          </Button>
        </div>
      )}
      {error && mode !== 'water' && <FormMessage tone="error">{errorMessage(error)}</FormMessage>}
    </div>
  );
}
