// Applies every migration, the RLS isolation tests and the seed file to an
// in-memory Postgres (PGlite) with a small Supabase auth shim.
// It is a fast local safety net; it does not replace running the migrations
// on your real Supabase project.
//
//   npm run db:verify
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const db = new PGlite();
const notices = [];
const run = async (label, sql) => {
  try {
    await db.exec(sql, {
      onNotice: (n) => {
        // Skip PGlite's internal debug chatter; keep notices our SQL raises.
        if (!/rehashing|implicit index|^# \d+/.test(n.message)) notices.push(n.message);
      },
    });
    console.log(`  ok   ${label}`);
  } catch (err) {
    console.error(`  FAIL ${label}\n       ${err.message}`);
    if (err.where) console.error(`       where: ${err.where}`);
    process.exitCode = 1;
    throw err;
  }
};


try {
  console.log('Supabase shim');
  await run('scripts/db/supabase-shim.sql', read('scripts/db/supabase-shim.sql'));

  console.log('Migrations');
  const migrations = readdirSync(join(root, 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of migrations) await run(f, read(`supabase/migrations/${f}`));

  console.log('Tests');
  const tests = readdirSync(join(root, 'supabase/tests'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of tests) await run(f, read(`supabase/tests/${f}`));

  console.log('Seed (into a throwaway dev user)');
  await run(
    'create dev user',
    `insert into auth.users (email, raw_user_meta_data) values ('dev@steady.local', '{"time_zone":"Asia/Kolkata","display_name":"Dev"}');`,
  );
  await run('supabase/seed.sql', read('supabase/seed.sql'));

  if (notices.length) {
    console.log('\nNotices');
    for (const n of notices) console.log(`  ${n}`);
  }
  console.log('\nDatabase verification passed.');
} catch {
  if (notices.length) {
    console.log('\nNotices before failure');
    for (const n of notices) console.log(`  ${n}`);
  }
  console.error('\nDatabase verification FAILED.');
  process.exitCode = 1;
}
