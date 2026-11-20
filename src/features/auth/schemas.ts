import { z } from 'zod';

export const emailSchema = z.string().trim().min(1, 'Enter your email').email('That email doesn’t look right');

/** Steady signs in with a 6-digit PIN (stored by Supabase as the account password). */
export const pinSchema = z.string().regex(/^\d{6}$/, 'Enter 6 digits');

export const loginSchema = z.object({
  email: emailSchema,
  pin: pinSchema,
});
export type LoginValues = z.infer<typeof loginSchema>;

export const setupSchema = z
  .object({
    displayName: z.string().trim().max(80, 'Keep it under 80 characters').optional(),
    email: emailSchema,
    pin: pinSchema,
    confirm: z.string(),
  })
  .refine((v) => v.pin === v.confirm, { path: ['confirm'], message: 'PINs don’t match' });
export type SetupValues = z.infer<typeof setupSchema>;

export const changePinSchema = z
  .object({ current: pinSchema, pin: pinSchema, confirm: z.string() })
  .refine((v) => v.pin === v.confirm, { path: ['confirm'], message: 'PINs don’t match' })
  .refine((v) => v.pin !== v.current, { path: ['pin'], message: 'Choose a PIN different from your current one' });
export type ChangePinValues = z.infer<typeof changePinSchema>;
