# ADR-006: React Flow for the canvas instead of a custom canvas or a whiteboard engine

- Status: Accepted
- Date: 2026-11-21

## Context
The editor is a node-and-edge diagram tool, not a freehand whiteboard. It needs:
- drag, handles, connections, smooth-step edges with labels, nested groups, a minimap, zoom and pan
- keyboard accessibility and touch gestures
- 60 fps with 300+ nodes
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
- ⚠️ DOM nodes cost more than canvas pixels. Mitigations: memoised node and edge components, re-rendering at most once per animation frame, viewport culling, and icons as cached images.
- ⚠️ Pinned to React Flow 12.12.1 (exact version), upgraded deliberately.
