/** Turns any thrown value (Supabase, network, Zod…) into a short, human sentence. */
export function errorMessage(err: unknown): string {
  if (!err) return 'Something went wrong.';
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return friendly(err.message);
  if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return friendly(err.message);
  }
  return 'Something went wrong.';
}

function friendly(message: string): string {
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return message;
}
