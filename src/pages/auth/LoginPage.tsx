import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase/client';
import { assertOnline } from '@/lib/online';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';
import { forgetEmail, getRememberedEmail, rememberEmail } from '@/features/auth/rememberedEmail';
import { pinErrorMessage } from '@/features/auth/pinErrors';
import { TextField } from '@/components/ui/Field';
import { PinField } from '@/components/ui/PinField';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/States';
import { PinPad } from '@/features/lock/PinPad';
import { AuthLayout } from './AuthLayout';

const FORGOT = 'Forgot your PIN? It can be reset from Supabase (README, section 4).';

export function LoginPage() {
  const remembered = getRememberedEmail();
  const [askEmail, setAskEmail] = useState(!remembered);
  const [formError, setFormError] = useState<string | null>(null);
  const [padPin, setPadPin] = useState('');
  const [padBusy, setPadBusy] = useState(false);
  const busy = useRef(false);
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: remembered ?? '', pin: '' },
  });

  const onSubmit = async ({ email, pin }: LoginValues) => {
    if (busy.current) return;
    busy.current = true;
    setFormError(null);
    try {
      assertOnline();
      const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
      if (error) throw error;
      rememberEmail(email);
      // RouteGuards redirect once the session arrives.
    } catch (err) {
      setFormError(pinErrorMessage(err));
      setValue('pin', '');
      setPadPin('');
      if (askEmail) setFocus('pin');
    } finally {
      busy.current = false;
    }
  };

  // With a remembered email, the PIN pad signs in as soon as the 6th digit is entered.
  const padSubmit = async (pin: string) => {
    setPadBusy(true);
    await onSubmit({ email: watch('email'), pin });
    setPadBusy(false);
  };

  const useDifferentEmail = () => {
    forgetEmail();
    setValue('email', '');
    setValue('pin', '');
    setPadPin('');
    setFormError(null);
    setAskEmail(true);
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={askEmail ? 'Sign in with your email and PIN.' : 'Enter your PIN to continue.'}
      footer={
        askEmail ? (
          <>
            First time here?{' '}
            <Link to="/setup" className="link">
              Set up Steady
            </Link>
          </>
        ) : undefined
      }
    >
      {askEmail ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <TextField label="Email" type="email" autoComplete="username" inputMode="email" error={errors.email?.message} {...register('email')} />
          <PinField label="PIN" autoComplete="current-password" error={errors.pin?.message} {...register('pin')} />
          {formError && <FormMessage tone="error">{formError}</FormMessage>}
          <Button type="submit" block size="lg" loading={isSubmitting}>
            Sign in
          </Button>
          <p className="text-center text-sm text-muted">{FORGOT}</p>
        </form>
      ) : (
        <div className="space-y-5">
          <p className="text-center text-sm text-muted">
            {watch('email')} ·{' '}
            <button type="button" className="link" onClick={useDifferentEmail}>
              Use a different email
            </button>
          </p>
          <PinPad value={padPin} onChange={setPadPin} onComplete={(p) => void padSubmit(p)} disabled={padBusy} />
          <p className="min-h-6 text-center text-sm" role="status" aria-live="polite">
            {padBusy ? <span className="text-muted">Signing in…</span> : formError ? <span className="text-danger">{formError}</span> : null}
          </p>
          <p className="text-center text-sm text-muted">{FORGOT}</p>
        </div>
      )}
    </AuthLayout>
  );
}
