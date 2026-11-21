# ADR-006: React Flow for the canvas instead of a custom canvas or a whiteboard engine

- Status: Accepted (Phase 1, to be confirmed by the Phase 2 performance budget)
- Date: 2026-11-21

## Context
The editor is a node-and-edge diagram tool, not a freehand whiteboard. It needs:
- drag, handles, connections, smooth-step edges with labels, nested groups, a minimap, zoom and pan
- keyboard accessibility and touch gestures
- 60 fps with 300+ nodes while remote updates arrive
- clean, deterministic SVG export

## Options
1. **React Flow (`@xyflow/react`)**: purpose-built for node graphs. Nodes are React components (so the design system and accessibility apply directly), with sub-flows for groups, handles, edge routing, a minimap, viewport culling (`onlyRenderVisibleElements`) and controlled state that maps cleanly onto our Y.Doc → Zustand projection. MIT licensed and widely used.
2. **Custom canvas (Canvas2D or WebGL)**: maximum performance ceiling, but we'd rebuild hit-testing, text editing, accessibility, focus management and DOM-quality SVG export. Months of work that doesn't differentiate the product.
3. **tldraw / Excalidraw**: excellent freehand whiteboards, but their models are shapes-and-strokes, not typed components and edges. tldraw's licence also requires a paid key to remove its watermark in production.

## Decision
Use **React Flow**. Keep it behind our own projection layer: React Flow renders, and `packages/diagram-schema` ops are the only code that mutates the document. That way the canvas could be swapped later without touching sync, persistence or the AI applier.

## Consequences
- ✅ Nodes are ordinary React components: tooltips, focus rings, ARIA and theming come from `packages/ui`.
- ✅ Export comes straight from the DOM/SVG.
- ⚠️ DOM nodes cost more than canvas pixels. Mitigations: memoised node and edge components, per-frame coalescing of remote updates, viewport culling, icons as cached images. Phase 2 measures 300, 500 and 1,000 node boards and records the results in `docs/PERFORMANCE.md`. If the budget can't be met, this ADR is revisited.
- ⚠️ Version choice: React Flow 13 is the current major. Phase 2 pins whichever major passes the perf harness.
