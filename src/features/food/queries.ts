import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { FoodRow, MealRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';

export const foodKeys = {
  foods: ['foods'] as const,
  meals: ['meals'] as const,
  day: (day: ISODate) => ['meals', 'day', day] as const,
  range: (from: ISODate, to: ISODate) => ['meals', 'range', from, to] as const,
};

export function useFoods() {
  return useQuery({
    queryKey: foodKeys.foods,
    queryFn: async () => unwrap(await supabase.from('foods').select('*').order('name')),
    staleTime: 5 * 60_000,
  });
}

export type FoodInput = Pick<FoodRow, 'name' | 'serving' | 'protein_g' | 'calories' | 'carbs_g' | 'is_favourite'>;

export function useSaveFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: Partial<FoodInput> }) => {
      assertOnline();
      if (id) return unwrap(await supabase.from('foods').update(input).eq('id', id).select('*').single());
      return unwrap(await supabase.from('foods').insert(input as FoodInput).select('*').single());
    },
    onMutate: async ({ id, input }) => {
      // Optimistic for the favourite star.
      if (!id) return;
      await qc.cancelQueries({ queryKey: foodKeys.foods });
      const previous = qc.getQueryData<FoodRow[]>(foodKeys.foods);
      qc.setQueryData<FoodRow[]>(foodKeys.foods, (old) => old?.map((f) => (f.id === id ? { ...f, ...input } : f)));
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(foodKeys.foods, ctx.previous),
    onSettled: () => void qc.invalidateQueries({ queryKey: foodKeys.foods }),
  });
}

export function useDeleteFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('foods').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: foodKeys.foods }),
  });
}

export function useMealsForDay(day: ISODate) {
  return useQuery({
    queryKey: foodKeys.day(day),
    queryFn: async () => unwrap(await supabase.from('meals').select('*').eq('day', day).order('eaten_at')),
  });
}

export function useMealsRange(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: foodKeys.range(from, to),
    queryFn: async () =>
      unwrap(
        await supabase.from('meals').select('day, protein_g, calories, carbs_g, tags').gte('day', from).lte('day', to),
      ),
  });
}

export type MealInput = Pick<MealRow, 'day' | 'name' | 'food_id' | 'servings' | 'protein_g' | 'calories' | 'carbs_g' | 'tags'>;

export function useAddMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: MealInput) => {
      assertOnline();
      return unwrap(await supabase.from('meals').insert(m).select('*').single());
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: foodKeys.meals }),
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      unwrap(await supabase.from('meals').delete().eq('id', id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: foodKeys.meals }),
  });
}
