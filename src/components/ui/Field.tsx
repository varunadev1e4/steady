import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/utils/cn';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  hideLabel?: boolean;
}

function FieldShell({ id, label, error, hint, children, className, hideLabel }: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className={cn('label', hideLabel && 'sr-only')}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: ReactNode) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

interface Common {
  label: string;
  error?: string;
  hint?: ReactNode;
  wrapperClassName?: string;
  hideLabel?: boolean;
}

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & Common;

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className, wrapperClassName, hideLabel, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} className={wrapperClassName} hideLabel={hideLabel}>
      <input
        ref={ref}
        id={fieldId}
        className={cn('input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...rest}
      />
    </FieldShell>
  );
});

export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & Common;

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, id, className, wrapperClassName, hideLabel, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} className={wrapperClassName} hideLabel={hideLabel}>
      <textarea
        ref={ref}
        id={fieldId}
        className={cn('input min-h-24 resize-y', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...rest}
      />
    </FieldShell>
  );
});

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> &
  Common & { options: Array<{ value: string; label: string }> };

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, id, className, wrapperClassName, options, hideLabel, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} className={wrapperClassName} hideLabel={hideLabel}>
      <select
        ref={ref}
        id={fieldId}
        className={cn('input pr-8', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});
