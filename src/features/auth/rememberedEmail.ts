// The account email is remembered on this device so sign-in only needs the PIN.
const KEY = 'steady-email';

export function getRememberedEmail(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberEmail(email: string): void {
  try {
    localStorage.setItem(KEY, email.trim().toLowerCase());
  } catch {
    // Storage unavailable (private mode): the email is just asked for again next time.
  }
}

export function forgetEmail(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
