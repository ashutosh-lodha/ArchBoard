import {
  Checkbox as CheckboxPrimitive,
  Label as LabelPrimitive,
  Select as SelectPrimitive,
  Slot,
  Switch as SwitchPrimitive,
  Tabs as TabsPrimitive,
  ToggleGroup as ToggleGroupPrimitive,
} from 'radix-ui';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../lib/cn.ts';

const fieldBase = [
  'w-full rounded-md border border-border-strong bg-surface text-text placeholder:text-text-faint',
  'transition-[border-color,box-shadow] duration-[var(--dur-1)]',
  'hover:border-text-faint focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
  'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-danger/20',
  // 16px on touch prevents iOS zoom-on-focus (UX §10.2).
  'pointer-coarse:text-md',
].join(' ');

export const Label = forwardRef<
  HTMLLabelElement,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn('text-sm font-medium text-text', className)}
      {...props}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(fieldBase, 'h-8 px-2.5 text-base pointer-coarse:h-11', className)}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, 'min-h-20 px-2.5 py-2 text-base', className)}
      {...props}
    />
  );
});

/**
 * Label + control + hint/error with correct aria wiring. The single child control receives
 * `id`, `aria-describedby` and `aria-invalid` automatically.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Slot.Root
        id={id}
        {...(error || hint ? { 'aria-describedby': `${id}-${error ? 'error' : 'hint'}` } : {})}
        {...(error ? { 'aria-invalid': true } : {})}
      >
        {children}
      </Slot.Root>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
  shortcutHint?: ReactNode;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { className, onClear, shortcutHint, value, ...props },
  ref,
) {
  const hasValue = typeof value === 'string' && value.length > 0;
  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-faint"
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        className={cn(
          fieldBase,
          'h-8 pl-8 pr-8 text-base pointer-coarse:h-11 [&::-webkit-search-cancel-button]:hidden',
        )}
        {...props}
      />
      {hasValue && onClear ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          className="absolute right-1 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-text-muted hover:bg-surface-hover"
        >
          <X className="size-3.5" />
        </button>
      ) : shortcutHint ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          {shortcutHint}
        </span>
      ) : null}
    </div>
  );
});

export const Switch = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-border-strong transition-colors',
        'data-[state=checked]:bg-accent disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-e1 transition-transform duration-[var(--dur-1)] data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
});

export const Checkbox = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-on-accent disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

// ---------------------------------------------------------------------------------------------
// SegmentedControl (single choice, e.g. Sync / Async)

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when label is an icon. */
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-8 items-center gap-0.5 rounded-md bg-bg-subtle p-0.5 pointer-coarse:h-11',
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroupPrimitive.Item
          key={o.value}
          value={o.value}
          {...(o.ariaLabel ? { 'aria-label': o.ariaLabel } : {})}
          className={cn(
            'inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2.5 text-sm font-medium text-text-muted',
            'hover:text-text data-[state=on]:bg-surface data-[state=on]:text-text data-[state=on]:shadow-e1 [&_svg]:size-4',
          )}
        >
          {o.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------------------------
// Select

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  id,
  className,
  placeholder,
}: {
  value: T | undefined;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode }[];
  ariaLabel?: string;
  id?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <SelectPrimitive.Root
      {...(value === undefined ? {} : { value })}
      onValueChange={(v) => onValueChange(v as T)}
    >
      <SelectPrimitive.Trigger
        {...(id ? { id } : {})}
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        className={cn(
          fieldBase,
          'inline-flex h-8 items-center justify-between gap-2 px-2.5 text-base pointer-coarse:h-11',
          className,
        )}
      >
        <SelectPrimitive.Value {...(placeholder ? { placeholder } : {})} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-surface-raised p-1 shadow-e2 animate-pop-in"
        >
          <SelectPrimitive.Viewport>
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="relative flex h-8 cursor-default select-none items-center rounded-md pl-7 pr-2 text-base outline-none data-[highlighted]:bg-surface-hover pointer-coarse:h-11"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex">
                  <Check className="size-4 text-accent" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------------------------
// Tabs

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex items-center gap-1 border-b border-border', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-base font-medium text-text-muted',
        'hover:text-text data-[state=active]:border-accent data-[state=active]:text-text pointer-coarse:h-11',
        className,
      )}
      {...props}
    />
  );
}
