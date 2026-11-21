import { addNode, type DiagramDoc, type InkColor, type ShapeKind } from '@archboard/diagram-schema';
import { useReactFlow } from '@xyflow/react';
import { useRef, useState, type PointerEvent } from 'react';
import { INK_COLOURS, smoothPath } from './nodes.tsx';
import { LOCAL_ORIGIN } from './use-board-doc.ts';

export type Tool = 'select' | 'pen' | 'shape' | 'text';

export interface ToolSettings {
  shape: ShapeKind;
  ink: InkColor;
  strokeWidth: number;
}

const DEFAULT_SHAPE_SIZE = { width: 160, height: 100 };
const MIN_DRAG = 6; // px on screen; less than this is a click

/**
 * Captures pointer input for the drawing tools, above the canvas:
 * - pen: freehand strokes (the tool stays active, like a real pen; Esc or V to stop)
 * - shape: drag to size a shape (a click drops a default-sized one)
 * - text: click to place a text box and start typing
 */
export function ToolOverlay({
  tool,
  settings,
  diagram,
  onCreated,
}: {
  tool: Exclude<Tool, 'select'>;
  settings: ToolSettings;
  diagram: DiagramDoc;
  /** Called with the new node id; `edit` asks the editor to open inline editing. */
  onCreated: (id: string, options: { edit: boolean; keepTool: boolean }) => void;
}) {
  const rf = useReactFlow();
  const ref = useRef<HTMLDivElement>(null);
  const points = useRef<Array<[number, number]>>([]);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const local = (e: PointerEvent): [number, number] => {
    const rect = ref.current?.getBoundingClientRect();
    return [e.clientX - (rect?.left ?? 0), e.clientY - (rect?.top ?? 0)];
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    start.current = { x: e.clientX, y: e.clientY };
    if (tool === 'pen') {
      points.current = [p];
      setPreview(smoothPath(points.current));
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    if (tool === 'pen') {
      const p = local(e);
      const last = points.current[points.current.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1.5) {
        points.current.push(p);
        setPreview(smoothPath(points.current));
      }
    } else if (tool === 'shape') {
      const rect = ref.current?.getBoundingClientRect();
      const x0 = start.current.x - (rect?.left ?? 0);
      const y0 = start.current.y - (rect?.top ?? 0);
      const [x1, y1] = local(e);
      setBox({
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        w: Math.abs(x1 - x0),
        h: Math.abs(y1 - y0),
      });
    }
  };

  const finishPen = (e: PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    const screen =
      points.current.length === 1
        ? [
            points.current[0]!,
            [points.current[0]![0] + 0.5, points.current[0]![1] + 0.5] as [number, number],
          ]
        : points.current;
    const flow = screen.map(([x, y]) => {
      const p = rf.screenToFlowPosition({ x: x + (rect?.left ?? 0), y: y + (rect?.top ?? 0) });
      return [Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2] as [number, number];
    });
    // Drop points closer than 1 flow-px to keep documents small, keep the ends.
    const simplified = flow
      .filter((p, i) => {
        if (i === 0 || i === flow.length - 1) return true;
        const prev = flow[i - 1] as [number, number];
        return Math.hypot(p[0] - prev[0], p[1] - prev[1]) >= 1;
      })
      .slice(0, 4000);
    const pad = settings.strokeWidth + 2;
    const xs = simplified.map((p) => p[0]);
    const ys = simplified.map((p) => p[1]);
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const width = Math.max(8, Math.max(...xs) + pad - minX);
    const height = Math.max(8, Math.max(...ys) + pad - minY);
    const id = addNode(
      diagram,
      {
        kind: 'drawing',
        points: simplified.map(([x, y]) => [
          Math.round((x - minX) * 2) / 2,
          Math.round((y - minY) * 2) / 2,
        ]),
        color: settings.ink,
        strokeWidth: settings.strokeWidth,
        size: { width: Math.ceil(width), height: Math.ceil(height) },
      },
      { origin: LOCAL_ORIGIN, at: { x: minX, y: minY }, avoidOverlap: false, snap: false },
    );
    onCreated(id, { edit: false, keepTool: true });
    void e;
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dragged = Math.hypot(e.clientX - s.x, e.clientY - s.y) >= MIN_DRAG;

    if (tool === 'pen') {
      finishPen(e);
      setPreview(null);
      points.current = [];
      return;
    }

    const a = rf.screenToFlowPosition({ x: s.x, y: s.y });
    const b = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setBox(null);

    if (tool === 'shape') {
      const size = dragged
        ? {
            width: Math.max(40, Math.round(Math.abs(b.x - a.x))),
            height: Math.max(30, Math.round(Math.abs(b.y - a.y))),
          }
        : DEFAULT_SHAPE_SIZE;
      const at = dragged
        ? { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }
        : { x: a.x - size.width / 2, y: a.y - size.height / 2 };
      const id = addNode(
        diagram,
        { kind: 'shape', shape: settings.shape, text: '', fill: 'none', size },
        { origin: LOCAL_ORIGIN, at, avoidOverlap: false },
      );
      onCreated(id, { edit: false, keepTool: false });
    } else if (tool === 'text') {
      const id = addNode(
        diagram,
        { kind: 'text', text: '', fontSize: 'm' },
        { origin: LOCAL_ORIGIN, at: { x: a.x, y: a.y - 14 }, avoidOverlap: false },
      );
      onCreated(id, { edit: true, keepTool: false });
    }
  };

  const cursor = tool === 'text' ? 'text' : 'crosshair';
  return (
    <div
      ref={ref}
      className="absolute inset-0 z-[6] touch-none select-none"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
        setPreview(null);
        setBox(null);
      }}
      aria-label={
        tool === 'pen'
          ? 'Drawing area: drag to draw'
          : tool === 'shape'
            ? 'Drag to draw a shape'
            : 'Click to add text'
      }
      role="application"
    >
      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        {preview ? (
          <path
            d={preview}
            fill="none"
            stroke={INK_COLOURS[settings.ink]}
            strokeWidth={settings.strokeWidth * rf.getZoom()}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {box ? (
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            fill="color-mix(in srgb, var(--accent) 8%, transparent)"
            stroke="var(--accent)"
            strokeDasharray="4 3"
            rx={settings.shape === 'rounded' ? 8 : 0}
          />
        ) : null}
      </svg>
    </div>
  );
}
