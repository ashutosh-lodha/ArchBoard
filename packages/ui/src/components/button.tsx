import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.ts';
import { Tooltip } from './overlay.tsx';
import { Kbd } from './feedback.tsx';

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium',
    'rounded-md transition-[background-color,border-color,color,box-shadow] duration-[var(--dur-1)]',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-on-accent shadow-e1 hover:bg-accent-hover',
        secondary:
          'border border-border-strong bg-surface text-text shadow-e1 hover:bg-surface-hover',
        ghost: 'text-text hover:bg-surface-hover',
        danger: 'bg-danger text-white shadow-e1 hover:bg-danger-hover dark:text-bg',
        pen: 'bg-pen-subtle text-pen border border-pen-strong/40 hover:bg-pen-strong/20',
        link: 'h-auto px-0 text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-7 px-2.5 text-sm',
        md: 'h-8 px-3 text-base',
        lg: 'h-10 px-4 text-md',
        /** Touch: 40px visual, ≥ 44px hit area via padding on coarse pointers. */
        touch: 'h-10 px-4 text-md pointer-coarse:min-h-11',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a <button> (e.g. a router link). */
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...(asChild ? {} : { type: props.type ?? 'button' })}
      {...props}
    >
      {/* Slot needs exactly one child, so asChild buttons render the child as-is. */}
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner /> : null}
          {children}
        </>
      )}
    </Comp>
  );
});

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="animate-spin" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-md text-text-muted',
    'transition-colors duration-[var(--dur-1)] hover:bg-surface-hover hover:text-text',
    'disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-accent-subtle aria-pressed:text-accent',
    '[&_svg]:shrink-0',
  ],
  {
    variants: {
      size: {
        sm: 'size-7 [&_svg]:size-4',
        md: 'size-8 [&_svg]:size-[18px]',
        touch: 'size-11 [&_svg]:size-5',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface IconButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>,
    VariantProps<typeof iconButtonVariants> {
  /** Required: icon-only buttons must have an accessible name (also used as the tooltip). */
  label: string;
  /** Keyboard shortcut shown in the tooltip, e.g. "⌘Z". */
  shortcut?: string;
  /** Explanation shown instead of the label when disabled ("Only the presenter can edit"). */
  disabledReason?: string;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}

/**
 * Icon-only button with a mandatory label, tooltip and optional shortcut hint. When disabled
 * with a reason, it stays focusable (aria-disabled) so the tooltip can explain why (UX §1).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    shortcut,
    disabledReason,
    tooltipSide = 'bottom',
    className,
    size,
    disabled,
    onClick,
    children,
    ...props
  },
  ref,
) {
  const softDisabled = Boolean(disabled && disabledReason);
  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        iconButtonVariants({ size }),
        softDisabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
        className,
      )}
      disabled={disabled && !softDisabled}
      aria-disabled={softDisabled || undefined}
      onClick={softDisabled ? (e) => e.preventDefault() : onClick}
      {...props}
    >
      {children}
    </button>
  );
  return (
    <Tooltip
      side={tooltipSide}
      content={
        <span className="flex items-center gap-2">
          {softDisabled ? disabledReason : label}
          {shortcut && !softDisabled ? <Kbd>{shortcut}</Kbd> : null}
        </span>
      }
    >
      {button}
    </Tooltip>
  );
});
