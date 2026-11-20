import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Library, Plus, Trash2, Utensils } from 'lucide-react';
import { useDeleteMeal, useMealsForDay, useMealsRange } from '@/features/food/queries';
import { cleanEating, dayTotals, proteinSummary } from '@/features/food/logic';
import { QuickAddMeal } from '@/features/food/QuickAddMeal';
import { useCheckIn, useCheckInRange, useSetWater } from '@/features/checkin/queries';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { ProgressBar, Stepper } from '@/components/ui/Controls';
import { IconButton, StatTile } from '@/components/ui/Layout';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { addDaysISO, longDayLabel, parseISODate } from '@/utils/dates';
import { BarSeries, ChartCard } from '@/components/charts/Charts';
import { errorMessage } from '@/utils/errors';

export function WaterCard({ day }: { day: string }) {
  const profile = useLoadedProfile();
  const checkIn = useCheckIn(day);
  const setWater = useSetWater();
  const toast = useToast();
  const glasses = checkIn.data?.water_glasses ?? 0;
  const target = profile.water_target_glasses;
  return (
    <section className="card" aria-labelledby="water-h">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="water-h" className="text-base">
            Water
          </h2>
          <p className="text-sm text-muted">{target ? `${glasses} of ${target} glasses` : `${glasses} ${glasses === 1 ? 'glass' : 'glasses'}`}</p>
        </div>
        {checkIn.isError ? (
          <Button size="sm" variant="secondary" onClick={() => void checkIn.refetch()}>
            Retry
          </Button>
        ) : (
          <Stepper
            label="Glasses of water"
            value={glasses}
            disabled={checkIn.isPending}
            max={40}
            onChange={(v) => setWater.mutate({ day, glasses: v }, { onError: (e) => toast(errorMessage(e), 'error') })}
          />
        )}
      </div>
      {target != null && (
        <div className="mt-3">
          <ProgressBar value={glasses} max={target} label="Water towards your target" />
        </div>
      )}
    </section>
  );
}

export function FoodPage() {
  const { today } = useToday();
  const profile = useLoadedProfile();
  const [day, setDay] = useState(today);
  const [adding, setAdding] = useState(false);
  const meals = useMealsForDay(day);
  const del = useDeleteMeal();
  const toast = useToast();
  const range = useMealsRange(addDaysISO(today, -29), today);
  const checks30 = useCheckInRange(addDaysISO(today, -29), today);

  const totals = dayTotals(meals.data ?? []);
  const target = profile.protein_target_g;

  const from7 = addDaysISO(today, -6);
  const last7 = (range.data ?? []).filter((m) => m.day >= from7);
  const clean7 = cleanEating(last7);
  const clean30 = cleanEating(range.data ?? []);
  const byDay = new Map<string, number>();
  for (const m of last7) byDay.set(m.day, (byDay.get(m.day) ?? 0) + Number(m.protein_g ?? 0));
  const protein7 = proteinSummary([...byDay].map(([d, p]) => ({ day: d, protein: p })), target);
  const waterDays = (checks30.data ?? []).filter((c) => c.day >= from7 && c.water_glasses > 0);
  const waterAvg = waterDays.length ? Math.round((waterDays.reduce((s, c) => s + c.water_glasses, 0) / waterDays.length) * 10) / 10 : null;

  const daily = useMemo(() => {
    const protein = new Map<string, number>();
    for (const m of range.data ?? []) protein.set(m.day, (protein.get(m.day) ?? 0) + Number(m.protein_g ?? 0));
    const water = new Map((checks30.data ?? []).map((c) => [c.day, c.water_glasses]));
    const p: Array<{ x: string; y: number | null }> = [];
    const w: Array<{ x: string; y: number | null }> = [];
    for (let d = addDaysISO(today, -29); d <= today; d = addDaysISO(d, 1)) {
      const x = format(parseISODate(d), 'd MMM');
      p.push({ x, y: protein.has(d) ? Math.round(protein.get(d)!) : null });
      w.push({ x, y: water.get(d) ? water.get(d)! : null });
    }
    return { p, w, pDays: protein.size, wDays: [...water.values()].filter((v) => v > 0).length };
  }, [range.data, checks30.data, today]);

  return (
    <>
      <PageHeader
        title="Food and water"
        actions={
          <Link to="/food/library" className={buttonClasses('ghost', 'sm')}>
            <Library className="h-4 w-4" aria-hidden />
            My foods
          </Link>
        }
      />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <IconButton label="Previous day" onClick={() => setDay(addDaysISO(day, -1))}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <p className="font-medium">{day === today ? 'Today' : longDayLabel(day)}</p>
          <IconButton label="Next day" disabled={day >= today} onClick={() => setDay(addDaysISO(day, 1))}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </div>

        <section className="card space-y-3" aria-label="Totals">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base">Protein</h2>
            <span className="tabular-nums">
              {totals.protein} g{target ? <span className="text-muted"> of {target} g</span> : null}
            </span>
          </div>
          {target != null && <ProgressBar value={totals.protein} max={target} label="Protein towards your target" />}
          <p className="text-sm text-muted">
            Carbs {totals.carbs} g{profile.calories_enabled && ` · ${totals.calories} kcal${profile.calorie_target ? ` (your target ${profile.calorie_target})` : ''}`}
          </p>
        </section>

        <WaterCard day={day} />

        <section aria-labelledby="meals-h" className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 id="meals-h" className="text-base">
              Meals
            </h2>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add meal
            </Button>
          </div>
          <QuickAddMeal open={adding} onClose={() => setAdding(false)} day={day} />
          {meals.isPending ? (
            <CardSkeleton />
          ) : meals.isError ? (
            <ErrorState error={meals.error} onRetry={() => void meals.refetch()} />
          ) : meals.data.length === 0 ? (
            <EmptyState icon={Utensils} title="Nothing logged yet" action={<Button onClick={() => setAdding(true)}>Add a meal</Button>}>
              Pick from your foods or type anything. Numbers are optional.
            </EmptyState>
          ) : (
            <ul className="card divide-y divide-border py-1">
              {meals.data.map((m) => (
                <li key={m.id} className="flex min-h-12 items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <span className="font-medium">
                      {m.name}
                      {Number(m.servings) !== 1 && <span className="text-muted"> ×{Number(m.servings)}</span>}
                    </span>
                    <span className="block text-sm text-muted">
                      {[m.protein_g != null ? `${Number(m.protein_g)} g protein` : null, profile.calories_enabled && m.calories != null ? `${m.calories} kcal` : null, ...m.tags]
                        .filter(Boolean)
                        .join(' · ') || 'No details'}
                    </span>
                  </span>
                  <IconButton label={`Delete ${m.name}`} onClick={() => del.mutate(m.id, { onError: (e) => toast(errorMessage(e), 'error') })}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-3" aria-labelledby="week-food">
          <h2 id="week-food" className="text-base">
            Last 7 days
          </h2>
          {range.isError ? (
            <ErrorState error={range.error} onRetry={() => void range.refetch()} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Average protein" value={protein7.avg == null ? '–' : `${protein7.avg} g`} hint={`${protein7.daysLogged} days logged`} />
              <StatTile
                label="Protein target met"
                value={protein7.daysMet == null ? '–' : `${protein7.daysMet} days`}
                hint={target ? `target ${target} g` : 'no target set'}
              />
              <StatTile label="Average water" value={waterAvg == null ? '–' : `${waterAvg}`} hint="glasses on days logged" />
              <StatTile
                label="Home-cooked / whole food"
                value={clean7.percent == null ? '–' : `${clean7.percent}%`}
                hint={`30 days: ${clean30.percent == null ? '–' : `${clean30.percent}%`}`}
              />
            </div>
          )}
          <p className="text-xs text-muted">The home-cooked share is based only on how you tagged your meals.</p>
          <Link to="/mind/cravings" className="link text-sm">
            Craving something? Try the 10-minute wait
          </Link>
        </section>

        <ChartCard title="Protein per day (g)" caption="Last 30 days" empty={daily.pDays < 2} emptyText="Log meals on two or more days to see a chart.">
          <BarSeries data={daily.p} label="Protein per day, last 30 days" format={(v) => `${v} g`} target={target} interval="preserveStartEnd" />
        </ChartCard>
        <ChartCard title="Water per day (glasses)" caption="Last 30 days" empty={daily.wDays < 2} emptyText="Log water on two or more days to see a chart.">
          <BarSeries data={daily.w} label="Water per day, last 30 days" format={(v) => `${v} glasses`} target={profile.water_target_glasses} tone="second" interval="preserveStartEnd" />
        </ChartCard>
      </div>
    </>
  );
}
