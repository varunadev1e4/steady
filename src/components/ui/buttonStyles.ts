import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Material 3 buttons (full pill shape):
 *  primary   = filled
 *  secondary = tonal (secondary container)
 *  ghost     = text
 *  danger    = filled error
 */
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-strong text-accent-fg hover:bg-accent-hover hover:shadow-soft',
  secondary: 'bg-accent-soft text-ink hover:bg-raised',
  ghost: 'text-accent-ink hover:bg-accent-soft/60',
  danger: 'bg-danger text-danger-fg hover:bg-danger/90 hover:shadow-soft',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 text-sm',
  md: 'min-h-11 px-6 text-[0.9375rem]',
  lg: 'min-h-14 px-7 text-base',
};

/** Button look, also used to style links as buttons. */
export const buttonClasses = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false) =>
  cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
    variants[variant],
    sizes[size],
    block && 'w-full',
  );
