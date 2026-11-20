import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { MUSCLE_LABELS } from './logic';
import { useExercises } from './queries';

/** Searchable exercise list in a sheet. */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  exclude = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
  exclude?: string[];
}) {
  const exercises = useExercises();
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      (exercises.data ?? [])
        .filter((e) => !e.archived_at && !exclude.includes(e.id))
        .filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.muscle_group.includes(q.toLowerCase())),
    [exercises.data, q, exclude],
  );
  return (
    <Sheet open={open} onClose={onClose} title="Add exercise">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          aria-label="Search exercises"
          placeholder="Search by name or muscle"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input pl-9"
          autoFocus
        />
      </div>
      {exercises.isPending ? (
        <p className="py-6 text-center text-muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="py-6 text-center text-muted">No exercises match. Add your own under Workouts → Exercises.</p>
      ) : (
        <ul className="max-h-[55dvh] divide-y divide-border overflow-y-auto">
          {list.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left hover:text-accent-ink"
                onClick={() => {
                  onPick(e.id);
                  onClose();
                }}
              >
                <span className="font-medium">{e.name}</span>
                <span className="text-sm text-muted">{MUSCLE_LABELS[e.muscle_group]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
