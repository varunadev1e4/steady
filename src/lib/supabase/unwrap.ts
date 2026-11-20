import type { PostgrestError } from '@supabase/supabase-js';

type Result = { data: unknown; error: PostgrestError | null };

/** Returns data or throws the Supabase error, so TanStack Query sees failures. */
export function unwrap<R extends Result>(res: R): NonNullable<R['data']> {
  if (res.error) throw res.error;
  return res.data as NonNullable<R['data']>;
}

/** Like unwrap, for `.maybeSingle()` where "no row" is a valid answer. */
export function unwrapMaybe<R extends Result>(res: R): R['data'] | null {
  if (res.error) throw res.error;
  return (res.data ?? null) as R['data'] | null;
}

/**
 * Fetches every row of a query, 1000 at a time (Supabase's default page
 * limit). `build` must return a fresh query each call.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const res = await build(from, from + page - 1);
    if (res.error) throw res.error;
    const rows = res.data ?? [];
    out.push(...rows);
    if (rows.length < page) return out;
  }
}
