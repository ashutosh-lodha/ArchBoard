# Phase 2 usability self-review (in progress)

## Slice 1 — component panel + canvas (2026-11-21)

What a first-time visitor can do now: **Start a board** → click or drag components from the panel (or press `/` to search, with aliases like "lb" and "postgres") → drag between connection handles → double-click to rename → Delete (undoable, with toast) → reload and find everything saved on this device. Phone and tablet get the panel as a bottom sheet / drawer.

Screenshots: `j1-laptop.png`, `j1-desktop.png` (from the Playwright J1 journey).

### Rough edges found and fixed
| # | Found | Fix |
|---|---|---|
| 1 | Home page showed a developer-only "Open the design system" button | Removed; home has one clear action, **Start a board** |
| 2 | New components stacked vertically around the centre — a chain like LB → Service → DB read top-to-bottom | Click-added components go to the right of the selected one; the view pans to keep the new one visible |
| 3 | New components weren't selected after adding (state ref cleared before the updater ran) | Pending selection captured before the state update |
| 4 | Toasts ignored dark mode and covered the bottom toolbar | Sonner runs unstyled with our tokens and follows the theme; toasts sit above the toolbar on boards |
| 5 | Search showed two identical "Cache" tiles (generic and Azure) | Vendor tiles show their provider and have accessible names like "Cache, Azure" |
| 6 | A toast's Undo undid "whatever was last", even if that delete had already been undone | Each toast is tied to its own delete and closes as soon as that delete is undone or anything else changes |
| 7 | Quick actions could merge into one undo step (400 ms capture window) | Every action is its own undo step (drags already commit once, on drop) |
| 8 | After undo, a restored node ignored the first click (not yet measured) | Reappearing nodes are explicitly re-measured |
| 9 | Delete stopped working after undo → select → Delete (React Flow's key tracking missed a key-up) | Delete/Backspace handled by our own keyboard handler |

## Slice 2: properties, groups, drawing tools, Google Cloud icons (2026-11-21)

New:
- **Properties panel** (right). It changes with the selection: a component (label, replicas, region, notes, "Things to consider"), a connection (label, sync/async, protocol, arrows), a group, a note, a shape, text, a drawing, or a multi-selection (align, distribute, group).
- **Groups:** Region, AZ, VPC, Subnet, Kubernetes, Boundary. Create with **G** then 1–6, or from the panel. Drag in and out. Resize, rename, ungroup with **Shift+G**.
- **Drawing tools:** Pen **D** (freehand; stays active until Esc), Shape **R** (drag to draw 6 shapes, then write inside), Text box **T** (click and type).
- **Google Cloud icons:** 226 (2025 core + legacy), in a GCP tab.
- Collapsible side panels (**[** and **]**).

### Rough edges found and fixed
| # | Found | Fix |
|---|---|---|
| 1 | "Recently used" re-sorted after every click, so tiles moved under the cursor and caused mis-clicks | The recents order is fixed while the panel is open |
| 2 | Shift-click didn't add to the selection (React Flow defaults to Ctrl/⌘) | Shift, Ctrl and ⌘ all multi-select |
| 3 | React Flow's default group style drew a dark filled box over ours | Reset; our tinted container shows |
| 4 | Text box placed with the tool couldn't be typed into (new nodes are hidden until measured; the follow-up click stole focus) | Editor retries focus until visible; tool switches back one tick later |
| 5 | Adding the first item to an empty board zoomed or panned the view | Fit-on-open only for boards that already had content |
| 6 | Drawing a shape panned the view | Only panel-added components are auto-revealed |
| 7 | Fast double-adds chained from the wrong component | Chain from the most recently added one even before its selection lands |
| 8 | Group menu cut off "Kubernetes cluster" | Wider menu, 2/3-column grid |
| 9 | Minimap overlapped the toolbar on narrower canvases | Minimap hides below 760 px of canvas |
| 10 | At 1024 px both side panels left a 460 px canvas | Properties panel starts closed below 1280 px (one click or **]** to open) |
| 11 | A single selected component offered no way to group it | "Group into" buttons for single components too |
| 12 | The icon build deleted its output folder, and a running dev server cached "file not found" and broke the board | Build overwrites in place; registry.json is swapped in atomically |

Known, not fixed yet: a very fast typist can lose the first one or two characters of a new text box in the ~100 ms before it's visible.

## Slice 3: feedback fixes (pen, boxes and circles with text, component cards)

| # | Reported / found | Cause | Fix |
|---|---|---|---|
| 1 | Pen strokes looked right while drawing, then "curved poorly" on release | Converting points to board coordinates applied snap-to-grid, so every point landed on a 4–8 px step: a staircase the smoothing distorted (see `pen-before-release.png` / `pen-after-release.png`) | Ink points skip grid snapping; a test checks the saved stroke's bounds match the live preview within 2 px |
| 2 | Boxes needed a separate text box to hold text | Shapes only took text on double-click | Drawing a box or circle opens typing right away; new **Box (R)** and **Circle (O)** toolbar tools |
| 3 | Components from the left panel couldn't be resized or hold text | Fixed-size cards with name only | Cards are resizable (corner and edge handles) and show **text on the card** ("+ Add text", double-click, or the properties panel); both survive reload |
| 4 | Typing into a new box sometimes went nowhere | Focus retries used animation frames, which slow down or stop in background or slow frames | Retries use timers |
| 5 | Drawing could be broken by a pointer that can't be captured | `setPointerCapture` threw and aborted the stroke | Wrapped; drawing continues |

### Next in Phase 2
Quick-add at the cursor and drop-to-connect, copy/paste, command palette, select-all and nudge, export/import, outline view, performance harness.
