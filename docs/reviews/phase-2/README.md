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

### Next in Phase 2
Properties panel, groups (Region/VPC/…), quick-add at the cursor and drop-to-connect, copy/paste, command palette, edge labels and sync/async styles, export/import, outline view, performance harness.
