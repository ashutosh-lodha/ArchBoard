import {
  addNode,
  autoName,
  connect,
  DEFAULT_COMPONENT_SIZE,
  DEFAULT_NOTE_SIZE,
  deleteElements,
  type DiagramDoc,
} from '@archboard/diagram-schema';
import type { IconEntry } from '@archboard/icons';
import {
  Button,
  IconButton,
  Kbd,
  Sheet,
  SheetContent,
  StatusPill,
  toast,
  undoToast,
  useTheme,
} from '@archboard/ui';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize, Minus, Plus, Redo2, StickyNote, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { BoardContext } from './context.ts';
import { nodeTypes } from './nodes.tsx';
import { ICON_DRAG_TYPE, Palette, pushRecent } from './palette.tsx';
import { project, type FlowNode, type Projection } from './projection.ts';
import { GENERIC_REGISTRY, loadRegistry, type LoadedRegistry } from './registry.ts';
import { LOCAL_ORIGIN, type BoardDoc } from './use-board-doc.ts';

const QUICK_STARTS = ['generic/load-balancer', 'generic/service', 'generic/sql-db'] as const;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Keep the Y.Doc projection in sync, coalescing bursts of changes into one render per frame. */
function useProjection(diagram: DiagramDoc): Projection {
  const [projection, setProjection] = useState<Projection>(() => project(diagram));
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setProjection((prev) => project(diagram, prev));
      });
    };
    diagram.nodes.observeDeep(schedule);
    diagram.edges.observeDeep(schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      diagram.nodes.unobserveDeep(schedule);
      diagram.edges.unobserveDeep(schedule);
    };
  }, [diagram]);
  return projection;
}

export function BoardEditor({ board }: { board: BoardDoc }) {
  return (
    <ReactFlowProvider>
      <Editor board={board} />
    </ReactFlowProvider>
  );
}

function Editor({ board }: { board: BoardDoc }) {
  const { diagram, undo } = board;
  const { resolved } = useTheme();
  const rf = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const knownIds = useRef(new Set<string>());
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isPhone = useMediaQuery('(max-width: 767px)');
  const isTouch = useMediaQuery('(pointer: coarse)');

  const [registry, setRegistry] = useState<LoadedRegistry>(GENERIC_REGISTRY);
  const [vendorLoading, setVendorLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    loadRegistry().then((r) => {
      if (!alive) return;
      setRegistry(r);
      setVendorLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const projection = useProjection(diagram);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const selectNext = useRef<string | null>(null);
  const revealRef = useRef<(position: { x: number; y: number }) => void>(() => undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Merge each new projection with local-only state: selection and React Flow's measurements.
  useEffect(() => {
    // Read the pending selection *now*: state updaters run later, after we clear the ref below.
    const pending = selectNext.current;
    const select = pending && projection.nodes.some((n) => n.id === pending) ? pending : null;
    if (select) {
      selectNext.current = null;
      const added = projection.nodes.find((n) => n.id === select);
      // Wait a frame so React Flow has the node, then make sure the user can see it.
      if (added && !added.parentId) requestAnimationFrame(() => revealRef.current(added.position));
    }
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return projection.nodes.map((n) => {
        const p = prevById.get(n.id);
        const selected = select ? n.id === select : (p?.selected ?? false);
        if (!p && !selected) return n;
        return { ...n, selected, ...(p?.measured ? { measured: p.measured } : {}) };
      });
    });
    setEdges((prev) => {
      const sel = new Set(prev.filter((e) => e.selected).map((e) => e.id));
      return projection.edges.map((e) => (sel.has(e.id) ? { ...e, selected: true } : e));
    });
    // Nodes that (re)appear — e.g. restored by undo — must be measured before React Flow shows
    // them and lets them be clicked. Ask for it explicitly once they're in the DOM.
    const appeared = projection.nodes.map((n) => n.id).filter((id) => !knownIds.current.has(id));
    knownIds.current = new Set(projection.nodes.map((n) => n.id));
    if (appeared.length) requestAnimationFrame(() => updateNodeInternals(appeared));
  }, [projection, updateNodeInternals]);

  // Fit the existing diagram into view once, when the stored board first loads.
  const fitted = useRef(false);
  useEffect(() => {
    if (!board.ready || fitted.current || nodes.length === 0) return;
    fitted.current = true;
    requestAnimationFrame(() => void rf.fitView({ padding: 0.2, maxZoom: 1 }));
  }, [board.ready, nodes.length, rf]);

  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  useEffect(() => {
    const update = () => setHistory({ canUndo: undo.canUndo(), canRedo: undo.canRedo() });
    undo.on('stack-item-added', update);
    undo.on('stack-item-popped', update);
    undo.on('stack-cleared', update);
    return () => {
      undo.off('stack-item-added', update);
      undo.off('stack-item-popped', update);
      undo.off('stack-cleared', update);
    };
  }, [undo]);

  const viewportCentre = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return rf.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }, [rf]);

  const labels = useCallback(
    () => [...diagram.nodes.values()].map((m) => String(m.get('label') ?? '')),
    [diagram],
  );

  /**
   * Where a click-added component goes: to the right of the single selected top-level node (so a
   * chain like LB → Service → DB builds left to right), otherwise the centre of the view. Either
   * way, addNode nudges it to the nearest free spot so nothing overlaps.
   */
  const clickTarget = useCallback(() => {
    const selected = rf.getNodes().filter((n) => n.selected);
    const only = selected.length === 1 ? selected[0] : undefined;
    if (only && !only.parentId) {
      const width = only.measured?.width ?? DEFAULT_COMPONENT_SIZE.width;
      const height = only.measured?.height ?? DEFAULT_COMPONENT_SIZE.height;
      return {
        x: only.position.x + width + 80 + DEFAULT_COMPONENT_SIZE.width / 2,
        y: only.position.y + height / 2,
      };
    }
    return viewportCentre();
  }, [rf, viewportCentre]);

  /** Add a component centred on `at` (flow coordinates). Click-adds avoid overlapping others. */
  const addComponent = useCallback(
    (entry: IconEntry, at?: { x: number; y: number }) => {
      const centre = at ?? clickTarget();
      // Generic blocks get readable numbered names; vendor icons keep the product name (Azure terms).
      const label = entry.provider === 'generic' ? autoName(entry.label, labels()) : entry.label;
      const id = addNode(
        diagram,
        { kind: 'component', iconId: entry.id, label, data: {} },
        {
          origin: LOCAL_ORIGIN,
          at: {
            x: centre.x - DEFAULT_COMPONENT_SIZE.width / 2,
            y: centre.y - DEFAULT_COMPONENT_SIZE.height / 2,
          },
          avoidOverlap: !at,
        },
      );
      selectNext.current = id;
      setPaletteOpen(false);
    },
    [clickTarget, diagram, labels],
  );

  /** Pan (without zooming) so a node that landed outside the visible canvas comes into view. */
  const revealIfOffscreen = useCallback(
    (position: { x: number; y: number }) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { width, height } = DEFAULT_COMPONENT_SIZE;
      const p = rf.flowToScreenPosition(position);
      const margin = 24;
      const off =
        p.x < rect.left + margin ||
        p.y < rect.top + margin ||
        p.x + width * rf.getZoom() > rect.right - margin ||
        p.y + height * rf.getZoom() > rect.bottom - 72; // keep clear of the toolbar
      if (off) {
        void rf.setCenter(position.x + width / 2, position.y + height / 2, {
          zoom: rf.getZoom(),
          duration: 250,
        });
      }
    },
    [rf],
  );
  useEffect(() => {
    revealRef.current = revealIfOffscreen;
  }, [revealIfOffscreen]);

  const addNote = useCallback(() => {
    const c = viewportCentre();
    const id = addNode(
      diagram,
      { kind: 'note', text: '', color: 'yellow', size: DEFAULT_NOTE_SIZE },
      {
        origin: LOCAL_ORIGIN,
        at: { x: c.x - DEFAULT_NOTE_SIZE.width / 2, y: c.y - DEFAULT_NOTE_SIZE.height / 2 },
      },
    );
    selectNext.current = id;
    setEditingId(id);
  }, [diagram, viewportCentre]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    // Removals go through deleteSelection so they're undoable; everything else is local view state.
    setNodes((nds) =>
      applyNodeChanges(
        changes.filter((c) => c.type !== 'remove'),
        nds,
      ),
    );
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) =>
      applyEdgeChanges(
        changes.filter((c) => c.type !== 'remove'),
        eds,
      ),
    );
  }, []);

  const onNodeDragStop = useCallback(
    (_e: unknown, _node: FlowNode, dragged: FlowNode[]) => {
      diagram.doc.transact(() => {
        for (const n of dragged)
          diagram.nodes
            .get(n.id)
            ?.set('position', { x: Math.round(n.position.x), y: Math.round(n.position.y) });
      }, LOCAL_ORIGIN);
    },
    [diagram],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const result = connect(
        diagram,
        {
          source: c.source,
          target: c.target,
          ...(c.sourceHandle ? { sourceHandle: c.sourceHandle as 'top' } : {}),
          ...(c.targetHandle ? { targetHandle: c.targetHandle as 'top' } : {}),
        },
        { origin: LOCAL_ORIGIN },
      );
      if (!result.ok && result.reason === 'duplicate') toast('Already connected');
    },
    [diagram],
  );

  /**
   * Delete the current selection as one undoable step, with an Undo toast. Used by the
   * Delete/Backspace keys (handled by us, not React Flow, whose key tracking can miss a key-up
   * when the focused node disappears and then ignore the next press).
   */
  const deleteSelection = useCallback(() => {
    {
      const ids = [
        ...rf
          .getNodes()
          .filter((n) => n.selected)
          .map((n) => n.id),
        ...rf
          .getEdges()
          .filter((e) => e.selected)
          .map((e) => e.id),
      ];
      if (ids.length === 0) return;
      const removed = deleteElements(diagram, ids, { origin: LOCAL_ORIGIN });
      const count = removed.nodes.length + removed.edges.length;
      // Tie the toast to *this* delete: its Undo only acts while the delete is still the latest
      // change, and the toast disappears once it's undone another way or something else changes.
      const item = undo.undoStack.at(-1);
      const isLatest = () => undo.undoStack.at(-1) === item;
      const toastId = undoToast(`Deleted ${count} item${count === 1 ? '' : 's'}`, () => {
        if (isLatest()) undo.undo();
      });
      const onStackChange = () => {
        if (isLatest()) return;
        toast.dismiss(toastId);
        stop();
      };
      const stop = () => {
        undo.off('stack-item-added', onStackChange);
        undo.off('stack-item-popped', onStackChange);
        clearTimeout(expiry);
      };
      const expiry = setTimeout(stop, 11_000);
      undo.on('stack-item-added', onStackChange);
      undo.on('stack-item-popped', onStackChange);
    }
  }, [diagram, rf, undo]);

  const onDrop = useCallback(
    (e: DragEvent) => {
      const iconId = e.dataTransfer.getData(ICON_DRAG_TYPE);
      const entry = iconId ? registry.byId.get(iconId) : undefined;
      if (!entry) return;
      e.preventDefault();
      pushRecent(entry.id);
      addComponent(entry, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [addComponent, registry, rf],
  );

  // Keyboard shortcuts (UX §6). Never fire while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo.undo();
      } else if ((mod && key === 'z' && e.shiftKey) || (mod && key === 'y')) {
        e.preventDefault();
        undo.redo();
      } else if (!mod && e.key === '/') {
        e.preventDefault();
        if (isDesktop) searchRef.current?.focus();
        else setPaletteOpen(true);
      } else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteSelection();
      } else if (!mod && key === 'n') {
        e.preventDefault();
        addNote();
      } else if (!mod && (e.key === 'Enter' || e.key === 'F2')) {
        const selected = rf.getNodes().filter((n) => n.selected);
        if (selected.length === 1 && selected[0]) {
          e.preventDefault();
          setEditingId(selected[0].id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addNote, deleteSelection, isDesktop, rf, undo]);

  const context = useMemo(
    () => ({ diagram, registry, editingId, setEditingId }),
    [diagram, registry, editingId],
  );
  const palette = (
    <Palette
      ref={searchRef}
      registry={registry}
      vendorLoading={vendorLoading}
      onAdd={(e) => addComponent(e)}
      className="h-full"
    />
  );
  const empty = board.ready && nodes.length === 0;

  return (
    <BoardContext.Provider value={context}>
      <div className="flex h-dvh flex-col bg-canvas">
        <BoardHeader diagram={diagram} saved={board.saved} persistent={board.persistent} />
        <div className="relative flex min-h-0 flex-1">
          {isDesktop ? (
            <aside
              aria-label="Components"
              className="w-[264px] shrink-0 border-r border-border bg-bg"
            >
              {palette}
            </aside>
          ) : null}

          <div
            ref={canvasRef}
            className="relative min-w-0 flex-1"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              connectionMode={ConnectionMode.Loose}
              deleteKeyCode={null}
              snapToGrid
              snapGrid={[8, 8]}
              minZoom={0.1}
              maxZoom={2.5}
              selectionOnDrag={!isTouch}
              panOnDrag={isTouch ? true : [1, 2]}
              panOnScroll={false}
              zoomOnDoubleClick={false}
              colorMode={resolved}
              defaultEdgeOptions={{ type: 'smoothstep' }}
              aria-label="Diagram canvas"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={16}
                size={1.25}
                color="var(--canvas-dot)"
              />
              {!isPhone ? (
                <MiniMap
                  pannable
                  zoomable
                  className="!rounded-lg !border !border-border !shadow-e2"
                />
              ) : null}
            </ReactFlow>

            {empty ? (
              <EmptyHint registry={registry} onAdd={(e) => addComponent(e)} isDesktop={isDesktop} />
            ) : null}

            <Toolbar
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              onUndo={() => undo.undo()}
              onRedo={() => undo.redo()}
              onNote={addNote}
              onZoomIn={() => void rf.zoomIn()}
              onZoomOut={() => void rf.zoomOut()}
              onFit={() => void rf.fitView({ padding: 0.2, maxZoom: 1, duration: 200 })}
            />

            {!isDesktop ? (
              <Button
                variant="primary"
                size="touch"
                className="absolute left-4 top-4 z-10 shadow-e2"
                onClick={() => setPaletteOpen(true)}
              >
                <Plus /> Add component
              </Button>
            ) : null}
          </div>
        </div>

        {!isDesktop ? (
          <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
            <SheetContent
              side={isPhone ? 'bottom' : 'left'}
              title="Add a component"
              className={isPhone ? 'h-[80dvh]' : ''}
            >
              <div className="-mx-4 h-full">{palette}</div>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
    </BoardContext.Provider>
  );
}

function BoardHeader({
  diagram,
  saved,
  persistent,
}: {
  diagram: DiagramDoc;
  saved: boolean;
  persistent: boolean;
}) {
  const [title, setTitle] = useState(() => String(diagram.meta.get('title') ?? 'Untitled board'));
  useEffect(() => {
    const sync = () => setTitle(String(diagram.meta.get('title') ?? 'Untitled board'));
    diagram.meta.observe(sync);
    sync();
    return () => diagram.meta.unobserve(sync);
  }, [diagram]);
  const commit = (value: string) => {
    const next = value.trim() || 'Untitled board';
    if (next !== diagram.meta.get('title'))
      diagram.doc.transact(() => diagram.meta.set('title', next), LOCAL_ORIGIN);
    setTitle(next);
  };
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-bg px-3">
      <Link
        to="/"
        className="flex shrink-0 items-center gap-2 rounded-md p-1 hover:bg-surface-hover"
        aria-label="ArchBoard home"
      >
        <img src="/favicon.svg" alt="" className="size-6" />
      </Link>
      <input
        aria-label="Board name"
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setTitle(String(diagram.meta.get('title') ?? 'Untitled board'));
            e.currentTarget.blur();
          }
        }}
        className="min-w-0 max-w-[40ch] flex-1 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-md font-semibold hover:border-border focus:border-accent focus:outline-none"
      />
      <div className="ml-auto flex items-center gap-2">
        {persistent ? (
          <StatusPill status={saved ? 'local' : 'saving'} />
        ) : (
          <span className="text-sm text-warning" role="status">
            This browser can't save boards — changes are lost on reload
          </span>
        )}
      </div>
    </header>
  );
}

function Toolbar(props: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNote: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Board tools"
      className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-e2"
    >
      <IconButton
        label="Undo"
        shortcut="Ctrl+Z"
        tooltipSide="top"
        disabled={!props.canUndo}
        disabledReason="Nothing to undo"
        onClick={props.onUndo}
      >
        <Undo2 />
      </IconButton>
      <IconButton
        label="Redo"
        shortcut="Ctrl+Shift+Z"
        tooltipSide="top"
        disabled={!props.canRedo}
        disabledReason="Nothing to redo"
        onClick={props.onRedo}
      >
        <Redo2 />
      </IconButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <IconButton label="Add sticky note" shortcut="N" tooltipSide="top" onClick={props.onNote}>
        <StickyNote />
      </IconButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <IconButton label="Zoom out" tooltipSide="top" onClick={props.onZoomOut}>
        <Minus />
      </IconButton>
      <IconButton label="Zoom in" tooltipSide="top" onClick={props.onZoomIn}>
        <Plus />
      </IconButton>
      <IconButton label="Zoom to fit" tooltipSide="top" onClick={props.onFit}>
        <Maximize />
      </IconButton>
    </div>
  );
}

function EmptyHint({
  registry,
  onAdd,
  isDesktop,
}: {
  registry: LoadedRegistry;
  onAdd: (e: IconEntry) => void;
  isDesktop: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center p-4">
      <div
        role="group"
        aria-labelledby="empty-hint-title"
        className="pointer-events-auto max-w-sm rounded-xl border border-border bg-surface/95 p-5 text-center shadow-e2 backdrop-blur"
      >
        <p id="empty-hint-title" className="text-md font-semibold">
          Start your design
        </p>
        <p className="mt-1 text-base text-text-muted">
          {isDesktop ? (
            <>
              Drag a component from the left, or press <Kbd>/</Kbd> to search.
            </>
          ) : (
            <>Tap “Add component”, or start with one of these:</>
          )}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {QUICK_STARTS.map((id) => {
            const entry = registry.byId.get(id);
            return entry ? (
              <Button key={id} size="sm" onClick={() => onAdd(entry)}>
                <Plus /> {entry.label}
              </Button>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}
