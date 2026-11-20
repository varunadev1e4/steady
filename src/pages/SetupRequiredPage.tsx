import { Logo } from '@/components/layout/Logo';

/** Shown instead of the app when the Supabase environment variables are missing. */
export function SetupRequiredPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <Logo />
      <h1 className="mt-8 text-2xl">Almost there: connect Supabase</h1>
      <p className="mt-2 text-muted">Steady needs your Supabase project's URL and public anon key.</p>
      <ol className="mt-6 list-decimal space-y-2 pl-5">
        <li>
          Copy <code className="rounded bg-panel px-1.5 py-0.5 text-sm">.env.example</code> to{' '}
          <code className="rounded bg-panel px-1.5 py-0.5 text-sm">.env.local</code>.
        </li>
        <li>
          Fill in <code className="rounded bg-panel px-1.5 py-0.5 text-sm">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-panel px-1.5 py-0.5 text-sm">VITE_SUPABASE_ANON_KEY</code> from Supabase →
          Project settings → API.
        </li>
        <li>Restart the dev server (or redeploy on Vercel after adding them there).</li>
      </ol>
      <p className="mt-6 text-sm text-muted">The README walks through every step.</p>
    </main>
  );
}
