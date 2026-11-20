import { useState } from 'react';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useDeleteFood, useFoods, useSaveFood, type FoodInput } from '@/features/food/queries';
import { useLoadedProfile } from '@/features/profile/queries';
import type { FoodRow } from '@/types/database';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/Field';
import { CardSkeleton, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

function FoodForm({ food, onDone }: { food: FoodRow | null; onDone: () => void }) {
  const profile = useLoadedProfile();
  const save = useSaveFood();
  const s = (n: number | null) => (n == null ? '' : String(Number(n)));
  const [v, setV] = useState({
    name: food?.name ?? '',
    serving: food?.serving ?? '1 serving',
    protein: s(food?.protein_g ?? null),
    calories: s(food?.calories ?? null),
    carbs: s(food?.carbs_g ?? null),
  });
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const n = (x: string) => (x.trim() === '' ? null : Number(x));
        if (!v.name.trim()) return setErr('Give the food a name.');
        const input: Partial<FoodInput> = {
          name: v.name.trim(),
          serving: v.serving.trim() || '1 serving',
          protein_g: n(v.protein),
          carbs_g: n(v.carbs),
          calories: v.calories.trim() === '' ? null : Math.round(Number(v.calories)),
        };
        if ([input.protein_g, input.carbs_g, input.calories].some((x) => x != null && (Number.isNaN(x) || x < 0 || x > 5000))) {
          return setErr('Numbers must be between 0 and 5000.');
        }
        setErr(null);
        save.mutate({ id: food?.id, input }, { onSuccess: onDone });
      }}
    >
      <TextField label="Name" value={v.name} maxLength={80} onChange={(e) => setV({ ...v, name: e.target.value })} />
      <TextField label="Serving" value={v.serving} maxLength={60} onChange={(e) => setV({ ...v, serving: e.target.value })} hint="e.g. 1 bowl (150 g)" />
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Protein g" inputMode="decimal" value={v.protein} onChange={(e) => setV({ ...v, protein: e.target.value.replace(/[^\d.]/g, '') })} />
        <TextField label="Carbs g" inputMode="decimal" value={v.carbs} onChange={(e) => setV({ ...v, carbs: e.target.value.replace(/[^\d.]/g, '') })} />
        <TextField label="kcal" inputMode="numeric" value={v.calories} onChange={(e) => setV({ ...v, calories: e.target.value.replace(/\D/g, '') })} hint={profile.calories_enabled ? undefined : 'Hidden elsewhere'} />
      </div>
      {(err || save.isError) && (
        <FormMessage tone="error">
          {err ?? (/duplicate|unique/i.test(errorMessage(save.error)) ? 'You already have a food with that name.' : errorMessage(save.error))}
        </FormMessage>
      )}
      <Button type="submit" loading={save.isPending}>
        Save food
      </Button>
    </form>
  );
}

export function FoodLibraryPage() {
  const foods = useFoods();
  const save = useSaveFood();
  const del = useDeleteFood();
  const confirm = useConfirm();
  const toast = useToast();
  const profile = useLoadedProfile();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<FoodRow | null | 'new'>(null);

  const list = (foods.data ?? [])
    .filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.is_favourite) - Number(a.is_favourite) || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="My foods"
        description="Starter values are approximate per serving. Edit anything to match what you eat."
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        }
      />
      <Sheet open={editing != null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New food' : 'Edit food'}>
        <FoodForm
          food={editing === 'new' ? null : editing}
          onDone={() => {
            toast('Food saved');
            setEditing(null);
          }}
        />
      </Sheet>
      <input type="search" aria-label="Search foods" placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} className="input mb-3" />
      {foods.isPending ? (
        <CardSkeleton />
      ) : foods.isError ? (
        <ErrorState error={foods.error} onRetry={() => void foods.refetch()} />
      ) : (
        <ul className="card divide-y divide-border py-1">
          {list.map((f) => (
            <li key={f.id} className="flex min-h-14 items-center gap-1 py-1">
              <IconButton
                label={f.is_favourite ? `Remove ${f.name} from favourites` : `Add ${f.name} to favourites`}
                onClick={() => save.mutate({ id: f.id, input: { is_favourite: !f.is_favourite } })}
              >
                <Star className={cn('h-5 w-5', f.is_favourite ? 'fill-clay text-clay' : '')} />
              </IconButton>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{f.name}</span>
                <span className="block text-xs text-muted">
                  {f.serving} · {f.protein_g == null ? '–' : Number(f.protein_g)} g protein · {f.carbs_g == null ? '–' : Number(f.carbs_g)} g carbs
                  {profile.calories_enabled && ` · ${f.calories ?? '–'} kcal`}
                  {f.is_starter && ' · approx.'}
                </span>
              </span>
              <IconButton label={`Edit ${f.name}`} onClick={() => setEditing(f)}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton
                label={`Delete ${f.name}`}
                onClick={async () => {
                  if (await confirm({ title: `Delete “${f.name}”?`, body: 'Meals you already logged keep their numbers.', confirmLabel: 'Delete', danger: true })) {
                    del.mutate(f.id, { onError: (e) => toast(errorMessage(e), 'error') });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </li>
          ))}
          {list.length === 0 && <li className="py-6 text-center text-muted">No foods match.</li>}
        </ul>
      )}
    </>
  );
}
