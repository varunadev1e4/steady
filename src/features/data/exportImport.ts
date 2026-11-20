import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';
import { fetchAll, unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { Database, Json, JournalEntryRow, ProfileRow } from '@/types/database';
import { entryFileName, entryToMarkdown } from '@/features/journal/logic';
import { toCSV } from './csv';

type TableName = keyof Database['public']['Tables'];

/** Tables in dependency order (parents before children). Matches import_backup(). */
export const DATA_TABLES = [
  'exercises',
  'foods',
  'habits',
  'habit_completions',
  'check_ins',
  'journal_prompts',
  'journal_entries',
  'thought_records',
  'workout_templates',
  'template_exercises',
  'workouts',
  'workout_sets',
  'cardio_entries',
  'body_measurements',
  'meals',
  'people',
  'interactions',
  'follow_ups',
  'tasks',
  'notes',
  'weekly_reviews',
  'plan_enrollments',
  'health_readings',
  'goals',
  'medications',
  'medication_doses',
  'medication_notes',
  'activities',
  'assessments',
  'cravings',
] as const satisfies readonly TableName[];

export type DataTable = (typeof DATA_TABLES)[number];

export const MODULE_TABLES: Array<{ key: string; label: string; tables: DataTable[] }> = [
  { key: 'checkin', label: 'Check-ins', tables: ['check_ins'] },
  { key: 'habits', label: 'Habits', tables: ['habits', 'habit_completions'] },
  { key: 'journal', label: 'Journal', tables: ['journal_entries', 'thought_records', 'journal_prompts'] },
  { key: 'workouts', label: 'Workouts and body', tables: ['workouts', 'workout_sets', 'exercises', 'workout_templates', 'template_exercises', 'cardio_entries', 'body_measurements', 'plan_enrollments'] },
  { key: 'food', label: 'Food', tables: ['meals', 'foods'] },
  { key: 'people', label: 'People', tables: ['people', 'interactions', 'follow_ups'] },
  { key: 'tasks', label: 'Tasks', tables: ['tasks'] },
  { key: 'notes', label: 'Notes', tables: ['notes'] },
  { key: 'review', label: 'Weekly reviews', tables: ['weekly_reviews'] },
  { key: 'health', label: 'Health readings', tables: ['health_readings'] },
  { key: 'goals', label: 'Goals', tables: ['goals'] },
  { key: 'medications', label: 'Medications', tables: ['medications', 'medication_doses', 'medication_notes'] },
  { key: 'mind', label: 'Mood tools', tables: ['activities', 'assessments', 'cravings'] },
];

export interface SteadyExport {
  app: 'steady';
  version: 1;
  exported_at: string;
  profile: Partial<ProfileRow>;
  tables: Partial<Record<DataTable, Array<Record<string, unknown>>>>;
}

const strip = (row: Record<string, unknown>) => {
  // Generated search columns and owner ids aren't part of the portable data.
  const { search: _search, user_id: _user, ...rest } = row;
  return rest;
};

async function fetchTable(t: DataTable): Promise<Array<Record<string, unknown>>> {
  const rows = await fetchAll<Record<string, unknown>>((from, to) =>
    supabase.from(t).select('*').order('created_at').range(from, to) as unknown as PromiseLike<{
      data: Record<string, unknown>[] | null;
      error: null;
    }>,
  );
  return rows.map(strip);
}

export async function exportAll(): Promise<SteadyExport> {
  assertOnline();
  const profile = unwrap(await supabase.from('profiles').select('*').single());
  const tables: SteadyExport['tables'] = {};
  for (const t of DATA_TABLES) tables[t] = await fetchTable(t);
  return { app: 'steady', version: 1, exported_at: new Date().toISOString(), profile: strip(profile) as Partial<ProfileRow>, tables };
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function downloadJSON(): Promise<void> {
  const data = await exportAll();
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `steady-export-${stamp()}.json`);
}

export async function downloadModuleCSV(module: string): Promise<void> {
  assertOnline();
  const m = MODULE_TABLES.find((x) => x.key === module);
  if (!m) return;
  if (m.tables.length === 1) {
    const rows = await fetchTable(m.tables[0]);
    download(new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' }), `steady-${m.tables[0]}-${stamp()}.csv`);
    return;
  }
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const t of m.tables) zip.file(`${t}.csv`, toCSV(await fetchTable(t)));
  download(await zip.generateAsync({ type: 'blob' }), `steady-${m.key}-csv-${stamp()}.zip`);
}

export async function downloadJournalZip(): Promise<number> {
  assertOnline();
  const entries = (await fetchTable('journal_entries')) as unknown as JournalEntryRow[];
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const e of entries) zip.file(`journal/${e.day.slice(0, 4)}/${entryFileName(e)}`, entryToMarkdown(e));
  download(await zip.generateAsync({ type: 'blob' }), `steady-journal-${stamp()}.zip`);
  return entries.length;
}

/* -------------------------------------------------------------- import -- */

const uuid = z.string().uuid();
const row = z.object({ id: uuid }).passthrough();

export const importSchema = z.object({
  app: z.literal('steady', { errorMap: () => ({ message: 'This isn’t a Steady export file.' }) }),
  version: z.literal(1, { errorMap: () => ({ message: 'This export comes from an unsupported version of Steady.' }) }),
  exported_at: z.string(),
  profile: z.record(z.unknown()).optional(),
  tables: z
    .object(Object.fromEntries(DATA_TABLES.map((t) => [t, z.array(row).max(100_000).optional()])) as Record<DataTable, z.ZodOptional<z.ZodArray<typeof row>>>)
    .strict(),
});

export type ImportPreview = { exportedAt: string; counts: Array<{ table: DataTable; rows: number }>; data: z.infer<typeof importSchema> };

/** Parses and validates a file. Throws a readable Error when invalid. */
export async function readImportFile(file: File): Promise<ImportPreview> {
  if (file.size > 50 * 1024 * 1024) throw new Error('That file is larger than 50 MB.');
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  const parsed = importSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message);
  }
  const counts = DATA_TABLES.map((t) => ({ table: t, rows: parsed.data.tables[t]?.length ?? 0 })).filter((c) => c.rows > 0);
  return { exportedAt: parsed.data.exported_at, counts, data: parsed.data };
}

const PROFILE_FIELDS = [
  'display_name',
  'time_zone',
  'week_start',
  'units',
  'date_format',
  'theme',
  'disabled_modules',
  'protein_target_g',
  'water_target_glasses',
  'weekly_workout_target',
  'calories_enabled',
  'calorie_target',
  'overload_increment',
  'journal_lock_enabled',
  'meal_tags',
  'glucose_unit',
  'steps_target',
  'birthday',
  'height_cm',
  'sex',
  'activity_level',
] as const;

/** Writes everything in one database transaction. Rows already present (same id) are skipped. */
export async function runImport(preview: ImportPreview, includeSettings: boolean): Promise<Record<string, number>> {
  assertOnline();
  const result = unwrap(await supabase.rpc('import_backup', { p_data: preview.data.tables as unknown as Json }));
  if (includeSettings && preview.data.profile) {
    const patch: Partial<ProfileRow> = Object.fromEntries(PROFILE_FIELDS.filter((k) => k in preview.data.profile!).map((k) => [k, preview.data.profile![k]]));
    const userId = (await supabase.auth.getSession()).data.session?.user.id;
    if (userId && Object.keys(patch).length) unwrap(await supabase.from('profiles').update(patch).eq('user_id', userId));
  }
  return result;
}
