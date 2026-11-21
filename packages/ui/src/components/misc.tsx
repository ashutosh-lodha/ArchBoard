import { Avatar as AvatarPrimitive } from 'radix-ui';
import { Command as Cmdk } from 'cmdk';
import { PenLine, Search } from 'lucide-react';
import { Toaster as SonnerToaster, toast } from 'sonner';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../lib/cn.ts';
import { Dialog as DialogPrimitive } from 'radix-ui';

// ---------------------------------------------------------------------------------------------
// Presence colours: 8 colour-blind-distinguishable hues (Okabe–Ito derived), deterministic.

export const PRESENCE_COLOURS = [
  '#0072B2',
  '#D55E00',
  '#009E73',
  '#CC79A7',
  '#E69F00',
  '#56B4E9',
  '#6A4FE0',
  '#8A6E00',
] as const;

export function presenceColour(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PRESENCE_COLOURS[hash % PRESENCE_COLOURS.length] as string;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** White or near-black, whichever has the higher WCAG contrast on `hex`. */
export function readableTextOn(hex: string): string {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (luminance('#14171c') + 0.05);
  return onWhite >= onDark ? '#ffffff' : '#14171c';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

// ---------------------------------------------------------------------------------------------
// Avatar + AvatarStack

export interface AvatarProps {
  id: string;
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Show the amber pen badge (this person holds the pen). */
  hasPen?: boolean;
  className?: string;
}

const avatarSizes = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

export function Avatar({ id, name, src, size = 'md', hasPen, className }: AvatarProps) {
  const colour = presenceColour(id);
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <AvatarPrimitive.Root
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full ring-2 ring-bg',
          avatarSizes[size],
        )}
        style={{
          backgroundColor: colour,
          boxShadow: `0 0 0 2px var(--bg), 0 0 0 3.5px ${hasPen ? 'var(--pen-strong)' : colour}`,
        }}
      >
        {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" /> : null}
        <AvatarPrimitive.Fallback
          className="font-semibold"
          style={{ color: readableTextOn(colour) }}
        >
          {initials(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {hasPen ? (
        <span className="absolute -bottom-1 -right-1 inline-flex size-4 items-center justify-center rounded-full bg-pen-strong text-white ring-2 ring-bg">
          <PenLine className="size-2.5" aria-hidden="true" />
        </span>
      ) : null}
      <span className="sr-only">
        {name}
        {hasPen ? ' (has the pen)' : ''}
      </span>
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  penHolderId,
  className,
}: {
  people: ReadonlyArray<{ id: string; name: string; src?: string | null }>;
  max?: number;
  penHolderId?: string | null;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div
      className={cn('flex items-center -space-x-1.5', className)}
      role="group"
      aria-label={`${people.length} people on this board`}
    >
      {shown.map((p) => (
        <Avatar
          key={p.id}
          id={p.id}
          name={p.name}
          src={p.src ?? null}
          size="sm"
          hasPen={p.id === penHolderId}
        />
      ))}
      {extra > 0 ? (
        <span className="relative inline-flex size-6 items-center justify-center rounded-full bg-bg-subtle text-[10px] font-semibold text-text-muted ring-2 ring-bg">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Toasts (sonner), themed with our tokens. Bottom-centre on desktop, top on phones (UX §8).

export function Toaster({
  theme = 'system',
  bottomOffset = 24,
}: {
  theme?: 'light' | 'dark' | 'system';
  /** Lift toasts above floating toolbars (the board passes ~72px). */
  bottomOffset?: number;
}) {
  return (
    <SonnerToaster
      theme={theme}
      position="bottom-center"
      offset={{ bottom: bottomOffset }}
      mobileOffset={{ top: 12 }}
      visibleToasts={3}
      gap={8}
      toastOptions={{
        duration: 4000,
        // Unstyled: our token classes below are the only styles, so both themes match the app.
        unstyled: true,
        classNames: {
          toast:
            'group flex w-[min(380px,calc(100vw-32px))] items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-base text-text shadow-e2',
          title: 'flex-1',
          description: 'text-text-muted',
          actionButton:
            'rounded-md px-2 py-1 font-semibold text-accent hover:bg-accent-subtle focus-visible:outline-2',
          cancelButton: 'rounded-md px-2 py-1 text-text-muted hover:bg-surface-hover',
          error: 'border-danger/40',
        },
      }}
    />
  );
}

export { toast };

/** "Deleted 3 items · Undo" — 10 s, per UX §8. */
export function undoToast(message: string, onUndo: () => void): string | number {
  return toast(message, { duration: 10_000, action: { label: 'Undo', onClick: onUndo } });
}

// ---------------------------------------------------------------------------------------------
// Command palette (cmdk)

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  shortcut?: string;
  keywords?: string[];
  disabled?: boolean;
  /** Shown instead of running when disabled ("Only the presenter can edit"). */
  disabledReason?: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = 'Type a command or search…',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: readonly CommandItem[];
  placeholder?: string;
}) {
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-e3 animate-pop-in"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Cmdk loop className="flex max-h-[60vh] flex-col" label="Command palette">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-text-faint" aria-hidden="true" />
              <Cmdk.Input
                placeholder={placeholder}
                className="h-12 flex-1 bg-transparent text-md outline-none placeholder:text-text-faint"
              />
            </div>
            <Cmdk.List className="overflow-y-auto p-1.5">
              <Cmdk.Empty className="px-3 py-8 text-center text-text-muted">
                No matching commands.
              </Cmdk.Empty>
              {groups.map((group) => (
                <Cmdk.Group
                  key={group}
                  heading={group}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-text-faint"
                >
                  {items
                    .filter((i) => i.group === group)
                    .map((item) => (
                      <Cmdk.Item
                        key={item.id}
                        value={`${item.group} ${item.label}`}
                        keywords={item.keywords ?? []}
                        disabled={item.disabled ?? false}
                        onSelect={() => {
                          onOpenChange(false);
                          item.run();
                        }}
                        className="flex h-9 cursor-default items-center gap-2.5 rounded-md px-2 text-base data-[disabled=true]:opacity-50 data-[selected=true]:bg-surface-hover [&_svg]:size-4 [&_svg]:text-text-muted pointer-coarse:h-11"
                      >
                        {item.icon}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.disabled && item.disabledReason ? (
                          <span className="text-sm text-text-faint">{item.disabledReason}</span>
                        ) : item.shortcut ? (
                          <span className="text-sm text-text-faint">{item.shortcut}</span>
                        ) : null}
                      </Cmdk.Item>
                    ))}
                </Cmdk.Group>
              ))}
            </Cmdk.List>
          </Cmdk>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export type CommandPaletteProps = ComponentPropsWithoutRef<typeof CommandPalette>;
