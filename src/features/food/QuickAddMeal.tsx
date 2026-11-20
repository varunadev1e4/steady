import { useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Chip, Segmented, Stepper } from '@/components/ui/Controls';
import { TextField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { useLoadedProfile } from '@/features/profile/queries';
import type { FoodRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';
import { mealFromFood } from './logic';
import { useAddMeal, useFoods, useSaveFood } from './queries';

function TagPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const tags = useLoadedProfile().meal_tags;
  return (
    <div>
      <p className="label">Tags</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Chip key={t} active={value.includes(t)} onClick={() => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])}>
            {t}
          </Chip>
        ))}
      </div>
    </div>
  );
}

const fmt = (n: number | null, unit: string) => (n == null ? '–' : `${n}${unit}`);

/** Log a meal in a few taps: pick a favourite/library food or type a custom one. */
export function QuickAddMeal({ open, onClose, day }: { open: boolean; onClose: () => void; day: ISODate }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add a meal">
      <QuickAddBody onClose={onClose} day={day} />
    </Sheet>
  );
}

function QuickAddBody({ onClose, day }: { onClose: () => void; day: ISODate }) {
  const profile = useLoadedProfile();
  const foods = useFoods();
  const add = useAddMeal();
  const saveFood = useSaveFood();
  const toast = useToast();
  const [mode, setMode] = useState<'library' | 'custom'>('library');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<FoodRow | null>(null);
  const [servings, setServings] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [custom, setCustom] = useState({ name: '', protein: '', calories: '', carbs: '', keep: false });
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo(
    () =>
      (foods.data ?? [])
        .filter((f) => !f.archived_at && (!q || f.name.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => Number(b.is_favourite) - Number(a.is_favourite) || a.name.localeCompare(b.name)),
    [foods.data, q],
  );

  const done = () => {
    toast('Meal added');
    onClose();
  };

  const addPicked = () => {
    if (!picked) return;
    add.mutate(
      { day, name: picked.name, food_id: picked.id, servings, tags, ...mealFromFood(picked, servings) },
      { onSuccess: done },
    );
  };

  const addCustom = async () => {
    const name = custom.name.trim();
    if (!name) return setErr('Give the meal a name.');
    const n = (s: string) => (s.trim() === '' ? null : Number(s));
    const protein = n(custom.protein);
    const calories = n(custom.calories);
    const carbs = n(custom.carbs);
    if ([protein, calories, carbs].some((v) => v != null && (Number.isNaN(v) || v < 0 || v > 5000))) {
      return setErr('Numbers must be between 0 and 5000.');
    }
    setErr(null);
    let foodId: string | null = null;
    if (custom.keep) {
      try {
        const f = await saveFood.mutateAsync({
          input: { name, serving: '1 serving', protein_g: protein, calories: calories == null ? null : Math.round(calories), carbs_g: carbs, is_favourite: true },
        });
        foodId = f.id;
      } catch (e) {
        return setErr(/duplicate|unique/i.test(errorMessage(e)) ? 'A food with that name is already in your library.' : errorMessage(e));
      }
    }
    add.mutate(
      { day, name, food_id: foodId, servings: 1, protein_g: protein, calories: calories == null ? null : Math.round(calories), carbs_g: carbs, tags },
      { onSuccess: done },
    );
  };

  return (
    <div className="space-y-4">
      <Segmented
        label="How to add"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setErr(null);
        }}
        options={[
          { value: 'library', label: 'My foods' },
          { value: 'custom', label: 'Something else' },
        ]}
      />
      {mode === 'library' ? (
        picked ? (
          <div className="space-y-4">
            <div className="rounded-input border border-border bg-surface p-3">
              <p className="font-medium">{picked.name}</p>
              <p className="text-sm text-muted">Per {picked.serving}</p>
            </div>
            <div>
              <p className="label">Servings</p>
              <Stepper label="Servings" value={servings} onChange={setServings} min={0.5} max={20} step={0.5} />
            </div>
            {(() => {
              const t = mealFromFood(picked, servings);
              return (
                <p className="text-sm text-muted">
                  Protein {fmt(t.protein_g, ' g')} · carbs {fmt(t.carbs_g, ' g')}
                  {profile.calories_enabled && ` · ${fmt(t.calories, ' kcal')}`}
                </p>
              );
            })()}
            <TagPicker value={tags} onChange={setTags} />
            {add.isError && <FormMessage tone="error">{errorMessage(add.error)}</FormMessage>}
            <div className="flex gap-2">
              <Button onClick={addPicked} loading={add.isPending}>
                Add meal
              </Button>
              <Button variant="ghost" onClick={() => setPicked(null)}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" aria-label="Search foods" placeholder="Search your foods" value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" autoFocus />
            </div>
            <ul className="max-h-[50dvh] divide-y divide-border overflow-y-auto">
              {list.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(f);
                      setServings(1);
                    }}
                    className="flex min-h-12 w-full items-center gap-2 py-2 text-left hover:text-accent-ink"
                  >
                    <Star className={cn('h-4 w-4 shrink-0', f.is_favourite ? 'fill-clay text-clay' : 'text-transparent')} aria-hidden />
                    <span className="flex-1">
                      {f.name}
                      <span className="block text-xs text-muted">{f.serving}</span>
                    </span>
                    <span className="text-sm text-muted">{fmt(f.protein_g == null ? null : Number(f.protein_g), ' g')}</span>
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="py-6 text-center text-muted">No foods match. Try “Something else”.</li>}
            </ul>
            <p className="mt-2 text-xs text-muted">Starter values are approximate. Edit them in your food library.</p>
          </div>
        )
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void addCustom();
          }}
        >
          <TextField label="What did you eat?" value={custom.name} maxLength={120} onChange={(e) => setCustom({ ...custom, name: e.target.value })} autoFocus />
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Protein g" inputMode="decimal" value={custom.protein} onChange={(e) => setCustom({ ...custom, protein: e.target.value.replace(/[^\d.]/g, '') })} />
            <TextField label="Carbs g" inputMode="decimal" value={custom.carbs} onChange={(e) => setCustom({ ...custom, carbs: e.target.value.replace(/[^\d.]/g, '') })} />
            {profile.calories_enabled && (
              <TextField label="kcal" inputMode="numeric" value={custom.calories} onChange={(e) => setCustom({ ...custom, calories: e.target.value.replace(/\D/g, '') })} />
            )}
          </div>
          <p className="-mt-2 text-xs text-muted">All optional. A rough guess is fine.</p>
          <TagPicker value={tags} onChange={setTags} />
          <label className="flex flex-row-reverse items-center justify-between gap-3 text-sm">
            <input type="checkbox" role="switch" className="switch" checked={custom.keep} onChange={(e) => setCustom({ ...custom, keep: e.target.checked })} />
            Save to my foods as a favourite
          </label>
          {(err || add.isError) && <FormMessage tone="error">{err ?? errorMessage(add.error)}</FormMessage>}
          <Button type="submit" loading={add.isPending || saveFood.isPending}>
            Add meal
          </Button>
        </form>
      )}
    </div>
  );
}
