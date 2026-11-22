import { GENERIC_ICONS } from '@archboard/icons';
import {
  Avatar,
  AvatarStack,
  Badge,
  Banner,
  Button,
  Checkbox,
  CommandPalette,
  ConfirmDialog,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  Kbd,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchField,
  SegmentedControl,
  Select,
  Sheet,
  SheetContent,
  SheetTrigger,
  Skeleton,
  Spinner,
  StatusPill,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  Tooltip,
  undoToast,
  useTheme,
  type CommandItem,
  type SaveStatus,
} from '@archboard/ui';
import {
  Copy,
  Grid3x3,
  LayoutTemplate,
  Maximize,
  Moon,
  MousePointer2,
  PenLine,
  Redo2,
  Search,
  Share2,
  StickyNote,
  Sun,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';

/**
 * Design-system gallery (dev only): every core component in light and dark, used for visual
 * regression screenshots and the axe check.
 */
export default function GalleryPage() {
  const { resolved, setPreference } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commands: CommandItem[] = [
    {
      id: 'undo',
      group: 'Edit',
      label: 'Undo',
      shortcut: '⌘Z',
      icon: <Undo2 />,
      run: () => toast('Undid last change'),
    },
    {
      id: 'redo',
      group: 'Edit',
      label: 'Redo',
      shortcut: '⌘⇧Z',
      icon: <Redo2 />,
      run: () => toast('Redid change'),
    },
    {
      id: 'note',
      group: 'Insert',
      label: 'Add sticky note',
      shortcut: 'N',
      icon: <StickyNote />,
      disabled: true,
      disabledReason: 'Only the presenter can edit',
      run: () => undefined,
    },
    {
      id: 'fit',
      group: 'View',
      label: 'Zoom to fit',
      shortcut: '⇧1',
      icon: <Maximize />,
      run: () => toast('Zoomed to fit'),
    },
    {
      id: 'theme',
      group: 'View',
      label: 'Toggle dark mode',
      icon: <Moon />,
      run: () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
    },
  ];

  return (
    <div className="min-h-dvh bg-bg-subtle">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-bg/90 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/favicon.svg" alt="" className="size-6 shrink-0" />
          <h1 className="truncate text-md font-semibold">ArchBoard design system</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex"
            onClick={() => setPaletteOpen(true)}
          >
            Command palette <Kbd>⌘K</Kbd>
          </Button>
          <IconButton
            label="Command palette"
            className="sm:hidden"
            onClick={() => setPaletteOpen(true)}
          >
            <Search />
          </IconButton>
          <IconButton
            label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')}
          >
            {resolved === 'dark' ? <Sun /> : <Moon />}
          </IconButton>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-6 p-4 lg:grid-cols-2 lg:p-6">
        <ThemePanel theme="light">
          <Showcase />
        </ThemePanel>
        <ThemePanel theme="dark">
          <Showcase />
        </ThemePanel>
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={commands} />
    </div>
  );
}

function ThemePanel({ theme, children }: { theme: 'light' | 'dark'; children: ReactNode }) {
  return (
    <section
      data-theme={theme}
      aria-label={`${theme === 'light' ? 'Light' : 'Dark'} theme`}
      className="min-w-0 rounded-xl border border-border bg-bg p-5 text-text shadow-e1"
    >
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-text-muted">
        {theme} theme
      </p>
      {children}
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <h2 className="mb-3 text-sm font-semibold text-text-muted">{title}</h2>
      {children}
    </div>
  );
}

/** A few vendor icons to eyeball SVG optimisation (needs `pnpm icons:import`). */
const PROVIDER_SAMPLE = [
  ['aws/elastic-load-balancing', 'Elastic Load Balancing', 'AWS'],
  ['aws/amazon-simple-storage-service', 'Amazon S3', 'AWS'],
  ['aws/aws-lambda', 'AWS Lambda', 'AWS'],
  ['aws/amazon-dynamodb', 'Amazon DynamoDB', 'AWS'],
  ['azure/load-balancers', 'Load Balancers', 'Azure'],
  ['azure/kubernetes-services', 'Kubernetes Services', 'Azure'],
  ['azure/virtual-machine', 'Virtual Machine', 'Azure'],
  ['azure/storage-accounts', 'Storage Accounts', 'Azure'],
] as const;

const SWATCHES = [
  'bg',
  'bg-subtle',
  'canvas',
  'surface',
  'border',
  'border-strong',
  'text',
  'text-muted',
  'accent',
  'accent-subtle',
  'pen',
  'pen-subtle',
  'success',
  'warning',
  'danger',
  'guide',
] as const;

function Showcase() {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [edgeStyle, setEdgeStyle] = useState<'sync' | 'async'>('sync');
  const [protocol, setProtocol] = useState<string | undefined>('http');
  const [snap, setSnap] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [minimap, setMinimap] = useState(true);
  const people = [
    { id: 'u_ashutosh', name: 'Ashutosh Lodha' },
    { id: 'g_priya', name: 'Priya Raman' },
    { id: 'g_mei', name: 'Mei Chen' },
    { id: 'u_sam', name: 'Sam Okafor' },
    { id: 'g_lee', name: 'Lee Park' },
    { id: 'g_ana', name: 'Ana Souza' },
  ];

  return (
    <div>
      <Section title="Colour tokens">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {SWATCHES.map((s) => (
            <div key={s} className="space-y-1">
              <div
                className="h-10 rounded-md border border-border"
                style={{ background: `var(--${s})` }}
              />
              <p className="truncate text-xs text-text-muted">{s}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale">
        <div className="space-y-1">
          <p className="text-2xl font-semibold">Dashboard 32</p>
          <p className="text-xl font-semibold">Page title 24</p>
          <p className="text-lg font-semibold">Dialog title 20</p>
          <p className="text-md font-medium">Panel title 16</p>
          <p className="text-base">Body text 14: the default for UI.</p>
          <p className="text-sm text-text-muted">Secondary 13: node labels, captions.</p>
          <p className="text-xs text-text-muted">Badge 12</p>
          <p className="font-mono text-sm tabular">34.7K QPS · 3.65 TB/yr</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Start a board</Button>
          <Button>Copy link</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete board</Button>
          <Button variant="pen">
            <PenLine /> Request pen
          </Button>
          <Button variant="link">Browse templates</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="touch">Touch</Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Icon buttons and toolbar">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-e2">
          <IconButton label="Undo" shortcut="⌘Z">
            <Undo2 />
          </IconButton>
          <IconButton label="Redo" shortcut="⌘⇧Z" disabled disabledReason="Nothing to redo">
            <Redo2 />
          </IconButton>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <IconButton label="Select" shortcut="V" aria-pressed="true">
            <MousePointer2 />
          </IconButton>
          <IconButton
            label="Add sticky note"
            shortcut="N"
            disabled
            disabledReason="Only the presenter can edit"
          >
            <StickyNote />
          </IconButton>
          <IconButton
            label="Snap to grid"
            shortcut="⇧S"
            aria-pressed={snap}
            onClick={() => setSnap((s) => !s)}
          >
            <Grid3x3 />
          </IconButton>
          <IconButton label="Zoom to fit" shortcut="⇧1">
            <Maximize />
          </IconButton>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`label-${useId()}`} label="Label" hint="Shown on the canvas.">
            <Input defaultValue="URL service" />
          </Field>
          <Field id={`replicas-${useId()}`} label="Replicas" error="Must be between 1 and 10,000.">
            <Input defaultValue="0" inputMode="numeric" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Edge style</span>
            <SegmentedControl
              ariaLabel="Edge style"
              value={edgeStyle}
              onValueChange={setEdgeStyle}
              options={[
                { value: 'sync', label: 'Sync' },
                { value: 'async', label: 'Async' },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Protocol</span>
            <Select
              ariaLabel="Protocol"
              value={protocol}
              onValueChange={setProtocol}
              options={[
                { value: 'http', label: 'HTTP' },
                { value: 'grpc', label: 'gRPC' },
                { value: 'websocket', label: 'WebSocket' },
                { value: 'tcp', label: 'TCP' },
                { value: 'pubsub', label: 'Pub/Sub' },
              ]}
            />
          </div>
          <SearchField
            aria-label="Search components"
            placeholder="Search components"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery('')}
            shortcutHint={<Kbd>/</Kbd>}
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-base">
              <Switch checked={snap} onCheckedChange={setSnap} /> Snap to grid
            </label>
            <label className="flex items-center gap-2 text-base">
              <Checkbox defaultChecked /> Done
            </label>
          </div>
          <Textarea
            aria-label="Notes"
            placeholder="Notes about this component…"
            className="sm:col-span-2"
          />
        </div>
      </Section>

      <Section title="Feedback">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Generic</Badge>
          <Badge tone="accent">AWS</Badge>
          <Badge tone="pen">Presenting</Badge>
          <Badge tone="success">Saved</Badge>
          <Badge tone="warning">Offline</Badge>
          <Badge tone="danger">Failed</Badge>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
          <Spinner />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['saved', 'saving', 'offline', 'error', 'local'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className="rounded-full">
              <StatusPill status={s} className={status === s ? 'bg-surface-hover' : ''} />
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <Banner
            tone="offline"
            title="Offline — changes will sync when you reconnect"
            action={<Button size="sm">Retry now</Button>}
          />
          <Banner tone="danger" title="Couldn't save — retrying…">
            Your changes are kept on this device.
          </Banner>
          <Banner tone="info">Sign in to save to your account and share.</Banner>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="size-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <EmptyState
          className="mt-2"
          icon={<LayoutTemplate />}
          title="No boards yet"
          description="Start from a blank canvas or a template like URL shortener."
          action={<Button variant="primary">New board</Button>}
        />
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Share2 /> Share dialog
              </Button>
            </DialogTrigger>
            <DialogContent
              title='Share "Rate limiter"'
              description="Anyone with the link can join as a viewer who can request the pen."
              footer={<Button variant="primary">Done</Button>}
            >
              <div className="flex gap-2">
                <Input
                  readOnly
                  value="https://archboard.ashutoshdev.online/join/k3J8x…"
                  aria-label="Share link"
                />
                <Button onClick={() => toast('Link copied')}>
                  <Copy /> Copy link
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            <Trash2 /> Confirm dialog
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Discard offline changes?"
            description="Your last 4 changes weren't applied because Priya has the pen. This can't be undone."
            confirmLabel="Discard changes"
            onConfirm={() => toast('Discarded')}
          />
          <Sheet>
            <SheetTrigger asChild>
              <Button>Side drawer</Button>
            </SheetTrigger>
            <SheetContent side="right" title="Properties">
              <p className="text-text-muted">Tablet panels open as drawers.</p>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button>Bottom sheet</Button>
            </SheetTrigger>
            <SheetContent side="bottom" title="Comments">
              <p className="text-text-muted">Phone panels open as bottom sheets.</p>
            </SheetContent>
          </Sheet>
          <Popover>
            <PopoverTrigger asChild>
              <Button>Popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p className="font-medium">Priya wants the pen</p>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="ghost">
                  Not now
                </Button>
                <Button size="sm" variant="primary">
                  Give pen
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Board</DropdownMenuLabel>
              <DropdownMenuItem shortcut="⌘D">
                <Copy /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem checked={minimap} onCheckedChange={setMinimap}>
                Show minimap
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>
                <Trash2 /> Delete board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip content="Tooltips show the shortcut">
            <Button>Tooltip</Button>
          </Tooltip>
          <Button onClick={() => undoToast('Deleted 3 items', () => toast('Restored 3 items'))}>
            Undo toast
          </Button>
        </div>
        <ContextMenu>
          <ContextMenuTrigger className="mt-3 flex h-20 items-center justify-center rounded-lg border border-dashed border-border-strong text-text-muted">
            Right-click or long-press here
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem shortcut="Enter">Rename</ContextMenuItem>
            <ContextMenuItem shortcut="⌘D">Duplicate</ContextMenuItem>
            <ContextMenuItem shortcut="G">Group</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem destructive shortcut="Del">
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </Section>

      <Section title="Presence">
        <div className="flex flex-wrap items-center gap-4">
          <AvatarStack people={people} penHolderId="g_priya" />
          <Avatar id="u_ashutosh" name="Ashutosh Lodha" size="lg" hasPen />
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-pen-subtle px-2.5 text-sm font-medium text-pen">
            <PenLine className="size-3.5" aria-hidden="true" /> Priya has the pen
          </span>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="image">
          <TabsList>
            <TabsTrigger value="image">Image</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>
          <TabsContent value="image" className="pt-3 text-text-muted">
            PNG or SVG, transparent background, 1×–3× scale.
          </TabsContent>
          <TabsContent value="data" className="pt-3 text-text-muted">
            JSON in the DiagramV1 format.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Provider icons (sample)">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
          {PROVIDER_SAMPLE.map(([id, label, provider]) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg border border-border-strong bg-surface p-2 shadow-e1"
            >
              <img src={`/icons/${id}.svg`} alt="" className="size-8 shrink-0" loading="lazy" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{label}</span>
                <span className="block text-xs text-text-muted">{provider}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Generic components">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
          {GENERIC_ICONS.map((icon) => (
            <li
              key={icon.slug}
              className="flex items-center gap-2 rounded-lg border border-border-strong bg-surface p-2 shadow-e1"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5"
                  aria-hidden="true"
                  // Trusted, static markup from our own icon set.
                  dangerouslySetInnerHTML={{ __html: icon.body }}
                />
              </span>
              <span className="truncate text-sm font-medium">{icon.label}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
