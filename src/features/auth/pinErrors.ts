import { errorMessage } from '@/utils/errors';

/** Maps Supabase auth errors to plain PIN wording. */
export function pinErrorMessage(err: unknown): string {
  const msg = errorMessage(err);
  if (/invalid login credentials/i.test(msg)) return 'That PIN isn’t right.';
  if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Wait a few minutes and try again.';
  if (/email not confirmed/i.test(msg)) {
    return 'Supabase is still asking for email confirmation. See the README, section 4.';
  }
  if (/password should be|weak password|pwned/i.test(msg)) {
    return 'Supabase rejected this PIN. Check the password settings in README section 4, or pick a less common PIN.';
  }
  return msg;
}
