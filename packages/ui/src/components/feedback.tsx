import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, CloudOff, Info, Loader2, XCircle } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

// ---------------------------------------------------------------------------------------------
// Badge

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-bg-subtle text-text-muted border border-border',
        accent: 'bg-accent-subtle text-accent',
        pen: 'bg-pen-subtle text-pen',
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning',
        danger: 'bg-danger-subtle text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

// ---------------------------------------------------------------------------------------------
// Kbd

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-bg-subtle px-1',
        'font-sans text-xs font-medium text-text-muted',
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Skeleton

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-md bg-[linear-gradient(90deg,var(--bg-subtle)_25%,var(--surface-hover)_50%,var(--bg-subtle)_75%)]',
        'bg-[length:200%_100%] animate-shimmer motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center text-text-muted', className)}>
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Banner: page- or panel-level message (offline, errors, info)

const bannerVariants = cva('flex items-start gap-3 rounded-lg border px-3 py-2.5 text-base', {
  variants: {
    tone: {
      info: 'border-accent/30 bg-accent-subtle text-text',
      success: 'border-success/30 bg-success-subtle text-text',
      warning: 'border-warning/30 bg-warning-subtle text-text',
      danger: 'border-danger/30 bg-danger-subtle text-text',
      offline: 'border-warning/30 bg-warning-subtle text-text',
    },
  },
  defaultVariants: { tone: 'info' },
});

const bannerIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  offline: CloudOff,
} as const;

const bannerIconColour = {
  info: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  offline: 'text-warning',
} as const;

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: keyof typeof bannerIcons;
  title?: ReactNode;
  action?: ReactNode;
}

export function Banner({
  tone = 'info',
  title,
  action,
  className,
  children,
  ...props
}: BannerProps) {
  const Icon = bannerIcons[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(bannerVariants({ tone }), className)}
      {...props}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', bannerIconColour[tone])} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-text-muted">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// StatusPill: the always-visible save status (UX §8)

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error' | 'local';

const statusCopy: Record<SaveStatus, { label: string; dot: string; text: string }> = {
  saved: { label: 'Saved', dot: 'bg-success', text: 'text-text-muted' },
  saving: {
    label: 'Saving…',
    dot: 'bg-text-faint animate-pulse motion-reduce:animate-none',
    text: 'text-text-muted',
  },
  offline: { label: 'Offline — changes will sync', dot: 'bg-warning', text: 'text-warning' },
  error: { label: "Couldn't save — retrying…", dot: 'bg-danger', text: 'text-danger' },
  local: { label: 'Saved on this device', dot: 'bg-success', text: 'text-text-muted' },
};

export function StatusPill({ status, className }: { status: SaveStatus; className?: string }) {
  const s = statusCopy[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-sm',
        s.text,
        className,
      )}
    >
      <span className={cn('size-2 rounded-full', s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// EmptyState

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Use 1 when the empty state is the whole page (404, error), so the page has an h1. */
  headingLevel?: 1 | 2 | 3;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  headingLevel = 3,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={cn(
        'mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-10 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-xl bg-bg-subtle text-text-muted [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <Heading className="text-md font-semibold text-text">{title}</Heading>
        {description ? <p className="text-base text-text-muted">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
