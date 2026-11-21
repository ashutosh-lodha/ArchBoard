import {
  addNode,
  align,
  autoName,
  connect,
  DEFAULT_COMPONENT_SIZE,
  DEFAULT_NOTE_SIZE,
  deleteElements,
  distribute,
  GROUP_LABELS,
  groupNodes,
  reparent,
  ungroup,
  type AlignMode,
  type DiagramDoc,
  type GroupType,
  type InkColor,
  type ShapeKind,
} from '@archboard/diagram-schema';
import type { IconEntry } from '@archboard/icons';
import {
  Button,
  cn,
  IconButton,
  Kbd,
  SegmentedControl,
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
import {
  Circle,
  Cylinder,
  Diamond,
  Hexagon,
  Maximize,
  Minus,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Pencil,
  Plus,
  Redo2,
  RectangleHorizontal,
  SlidersHorizontal,
  Square,
  StickyNote,
  Type,
  Undo2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import { BoardContext } from './context.ts';
import { INK_COLOURS, nodeTypes } from './nodes.tsx';
import { GROUP_TYPES, PropertiesPanel, STROKE_OPTIONS } from './properties-panel.tsx';
import { ToolOverlay, type Tool, type ToolSettings } from './tool-overlay.tsx';
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
  // Only components added from the panel are revealed; things drawn on the canvas are already
  // where the user is looking.
  const revealNext = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false); // tablet/phone sheet
  const [leftOpen, setLeftOpen] = useState(true); // desktop panels, collapsible with [ and ]
  // On laptop widths both panels would squeeze the canvas, so properties start closed there.
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth >= 1280);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [toolSettings, setToolSettings] = useState<ToolSettings>({
    shape: 'rectangle',
    ink: 'ink',
    strokeWidth: 2.5,
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // The minimap only fits beside the toolbar on a wide enough canvas.
  const [canvasWidth, setCanvasWidth] = useState(1200);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setCanvasWidth(entry?.contentRect.width ?? 1200));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Merge each new projection with local-only state: selection and React Flow's measurements.
  useEffect(() => {
    // Read the pending selection *now*: state updaters run later, after we clear the ref below.
    const pending = selectNext.current;
    const select = pending && projection.nodes.some((n) => n.id === pending) ? pending : null;
    if (select) {
      selectNext.current = null;
      const added = projection.nodes.find((n) => n.id === select);
      // Wait a frame so React Flow has the node, then make sure the user can see it.
      if (added && !added.parentId && revealNext.current) {
        requestAnimationFrame(() => revealRef.current(added.position));
      }
      revealNext.current = false;
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

  // Fit the stored diagram into view once, on open — only if the board already had content.
  // (Adding the first item to an empty board must never move the view.)
  const fitted = useRef(false);
  useEffect(() => {
    if (!board.ready || fitted.current) return;
    fitted.current = true;
    if (diagram.nodes.size === 0) return;
    // Two frames: one for the projection to reach React Flow, one for it to measure the nodes.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => void rf.fitView({ padding: 0.2, maxZoom: 1 })),
    );
  }, [board.ready, diagram, rf]);

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
    // A component added a moment ago may not be selected on screen yet (fast double-adds):
    // chain from it anyway, using its position in the document.
    const pending = selectNext.current ? diagram.nodes.get(selectNext.current) : undefined;
    const pendingPos = pending?.get('position') as { x: number; y: number } | undefined;
    if (pending && pendingPos && !pending.get('parentId')) {
      return {
        x: pendingPos.x + DEFAULT_COMPONENT_SIZE.width + 80 + DEFAULT_COMPONENT_SIZE.width / 2,
        y: pendingPos.y + DEFAULT_COMPONENT_SIZE.height / 2,
      };
    }
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
  }, [diagram, rf, viewportCentre]);

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
      revealNext.current = true;
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

  /** Real rendered sizes, so grouping/aligning uses what's on screen rather than defaults. */
  const measure = useCallback(
    (id: string) => {
      const m = rf.getInternalNode(id)?.measured;
      return m?.width && m?.height ? { width: m.width, height: m.height } : undefined;
    },
    [rf],
  );

  /**
   * The group a dragged node would land in: the smallest group containing the node's centre,
   * ignoring the dragged nodes themselves and anything inside them (no dropping into yourself).
   */
  const findDropTarget = useCallback(
    (dragged: FlowNode[]): string | null => {
      const draggedIds = new Set(dragged.map((n) => n.id));
      const all = rf.getNodes();
      const isInsideDragged = (id: string | undefined): boolean => {
        let current = id;
        let guard = 0;
        while (current && guard++ < 50) {
          if (draggedIds.has(current)) return true;
          current = all.find((n) => n.id === current)?.parentId;
        }
        return false;
      };
      const primary = dragged[0];
      if (!primary) return null;
      const internal = rf.getInternalNode(primary.id);
      if (!internal) return null;
      const abs = internal.internals.positionAbsolute;
      const cx = abs.x + (internal.measured.width ?? 0) / 2;
      const cy = abs.y + (internal.measured.height ?? 0) / 2;
      let best: { id: string; area: number } | null = null;
      for (const g of all) {
        if (g.type !== 'group' || draggedIds.has(g.id) || isInsideDragged(g.id)) continue;
        const gi = rf.getInternalNode(g.id);
        if (!gi) continue;
        const p = gi.internals.positionAbsolute;
        const w = gi.measured.width ?? 0;
        const h = gi.measured.height ?? 0;
        if (
          cx >= p.x &&
          cx <= p.x + w &&
          cy >= p.y &&
          cy <= p.y + h &&
          (!best || w * h < best.area)
        ) {
          best = { id: g.id, area: w * h };
        }
      }
      return best?.id ?? null;
    },
    [rf],
  );

  const onNodeDrag = useCallback(
    (_e: unknown, _node: FlowNode, dragged: FlowNode[]) => {
      const target = findDropTarget(dragged);
      const current = dragged[0]?.parentId ?? null;
      setDropTargetId(target !== current ? target : null);
    },
    [findDropTarget],
  );

  const onNodeDragStop = useCallback(
    (_e: unknown, _node: FlowNode, dragged: FlowNode[]) => {
      setDropTargetId(null);
      const draggedIds = new Set(dragged.map((n) => n.id));
      const moves = dragged.map((n) => ({ node: n, target: findDropTarget([n]) }));
      let movedIn: string | null = null;
      diagram.doc.transact(() => {
        for (const { node } of moves) {
          diagram.nodes
            .get(node.id)
            ?.set('position', { x: Math.round(node.position.x), y: Math.round(node.position.y) });
        }
        // Re-parent in the same transaction (one undo step). Children of dragged groups move
        // with their group, so only reconsider nodes whose parent wasn't also dragged.
        for (const { node, target } of moves) {
          if (node.parentId && draggedIds.has(node.parentId)) continue;
          const current = node.parentId ?? null;
          if (target !== current && reparent(diagram, node.id, target ?? undefined)) {
            if (target) movedIn = target;
          }
        }
      }, LOCAL_ORIGIN);
      if (movedIn) {
        const group = diagram.nodes.get(movedIn);
        if (group) toast(`Moved into ${String(group.get('label') || 'group')}`);
      }
    },
    [diagram, findDropTarget],
  );

  const selectOnly = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setNodes((nds) =>
      nds.map((n) => (set.has(n.id) !== !!n.selected ? { ...n, selected: set.has(n.id) } : n)),
    );
    setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)));
  }, []);

  const groupSelection = useCallback(
    (type: GroupType) => {
      setGroupMenuOpen(false);
      const ids = rf
        .getNodes()
        .filter((n) => n.selected)
        .map((n) => n.id);
      if (ids.length === 0) {
        toast('Select one or more items to group them.');
        return;
      }
      const id = groupNodes(diagram, ids, type, { origin: LOCAL_ORIGIN, measure });
      if (!id) {
        toast('Select items that are in the same container to group them.');
        return;
      }
      selectNext.current = id;
    },
    [diagram, measure, rf],
  );

  const ungroupNode = useCallback(
    (groupId: string) => {
      const children = ungroup(diagram, groupId, { origin: LOCAL_ORIGIN });
      requestAnimationFrame(() => selectOnly(children));
    },
    [diagram, selectOnly],
  );

  const alignSelection = useCallback(
    (mode: AlignMode) => {
      const ids = rf
        .getNodes()
        .filter((n) => n.selected)
        .map((n) => n.id);
      align(diagram, ids, mode, { origin: LOCAL_ORIGIN, measure });
    },
    [diagram, measure, rf],
  );

  const distributeSelection = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      const ids = rf
        .getNodes()
        .filter((n) => n.selected)
        .map((n) => n.id);
      distribute(diagram, ids, axis, { origin: LOCAL_ORIGIN, measure });
    },
    [diagram, measure, rf],
  );

  /** A drawing tool created something: select it (and start typing for text). */
  const onToolCreated = useCallback((id: string, opts: { edit: boolean; keepTool: boolean }) => {
    // While the pen stays active, don't select each stroke (the outline would get in the way).
    if (!opts.keepTool) selectNext.current = id;
    if (opts.edit) setEditingId(id);
    // Switch back to Select one tick later: the browser still fires `click` for this press, and
    // if the overlay were already gone it would land on the canvas, deselect, and steal focus
    // from the new text box.
    if (!opts.keepTool) setTimeout(() => setTool('select'), 0);
  }, []);

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
      } else if (e.key === 'Escape') {
        // Esc backs out one level: group menu → drawing tool → selection.
        if (groupMenuOpen) setGroupMenuOpen(false);
        else if (tool !== 'select') setTool('select');
        else selectOnly([]);
      } else if (groupMenuOpen && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        groupSelection(GROUP_TYPES[Number(e.key) - 1] as GroupType);
      } else if (!mod && key === 'n') {
        e.preventDefault();
        addNote();
      } else if (!mod && key === 'v') {
        setTool('select');
      } else if (!mod && key === 'd') {
        setTool('pen');
      } else if (!mod && key === 'r') {
        setToolSettings((s) => ({ ...s, shape: 'rectangle' }));
        setTool('shape');
      } else if (!mod && key === 'o') {
        setToolSettings((s) => ({ ...s, shape: 'ellipse' }));
        setTool('shape');
      } else if (!mod && key === 't') {
        setTool('text');
      } else if (key === 'g' && e.shiftKey) {
        e.preventDefault();
        const group = rf.getNodes().find((n) => n.selected && n.type === 'group');
        if (group) ungroupNode(group.id);
        else toast('Select a group to ungroup it.');
      } else if (key === 'g') {
        e.preventDefault();
        if (rf.getNodes().some((n) => n.selected)) setGroupMenuOpen(true);
        else toast('Select one or more items to group them.');
      } else if (!mod && e.key === '[') {
        setLeftOpen((o) => !o);
      } else if (!mod && e.key === ']') {
        setRightOpen((o) => !o);
      } else if (!mod && (e.key === 'Enter' || e.key === 'F2')) {
        const selected = rf.getNodes().filter((n) => n.selected);
        if (selected.length === 1 && selected[0] && selected[0].type !== 'drawing') {
          e.preventDefault();
          setEditingId(selected[0].id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    addNote,
    deleteSelection,
    groupMenuOpen,
    groupSelection,
    isDesktop,
    rf,
    selectOnly,
    tool,
    undo,
    ungroupNode,
  ]);

  const context = useMemo(
    () => ({ diagram, registry, editingId, setEditingId, dropTargetId }),
    [diagram, registry, editingId, dropTargetId],
  );
  const selectedNodeIds = useMemo(() => nodes.filter((n) => n.selected).map((n) => n.id), [nodes]);
  const selectedEdgeIds = useMemo(() => edges.filter((e) => e.selected).map((e) => e.id), [edges]);
  const properties = (
    <PropertiesPanel
      diagram={diagram}
      registry={registry}
      selectedNodeIds={selectedNodeIds}
      selectedEdgeIds={selectedEdgeIds}
      onGroup={groupSelection}
      onUngroup={ungroupNode}
      onAlign={alignSelection}
      onDistribute={distributeSelection}
      onDelete={deleteSelection}
    />
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
  const empty = board.ready && nodes.length === 0 && tool === 'select';
  const hasSelection = selectedNodeIds.length + selectedEdgeIds.length > 0;

  return (
    <BoardContext.Provider value={context}>
      <div className="flex h-dvh flex-col bg-canvas">
        <BoardHeader
          diagram={diagram}
          saved={board.saved}
          persistent={board.persistent}
          panelToggles={
            isDesktop ? (
              <>
                <IconButton
                  label={leftOpen ? 'Hide components panel' : 'Show components panel'}
                  shortcut="["
                  aria-pressed={leftOpen}
                  onClick={() => setLeftOpen((o) => !o)}
                >
                  <PanelLeft />
                </IconButton>
                <IconButton
                  label={rightOpen ? 'Hide properties panel' : 'Show properties panel'}
                  shortcut="]"
                  aria-pressed={rightOpen}
                  onClick={() => setRightOpen((o) => !o)}
                >
                  <PanelRight />
                </IconButton>
              </>
            ) : null
          }
        />
        <div className="relative flex min-h-0 flex-1">
          {isDesktop && leftOpen ? (
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
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              connectionMode={ConnectionMode.Loose}
              deleteKeyCode={null}
              // UX §5.3: Shift-click adds to the selection (Ctrl/⌘ work too).
              multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
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
              {canvasWidth >= 760 ? (
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

            {tool !== 'select' ? (
              <ToolOverlay
                tool={tool}
                settings={toolSettings}
                diagram={diagram}
                onCreated={onToolCreated}
              />
            ) : null}

            {tool === 'pen' || tool === 'shape' ? (
              <ToolOptions
                tool={tool}
                settings={toolSettings}
                onChange={setToolSettings}
                onDone={() => setTool('select')}
              />
            ) : null}

            {groupMenuOpen ? (
              <GroupMenu onPick={groupSelection} onClose={() => setGroupMenuOpen(false)} />
            ) : null}

            <Toolbar
              tool={tool}
              shape={toolSettings.shape}
              onTool={setTool}
              onShape={(shape) => {
                setToolSettings((s) => ({ ...s, shape }));
                setTool('shape');
              }}
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
              <div className="absolute left-4 right-4 top-4 z-10 flex items-start justify-between gap-2">
                <Button
                  variant="primary"
                  size="touch"
                  className="shadow-e2"
                  onClick={() => setPaletteOpen(true)}
                >
                  <Plus /> Add component
                </Button>
                {hasSelection ? (
                  <Button
                    size="touch"
                    className="shadow-e2"
                    onClick={() => setPropertiesOpen(true)}
                  >
                    <SlidersHorizontal /> Properties
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {isDesktop && rightOpen ? (
            <aside
              aria-label="Properties"
              className="w-[296px] shrink-0 border-l border-border bg-bg"
            >
              {properties}
            </aside>
          ) : null}
        </div>

        {!isDesktop ? (
          <Sheet open={propertiesOpen && hasSelection} onOpenChange={setPropertiesOpen}>
            <SheetContent
              side={isPhone ? 'bottom' : 'right'}
              title="Properties"
              className={isPhone ? 'max-h-[70dvh]' : ''}
            >
              <div className="-mx-4">{properties}</div>
            </SheetContent>
          </Sheet>
        ) : null}

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
  panelToggles,
}: {
  diagram: DiagramDoc;
  saved: boolean;
  persistent: boolean;
  panelToggles?: ReactNode;
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
        {panelToggles}
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
  tool: Tool;
  shape: ShapeKind;
  onTool: (tool: Tool) => void;
  onShape: (shape: ShapeKind) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onNote: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  const isCircle = props.tool === 'shape' && props.shape === 'ellipse';
  const isBox = props.tool === 'shape' && !isCircle;
  return (
    <div
      role="toolbar"
      aria-label="Board tools"
      className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-surface p-1 shadow-e2"
    >
      <IconButton
        label="Select and move"
        shortcut="V"
        tooltipSide="top"
        aria-pressed={props.tool === 'select'}
        onClick={() => props.onTool('select')}
      >
        <MousePointer2 />
      </IconButton>
      <IconButton
        label="Pen: draw freehand"
        shortcut="D"
        tooltipSide="top"
        aria-pressed={props.tool === 'pen'}
        onClick={() => props.onTool('pen')}
      >
        <Pencil />
      </IconButton>
      <IconButton
        label="Box: drag to draw, then type inside"
        shortcut="R"
        tooltipSide="top"
        aria-pressed={isBox}
        onClick={() => props.onShape('rectangle')}
      >
        <Square />
      </IconButton>
      <IconButton
        label="Circle: drag to draw, then type inside"
        shortcut="O"
        tooltipSide="top"
        aria-pressed={isCircle}
        onClick={() => props.onShape('ellipse')}
      >
        <Circle />
      </IconButton>
      <IconButton
        label="Text box: click to type"
        shortcut="T"
        tooltipSide="top"
        aria-pressed={props.tool === 'text'}
        onClick={() => props.onTool('text')}
      >
        <Type />
      </IconButton>
      <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
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

const SHAPE_OPTIONS: Array<[ShapeKind, string, ReactNode]> = [
  ['rectangle', 'Rectangle', <Square key="i" />],
  ['rounded', 'Rounded rectangle', <RectangleHorizontal key="i" />],
  ['ellipse', 'Ellipse', <Circle key="i" />],
  ['diamond', 'Diamond', <Diamond key="i" />],
  ['cylinder', 'Cylinder', <Cylinder key="i" />],
  ['hexagon', 'Hexagon', <Hexagon key="i" />],
];

/** Options for the active drawing tool, floating above the toolbar. */
function ToolOptions({
  tool,
  settings,
  onChange,
  onDone,
}: {
  tool: 'pen' | 'shape';
  settings: ToolSettings;
  onChange: (s: ToolSettings) => void;
  onDone: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label={tool === 'pen' ? 'Pen options' : 'Shape options'}
      className="absolute bottom-[68px] left-1/2 z-10 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-lg border border-border bg-surface px-2 py-1 shadow-e2"
    >
      {tool === 'shape' ? (
        <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Shape">
          {SHAPE_OPTIONS.map(([shape, label, icon]) => (
            <IconButton
              key={shape}
              label={label}
              tooltipSide="top"
              aria-pressed={settings.shape === shape}
              onClick={() => onChange({ ...settings, shape })}
            >
              {icon}
            </IconButton>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Ink colour">
            {(Object.keys(INK_COLOURS) as InkColor[]).map((ink) => (
              <button
                key={ink}
                type="button"
                role="radio"
                aria-checked={settings.ink === ink}
                aria-label={ink === 'ink' ? 'Ink' : ink}
                title={ink === 'ink' ? 'Ink' : ink}
                onClick={() => onChange({ ...settings, ink })}
                className={cn(
                  'size-6 shrink-0 rounded-full border border-border-strong pointer-coarse:size-9',
                  settings.ink === ink && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
                )}
                style={{ background: INK_COLOURS[ink] }}
              />
            ))}
          </div>
          <SegmentedControl
            ariaLabel="Line width"
            value={String(settings.strokeWidth)}
            onValueChange={(w) => onChange({ ...settings, strokeWidth: Number(w) })}
            options={STROKE_OPTIONS}
          />
        </>
      )}
      <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <Button size="sm" variant="ghost" onClick={onDone} className="shrink-0">
        Done <Kbd>Esc</Kbd>
      </Button>
    </div>
  );
}

/** "G" opens this: pick a container type (or press 1–6). */
function GroupMenu({ onPick, onClose }: { onPick: (t: GroupType) => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div
      role="dialog"
      aria-label="Group selection into"
      className="absolute left-1/2 top-4 z-20 w-[min(520px,calc(100%-24px))] -translate-x-1/2 rounded-xl border border-border bg-surface-raised p-3 shadow-e3 animate-pop-in"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Group into…</p>
        <span className="flex items-center gap-2 text-xs text-text-muted">
          Press 1–6
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel <Kbd>Esc</Kbd>
          </Button>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {GROUP_TYPES.map((t, i) => (
          <Button
            key={t}
            ref={i === 0 ? first : undefined}
            size="sm"
            onClick={() => onPick(t)}
            className="justify-start"
          >
            <Kbd>{i + 1}</Kbd> {GROUP_LABELS[t]}
          </Button>
        ))}
      </div>
    </div>
  );
}
