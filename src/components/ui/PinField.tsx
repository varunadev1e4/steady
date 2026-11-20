import { forwardRef, useId, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface PinFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
}

/** A 6-digit numeric PIN input. Opens the number pad on phones and ignores non-digits. */
export const PinField = forwardRef<HTMLInputElement, PinFieldProps>(function PinField(
  { label, error, hideLabel, id, className, onChange, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange?.(e);
  };

  return (
    <div>
      <label htmlFor={fieldId} className={cn('label', hideLabel && 'sr-only')}>
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        className={cn('input text-center text-2xl font-medium tracking-[0.6em] placeholder:tracking-[0.6em] placeholder:text-muted/35', className)}
        placeholder="••••••"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        onChange={handleChange}
        {...rest}
      />
      {error && (
        <p id={`${fieldId}-error`} className="mt-1.5 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
