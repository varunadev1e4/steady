import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase/client';
import { assertOnline } from '@/lib/online';
import { setupSchema, type SetupValues } from '@/features/auth/schemas';
import { rememberEmail } from '@/features/auth/rememberedEmail';
import { pinErrorMessage } from '@/features/auth/pinErrors';
import { TextField } from '@/components/ui/Field';
import { PinField } from '@/components/ui/PinField';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/States';
import { browserTimeZone } from '@/utils/dates';
import { AuthLayout } from './AuthLayout';

/** One-time account creation: email (as your username) plus a 6-digit PIN. */
export function SetupPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupValues>({ resolver: zodResolver(setupSchema) });

  const onSubmit = async (values: SetupValues) => {
    setFormError(null);
    try {
      assertOnline();
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.pin,
        options: {
          // Read by the database sign-up trigger to create the profile.
          data: { display_name: values.displayName || null, time_zone: browserTimeZone() },
        },
      });
      if (error) throw error;
      if (!data.session) {
        setFormError(
          'The account was created, but Supabase still requires email confirmation. Turn off "Confirm email" ' +
            '(README, section 4), delete this user in Authentication → Users, then set up again.',
        );
        return;
      }
      rememberEmail(values.email);
      // RouteGuards redirect to Today once the session arrives.
    } catch (err) {
      const msg = pinErrorMessage(err);
      setFormError(
        /already registered|already exists/i.test(msg)
          ? 'An account already exists for this email. Sign in with your PIN instead.'
          : /signups not allowed|signup is disabled/i.test(msg)
            ? 'New accounts are switched off for this Steady. Sign in instead.'
            : msg,
      );
    }
  };

  return (
    <AuthLayout
      title="Set up Steady"
      subtitle="Steady is private. Only you can see what you write here."
      footer={
        <>
          Already set up?{' '}
          <Link to="/login" className="link">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <TextField
          label="What should we call you? (optional)"
          autoComplete="given-name"
          error={errors.displayName?.message}
          {...register('displayName')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          inputMode="email"
          hint="Used as your username only. Steady never sends you email."
          error={errors.email?.message}
          {...register('email')}
        />
        <PinField label="Choose a 6-digit PIN" autoComplete="new-password" error={errors.pin?.message} {...register('pin')} />
        <PinField label="Confirm PIN" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        {formError && <FormMessage tone="error">{formError}</FormMessage>}
        <Button type="submit" block size="lg" loading={isSubmitting}>
          Create my account
        </Button>
      </form>
    </AuthLayout>
  );
}
