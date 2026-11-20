import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase/client';
import { assertOnline } from '@/lib/online';
import { PinField } from '@/components/ui/PinField';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/States';
import { useUser } from './authContext';
import { changePinSchema, type ChangePinValues } from './schemas';
import { pinErrorMessage } from './pinErrors';

export function ChangePinForm() {
  const user = useUser();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePinValues>({ resolver: zodResolver(changePinSchema) });

  const onSubmit = async ({ current, pin }: ChangePinValues) => {
    setFormError(null);
    setSaved(false);
    try {
      assertOnline();
      // Confirm the current PIN first, so an unlocked phone isn't enough to change it.
      const check = await supabase.auth.signInWithPassword({ email: user.email!, password: current });
      if (check.error) {
        setFormError(/invalid login credentials/i.test(check.error.message)
          ? 'Your current PIN isn’t right.'
          : pinErrorMessage(check.error));
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: pin });
      if (error) throw error;
      reset();
      setSaved(true);
    } catch (err) {
      setFormError(pinErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Lets password managers pair the PIN with the account. */}
      <input type="email" name="username" autoComplete="username" value={user.email ?? ''} readOnly hidden />
      <PinField label="Current PIN" autoComplete="current-password" error={errors.current?.message} {...register('current')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <PinField label="New PIN" autoComplete="new-password" error={errors.pin?.message} {...register('pin')} />
        <PinField
          label="Confirm new PIN"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
      </div>
      {formError && <FormMessage tone="error">{formError}</FormMessage>}
      {saved && <FormMessage tone="success">Your PIN has been changed.</FormMessage>}
      <Button type="submit" loading={isSubmitting}>
        Change PIN
      </Button>
    </form>
  );
}
