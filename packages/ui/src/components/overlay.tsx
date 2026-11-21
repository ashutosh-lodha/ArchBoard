import {
  AlertDialog as AlertDialogPrimitive,
  ContextMenu as ContextMenuPrimitive,
  Dialog as DialogPrimitive,
  DropdownMenu as DropdownPrimitive,
  Popover as PopoverPrimitive,
  Tooltip as TooltipPrimitive,
} from 'radix-ui';
import { Check, ChevronRight, X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';
import { cn } from '../lib/cn.ts';

const floatingSurface =
  'z-50 rounded-lg border border-border bg-surface-raised text-text shadow-e2 outline-none animate-pop-in';

// ---------------------------------------------------------------------------------------------
// Tooltip

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

/** Wrap any focusable element. Needs a TooltipProvider near the app root. */
export function Tooltip({ content, children, side = 'top', delayDuration }: TooltipProps) {
  return (
    <TooltipPrimitive.Root {...(delayDuration === undefined ? {} : { delayDuration })}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-[60] max-w-64 rounded-md bg-text px-2 py-1 text-sm text-bg shadow-e2 animate-fade-in"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------------------------
// Popover

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(floatingSurface, 'w-72 p-3', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

// ---------------------------------------------------------------------------------------------
// Menu item styles shared by DropdownMenu and ContextMenu

const menuItem = [
  'relative flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-base outline-none',
  'data-[highlighted]:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  '[&_svg]:size-4 [&_svg]:text-text-muted pointer-coarse:h-11',
].join(' ');

function Shortcut({ children }: { children?: ReactNode }) {
  return children ? <span className="ml-auto pl-4 text-sm text-text-faint">{children}</span> : null;
}

// ---------------------------------------------------------------------------------------------
// DropdownMenu

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuSub = DropdownPrimitive.Sub;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(floatingSurface, 'min-w-48 p-1', className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  shortcut,
  destructive,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & {
  shortcut?: string;
  destructive?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      className={cn(menuItem, destructive && 'text-danger [&_svg]:text-danger', className)}
      {...props}
    >
      {props.children}
      <Shortcut>{shortcut}</Shortcut>
    </DropdownPrimitive.Item>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.CheckboxItem>) {
  return (
    <DropdownPrimitive.CheckboxItem className={cn(menuItem, 'pl-8', className)} {...props}>
      <DropdownPrimitive.ItemIndicator className="absolute left-2 inline-flex">
        <Check />
      </DropdownPrimitive.ItemIndicator>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn('px-2 py-1.5 text-xs font-medium text-text-faint', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.SubTrigger>) {
  return (
    <DropdownPrimitive.SubTrigger
      className={cn(menuItem, 'data-[state=open]:bg-surface-hover', className)}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" />
    </DropdownPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.SubContent>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.SubContent
        className={cn(floatingSurface, 'min-w-44 p-1', className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

// ---------------------------------------------------------------------------------------------
// ContextMenu (right-click / long-press)

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

export function ContextMenuContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        collisionPadding={8}
        className={cn(floatingSurface, 'min-w-52 p-1', className)}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

export function ContextMenuItem({
  className,
  shortcut,
  destructive,
  ...props
}: ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
  shortcut?: string;
  destructive?: boolean;
}) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(menuItem, destructive && 'text-danger [&_svg]:text-danger', className)}
      {...props}
    >
      {props.children}
      <Shortcut>{shortcut}</Shortcut>
    </ContextMenuPrimitive.Item>
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Dialog

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

function Overlay() {
  return <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />;
}

export interface DialogContentProps extends Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  'title'
> {
  title: ReactNode;
  description?: ReactNode;
  /** Hide the visible title (it is still announced to screen readers). */
  hideTitle?: boolean;
  footer?: ReactNode;
}

export function DialogContent({
  className,
  title,
  description,
  hideTitle,
  footer,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,720px)] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col',
          'rounded-xl border border-border bg-surface-raised shadow-e3 outline-none animate-pop-in',
          className,
        )}
        {...(description ? {} : { 'aria-describedby': undefined })}
        {...props}
      >
        <div className={cn('flex items-start gap-4 px-5 pt-5', hideTitle && 'sr-only')}>
          <div className="min-w-0 flex-1 space-y-1">
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-base text-text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
        ) : null}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-hover hover:text-text"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ---------------------------------------------------------------------------------------------
// AlertDialog (destructive confirmation)

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-raised p-5 shadow-e3 animate-pop-in">
          <AlertDialogPrimitive.Title className="text-lg font-semibold">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-1 text-base text-text-muted">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel className="inline-flex h-8 items-center rounded-md border border-border-strong bg-surface px-3 font-medium hover:bg-surface-hover">
              {cancelLabel}
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              onClick={onConfirm}
              className={cn(
                'inline-flex h-8 items-center rounded-md px-3 font-medium shadow-e1',
                destructive
                  ? 'bg-danger text-white hover:bg-danger-hover dark:text-bg'
                  : 'bg-accent text-on-accent hover:bg-accent-hover',
              )}
            >
              {confirmLabel}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------------------------
// Sheet: side drawer (tablet panels) or bottom sheet (phone)

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;

export interface SheetContentProps extends Omit<
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  'title'
> {
  side?: 'left' | 'right' | 'bottom';
  title: ReactNode;
  hideTitle?: boolean;
}

export function SheetContent({
  side = 'right',
  title,
  hideTitle,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          'fixed z-50 flex flex-col bg-surface-raised shadow-e3 outline-none',
          side === 'right' &&
            'inset-y-0 right-0 w-[min(360px,90vw)] border-l border-border animate-slide-in-right',
          side === 'left' &&
            'inset-y-0 left-0 w-[min(320px,90vw)] border-r border-border animate-slide-in-left',
          side === 'bottom' &&
            'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl border-t border-border pb-[env(safe-area-inset-bottom)] animate-slide-in-bottom',
          className,
        )}
        {...props}
      >
        {side === 'bottom' ? (
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong" aria-hidden="true" />
        ) : null}
        <div
          className={cn(
            'flex items-center justify-between gap-2 px-4 pt-3 pb-2',
            hideTitle && 'sr-only',
          )}
        >
          <DialogPrimitive.Title className="text-md font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close"
            className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface-hover hover:text-text"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
