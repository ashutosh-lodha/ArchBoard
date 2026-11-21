# ArchBoard — UX Specification

Status: **Draft v1 — awaiting approval** · Last updated: 2026-11-21
Companion to [DESIGN.md](DESIGN.md). Where this document and the code disagree, this document wins until it is changed on purpose.

---

## 1. Principles → concrete rules

| Principle | Rule we enforce |
|---|---|
| Obvious beats clever | Every action has a visible control **and** a shortcut **and** a command-palette entry. Tooltips show the shortcut. |
| Direct manipulation | Drag to place, drag from a handle to connect, double-click to rename, Delete to remove. Feedback in under 100 ms (optimistic local apply). |
| Never lose work | A save-status pill is always visible. No action discards work without undo or confirmation. Offline edits are kept, never silently dropped. |
| Calm, professional | One accent colour plus one "pen" colour. Motion only explains change (never decorates). Dense but not cramped: 14 px UI base. |
| Never fail silently | If something is not allowed, the control is disabled **with a reason**. If something failed, we say what happened and what happens next. |
| First 30 seconds | A first-time visitor reaches a canvas with a hint in **one click**, with no sign-in. |

**Voice:** plain, short, active. Buttons are verbs ("Start a board", "Request pen", "Copy link"). No "Oops!", no blame. Errors follow the pattern *what happened → what we're doing → what you can do*.

---

## 2. Information architecture

```mermaid
flowchart TD
  L["/ Landing<br/>live demo board · Start a board"] --> N["/new<br/>Blank · Template · AI (Phase 9)"]
  L --> SI[Sign in (Clerk modal)]
  N --> B["/b/:id Board editor"]
  D["/dashboard<br/>My boards · Templates"] --> B
  D --> N
  J["/join/:code<br/>Invite preview + name"] --> B
  B --> R["/b/:id/replay"]
  B --> SH[Share dialog]
  B --> IV[Interview panel]
  T["/templates gallery"] --> N
```

Global header on non-board pages: logo · Templates · Dashboard (signed in) · Sign in / user button. The board page has its own compact header (§4).

---

## 3. Core user journeys

### J1. First-time visitor draws LB → Service → DB (target: under 60 s, no docs)
1. Landing: a hero with a short looping live demo board (a real React Flow render of the URL-shortener template, animating a "pen handoff"). Primary CTA **Start a board**.
2. `/new` opens a chooser: **Blank board** (focused by default) · **Start from a template** (8 cards) · *Generate with AI (coming soon)*, disabled with a "Phase 2" label. Pressing Enter selects Blank.
3. Blank canvas shows the **empty-state hint** centred: "Drag a component from the left, or press **/** to search", with three suggestion chips: *Load Balancer · Service · Database*. Clicking a chip adds it at the centre.
4. The user types `/`, then "lb", then Enter: a Load Balancer is placed at the cursor (or the centre of the view).
5. They hover the node, handles appear, drag from the right handle into empty space, and quick-add opens **at the drop point**. They type "service", Enter: a Service is created and connected automatically.
6. Same again for "postgres" (the alias resolves to SQL DB, or a provider icon if a filter is active).
7. Double-click "Service 1", type "URL service", Enter.
8. The save pill says "Saved on this device". A soft banner, shown once the board has 3+ nodes: "Sign in to save to your account and share." **Sign in** / dismiss.

### J2. Owner starts an interview with a guest
Dashboard → **New board** → template "Rate limiter" → **Share** → role *Can request pen* → **Copy link** → toggle **Interview mode** → set phases → **Start timer**. The guest opens the link, enters a name, and lands following the owner. The owner clicks the guest's avatar → **Give pen**. A toast tells everyone "Priya now has the pen".

### J3. Viewer requests the pen
A viewer sees the read-only palette with a lock icon. The tooltip says "Only the presenter can edit. Request the pen to make changes." They click **Request pen** (header). The presenter gets a non-blocking card at the top right: "Priya wants the pen · **Give pen** · Not now", which auto-dismisses after 30 s as "No response — try again". On accept, both see the toast, and the viewer's palette unlocks with a brief highlight.

### J4. Presenter loses connection
- **Under 15 s:** the presenter sees the banner "Offline — changes will sync", keeps editing, then reconnects; the edits flush and the pill returns to "Saved". Viewers see a small "Reconnecting…" badge on the presenter's avatar.
- **Over 15 s:** viewers get a toast: "Ashutosh disconnected. The pen went back to the owner." (or "…The board is view-only until the owner returns.") When the presenter returns: "You were offline and the pen moved to Mei. Your last 4 changes weren't applied. **Save as a copy** · **Discard**."

### J5. Replay
Board menu → **Replay** opens `/b/:id/replay`. A timeline at the bottom shows markers (pen handoffs as amber dots, phase changes as labelled ticks). Controls: play/pause (Space), speed 1×/2×/4×/8×, scrub, and ←/→ to step between markers. **Open as new board at this point** forks the board.

### J6. Export for a blog
Pick **Export** from the board menu → choose PNG/SVG, with options for transparent background, padding, scale 1×/2×/3×, and "Selection only". A preview thumbnail updates live → **Download**. JSON export is in the same dialog under a "Data" tab.

### J7. Keep a guest board after sign-in
A local board plus **Share** opens the Clerk sign-in modal. After sign-in, a dialog: "Keep this board in your account?" **Keep board** (primary) / Start fresh. The board uploads, the URL changes to `/b/:id`, and the Share dialog opens automatically.

---

## 4. Board editor layout

### 4.1 Desktop (≥ 1024 px)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ ArchBoard  │ Rate limiter ✎ │ ● Saved │      ◉◉◉ +2   ✎ Priya has the pen  [Request pen] │ ⏱ Interview │ Share │ ⋯ │
├──────────┬───────────────────────────────────────────────────────────────┬────────────┤
│ 🔍 Search │                                                               │ PROPERTIES │
│ [All|AWS| │        · · · · · · · · · · · · · · · · · · · · · · ·          │ Service    │
│ GCP|Azure │        ·   ┌────────┐       ┌────────┐       ┌───────┐ ·      │ Label  [..]│
│ |Generic] │        ·   │⇄ LB    │──────▶│▣ API   │──────▶│▤ DB   │ ·      │ Replicas[3]│
│ ★ Favs    │        ·   └────────┘       └────────┘       └───────┘ ·      │ Region [..]│
│ ⟲ Recent  │        · · · · · · · · · · · · · · · · · · · · · · ·          │ Notes  [..]│
│ ─────────  │                                                    ┌─────┐   │ ───────────│
│ Compute   │   ┌──────────────────────────────┐                  │mini │   │ Tradeoffs ▸│
│  ▣ Service│   │ ↶ ↷ │ ▭ Note  T Text │ ⊞ Group │ ⤢ Fit │ − 100% + │ │ map │   │ Comments 2 │
│  ▣ Worker │   └──────────────────────────────┘                  └─────┘   │            │
│ ⟨ collapse│                                                               │ collapse ⟩ │
└──────────┴───────────────────────────────────────────────────────────────┴────────────┘
```
- Left palette 264 px, right panel 296 px. Each collapses to a 44 px rail (`[` and `]`). Collapsed state is remembered per device.
- Bottom-centre floating toolbar: undo/redo, note, text, group, fit view, zoom. It hides the edit tools when you don't hold the pen and shows **Request pen** in their place.
- The minimap is at the bottom right and can be toggled (`M`).
- The right panel is contextual: nothing selected → **Board** (title, description, grid/snap toggles, interview). One node → that node's fields plus its tradeoff card plus comments. One edge → label, style (Sync/Async segmented control), protocol, arrow. Multiple selected → align/distribute plus a count.

### 4.2 Tablet (768–1023 px)

```
┌──────────────────────────────────────────────────────────┐
│ ☰  Rate limiter ✎   ● Saved     ◉◉ ✎Priya   [Request] ⋯   │
├──────────────────────────────────────────────────────────┤
│ [＋]                                                      │
│ [🔍]        canvas (full width)                           │
│ [💬]                                                      │
│                                                    [ⓘ]   │
│        ┌───────────────────────────────────┐             │
│        │ ↶ ↷  ▭  T  ⊞  ⤢  −  +             │             │
│        └───────────────────────────────────┘             │
└──────────────────────────────────────────────────────────┘
 Palette = left slide-over drawer (＋)   Properties = right drawer (ⓘ, auto-opens on double-tap)
```
- Touch: tap to select, drag a node to move, drag empty space to pan (one finger), pinch to zoom, two-finger pan. **Long-press** (500 ms) opens the context menu. Multi-select uses a "Select" toggle in the toolbar (box-select with one finger), since there's no Shift key.
- Handles are always visible on the **selected** node and enlarged to a 44 px hit area (the visual dot stays 10 px).
- Header actions overflow into `⋯` below 900 px.

### 4.3 Phone (< 768 px): viewer-first

```
┌────────────────────────────┐
│ ←  Rate limiter    ● ◉◉ ⋯   │
│ ✎ Priya is presenting  👁 Following │
├────────────────────────────┤
│                            │
│        canvas              │
│   (follows presenter)      │
│                            │
│                            │
├────────────────────────────┤
│ 💬 Comment  😀 React  ⦿ Laser  ⏱ │  ← bottom action bar (56 px)
└────────────────────────────┘
  Bottom sheets: Comments · Interview · Palette (when holding pen) · Properties
```
- Default role on phone is watcher: follow mode on, comment, react, laser, interview panel as a bottom sheet (peek height 30%, drag to 90%).
- **Holding the pen on a phone:** the action bar becomes `＋ Add · ✎ Rename · ⤳ Connect · 🗑 · ↶`. **Connect mode** works as tap source → tap target, because there are no precise handle drags. Add opens the palette sheet. Grouping, align and multi-select show "Easier on a bigger screen" with a **Copy link** to open on desktop.
- The canvas uses `touch-action: none` only inside the canvas element. The page itself never scrolls horizontally, and pinch-zoom in the canvas never triggers browser zoom (the viewport meta keeps user scaling allowed for the rest of the UI).

---

## 5. Interaction rules

### 5.1 Adding components
- **Palette drag** shows a ghost under the cursor and a snap preview, and the node is created on drop. **Palette click** adds at the centre of the view, or offset by `findFreeSpot` so it never overlaps.
- **Quick-add** (`/`, or double-click empty canvas, or drop a connection in empty space) opens a 360 px popover at the point: search input, 6 results, ↑/↓/Enter, Esc closes. Results show the icon, label, provider badge and a matched-alias hint ("matches *elb*").
- **Search:** fuzzy matching over label + aliases + category, ranked by exact alias match → prefix match → fuzzy score, with a boost for recents and favourites. Examples: `lb`, `elb`, `alb` and `load balancer` all find Load Balancer (generic) first, then AWS ELB/ALB, GCP Cloud Load Balancing, and Azure Load Balancer.
- **Default names:** the type label plus a counter ("Service 1"), unique per board.
- **Favourites:** star on hover in the palette. **Recents:** the last 8 used, stored per user (localStorage for guests).

### 5.2 Connecting
- Hovering a node shows 4 handles, one per side. Dragging from a handle draws a live preview edge, and valid targets highlight their nearest handle (magnetic within 24 px).
- Dropping on a node connects to its nearest side. Dropping on empty space opens quick-add and auto-connects. Dropping on the same node or a duplicate edge does nothing and shows the tooltip "Already connected".
- Edges: smooth-step routing with 12 px corner radius. Labels sit at the midpoint on a background pill and are always readable over grid and lines. Selected edges thicken and show endpoint handles for reconnecting.
- New edges default to **Sync** (solid), arrow at the end, no protocol.

### 5.3 Editing and selection
- Double-click a node (or press Enter or F2) to rename inline. Enter confirms, Esc cancels, blur confirms. Empty labels revert to the previous value.
- Click to select. Shift-click adds to the selection. Drag on empty canvas makes a box selection (desktop), Space+drag pans, and middle or right drag pans too.
- Arrow keys nudge 1 grid unit (8 px); Shift+arrow nudges 5 units.
- **Groups:** select nodes, then `G` (or ⌘G) opens a small menu: Region / AZ / VPC / Subnet / K8s cluster / Boundary. The group is created to fit the nodes with 24 px padding. Dragging a node fully into a group highlights the group and re-parents the node on drop; dragging it out re-parents to the canvas. Groups resize from their corners and can nest. `⇧G` ungroups.
- Snap to grid (8 px) and alignment guides (magenta 1 px lines when edges or centres align within 4 px) are on by default and toggleable (`⇧S`). Holding Alt (Option) while dragging disables snapping temporarily.
- **Delete / Backspace** removes the selection, with connected edges cascading. A toast reads "Deleted 3 items · **Undo**".
- **Copy / paste:** ⌘C copies a DiagramV1 fragment to the system clipboard (`text/plain`, prefixed with `archboard:`) plus an in-memory fallback. ⌘V pastes at the cursor with ids remapped, and works across boards and tabs. ⌘D duplicates in place with a 24 px offset.
- **Context menu** (right-click or long-press): node → Rename, Duplicate, Copy, Group, Bring to front, Comment, Delete. Canvas → Paste here, Add component here, Add note, Select all, Fit view.

### 5.4 Undo and redo
Covers every presenter document change: add, move, connect, rename, group, delete, paste, template insert, import, AI apply. Drags merge into one step (400 ms). Shortcuts are ⌘Z / ⌘⇧Z (Ctrl+Y on Windows). The history clears when the pen changes hands, with this toast for the new presenter: "Undo history starts from when you got the pen."

### 5.5 Pen and collaboration
- The header pen chip always shows who has the pen. Clicking it opens a popover listing people with **Give pen** next to each eligible person (presenter) or **Take back pen** (owner).
- The avatar stack shows a coloured ring per person (their cursor colour), plus the pen holder with an amber pen badge. Hover shows the name and role; click opens their menu (Follow, Give pen, Remove).
- **Follow mode** is on by default for non-presenters: the viewport smoothly tracks the presenter's viewport. Any manual pan or zoom pauses following and shows a floating pill: "Not following · **Follow Priya**". Pressing `F` toggles.
- **Laser:** hold `L` or toggle the laser tool. The pointer leaves a fading 600 ms trail in the user's colour. Everyone can use it.
- **Reactions:** 👍 🎉 🤔 ❓ 👀. They float up from the sender's cursor (or the centre on phone) and fade in 1.5 s. Rate limited.
- **Comments:** a comment pin (speech-bubble badge with a count) on the node's top-right corner. Threads open in the right panel (or bottom sheet on phone). Each thread has replies, **Resolve** (collapses; resolved threads are hidden behind a filter) and @mentions of board participants. An unread dot shows on the header's comment icon and on pins.

### 5.6 Interview mode
Toggle in the header (owner only; others see it when active). Panel sections:
1. **Problem statement**: editable by the owner, read-only for others.
2. **Requirements checklist**: functional / non-functional; the owner and presenter can add and check items.
3. **Timer**: a segmented progress bar with the 5 default phases (Requirements 5' → Estimation 5' → High-level 15' → Deep dive 15' → Wrap-up 5'), all editable. Owner controls: Start / Pause / Next phase / Reset. Everyone sees the current phase and time left. At 1 minute left the phase segment pulses once (a static colour change under reduced motion), and a phase change shows a toast to everyone.
4. **Capacity calculator**: inputs for DAU, reads/user/day, writes/user/day, payload size, retention years, and peak factor (default 3×). Outputs: average and peak read/write QPS, storage per year and total, ingress and egress bandwidth. Every output shows its formula on hover. **Attach to component** (pen holder) writes the result into the selected node's notes as a formatted block.

### 5.7 Read-only states (never silent rejection)
Without the pen: the palette is dimmed to 50% with a lock badge and the tooltip "Only the presenter can edit"; the canvas allows select, pan, zoom, comment and laser; drag, delete and rename are disabled at the input level; and any edit attempt (such as pressing Delete) shows a toast: "You're viewing. **Request pen** to edit." (throttled to once per 10 s).

---

## 6. Keyboard map

Shown in the `?` panel, searchable. ⌘ = Ctrl on Windows/Linux.

| Action | Keys |
|---|---|
| Command palette | ⌘K |
| Quick-add at cursor | / |
| Shortcuts panel | ? |
| Undo / Redo | ⌘Z / ⌘⇧Z (or Ctrl+Y) |
| Select all | ⌘A |
| Copy / Paste / Duplicate / Cut | ⌘C / ⌘V / ⌘D / ⌘X |
| Delete selection | Delete / Backspace |
| Rename selected | Enter / F2 |
| Nudge / Big nudge | Arrows / ⇧Arrows |
| Group / Ungroup | G (or ⌘G) / ⇧G |
| Add note / text | N / T |
| Toggle snap & guides | ⇧S |
| Zoom in / out / 100% | ⌘= / ⌘- / ⌘0 |
| Zoom to fit / to selection | ⇧1 / ⇧2 |
| Pan | Space+drag, arrows when nothing is selected |
| Toggle left / right panel | [ / ] |
| Minimap | M |
| Follow presenter | F |
| Laser (hold) | L |
| Request / release pen | P |
| Comment on selection | C |
| Outline view (accessible list) | ⌘⇧O |
| Export | ⌘⇧E |
| Close popover / deselect | Esc |

Single-letter shortcuts are disabled while typing in any input and are reachable via ⌘K, so they never trap screen-reader or IME users.

---

## 7. Other screens

### 7.1 Landing (prerendered, LCP under 1.5 s target)
```
┌───────────────────────────────────────────────────────────────┐
│ ◧ ArchBoard                         Templates   Sign in        │
│                                                               │
│  Whiteboard system design,                                    │
│  one pen at a time.                         ┌───────────────┐ │
│  Draw architectures with real AWS, GCP and  │  live demo    │ │
│  Azure icons. Pass the pen, run the timer,  │  board (lazy) │ │
│  replay how the design evolved.             │               │ │
│  [ Start a board ]  Browse templates →       └───────────────┘ │
│  No sign-up needed to try.                                    │
├───────────────────────────────────────────────────────────────┤
│ 3 feature tiles: Pass the pen · Interview mode · Replay        │
│ Template strip (8 thumbnails) · footer (GitHub, privacy)       │
└───────────────────────────────────────────────────────────────┘
```
The demo board is a static poster image first (that's the LCP element), and it hydrates into an interactive read-only board when idle.

### 7.2 New board chooser (`/new`)
A modal-like page with three large cards in a row (stacked on phone): **Blank** · **Template** (opens a gallery grid with search and difficulty tags) · **Generate with AI** (Phase 9; for now "Coming soon" with a short description, *not* a dead button).

### 7.3 Dashboard
```
┌───────────────────────────────────────────────────────────────┐
│ ◧ ArchBoard   Dashboard  Templates                     (◉)    │
│ My boards                       [🔍 Search boards]  [+ New board]│
│ Recent ─────────────────────────────────────────────────────  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                            │
│ │thumb │ │thumb │ │thumb │ │thumb │   card: title, edited 2h ago,│
│ │      │ │      │ │      │ │      │   avatars, ⋯ (Rename, Duplicate,│
│ └──────┘ └──────┘ └──────┘ └──────┘   Copy link, Delete)         │
│ All boards (sort: Last edited ▾) grid / list toggle            │
└───────────────────────────────────────────────────────────────┘
```
Delete shows the toast "Board deleted · **Undo**" (10 s). Boards are purged after 30 days, and a "Recently deleted" filter allows restoring them.

### 7.4 Share dialog
```
┌ Share "Rate limiter" ─────────────────────────────── ✕ ┐
│ Anyone with the link  [ Can request pen ▾ ]            │
│ https://archboard…/join/k3J…        [ Copy link ]      │
│ Expires in [ 7 days ▾ ]          Revoke link           │
│ ─────────────────────────────────────────────────────  │
│ People                                                  │
│ (◉) Ashutosh (you)                 Owner                │
│ (◉) Priya · guest                 [Can request pen ▾] ✕ │
│ ─────────────────────────────────────────────────────  │
│ [ ] Lock board — no new people, no pen requests         │
└─────────────────────────────────────────────────────────┘
```
"Revoke link" asks for inline confirmation ("Revoke? People using it will be removed. **Revoke** · Cancel"). Removing a person can be undone from the toast for 5 s (it's applied on the server after the undo window).

### 7.5 Join (`/join/:code`)
A card showing the board title, owner name and avatar, and the role ("You'll join as a viewer who can request the pen"), a **Your name** input (remembered), **Join board**, and "or sign in to keep it in your dashboard". An invalid link shows "This link has expired or was revoked. Ask the owner for a new one."

### 7.6 Replay
A full-width read-only canvas plus a bottom transport bar: ⏮ ▶ ⏭, speed, a time scrubber with markers, current time, and author avatars along the track. An "At this moment" side panel shows who had the pen and the current phase.

---

## 8. States, feedback and errors

| Surface | Loading | Empty | Error | Offline |
|---|---|---|---|---|
| Board | Skeleton header + palette shimmer. The canvas shows the IndexedDB copy instantly if present, otherwise a centred spinner after 300 ms (none before, to avoid flashing) | Centred hint + 3 suggestion chips | Full-page card: "We couldn't open this board" with the cause plus **Try again** / **Go to dashboard** | Top banner (amber): "Offline — changes will sync when you reconnect" + retry countdown |
| Dashboard | 8 card skeletons | Illustration: "No boards yet" + **New board** + template strip | Inline card with retry | Banner; cached list shown read-only |
| Palette | Skeleton rows while a pack loads | "No components match 'xyz'. Try 'cache' or 'queue'." | "Icons failed to load — **Retry**" (generic blocks still work) | Generic blocks only + note |
| Comments | Thread skeletons | "No comments yet. Select a component and press C." | Retry inline | Composer disabled: "You're offline" |
| Replay | Progress bar "Loading history 40%" | "Nothing to replay yet — history appears as you edit." | Retry | Disabled with explanation |
| Templates | Card skeletons | n/a | Retry | Cached |

**Save pill states:** `● Saved` (green) · `◌ Saving…` (neutral, shown only if saving takes over 400 ms) · `▲ Offline — changes will sync` (amber) · `✕ Couldn't save — retrying…` (red, with an expandable "Details") · `Saved on this device` (local boards).

**Close code → message** (what the user sees):
| Code | Message | Action |
|---|---|---|
| 4401 | (none: silent re-auth); if that fails, "Your session expired." | **Sign in again** |
| 4403 | "You no longer have access to this board." | Go to dashboard |
| 4404 | "This board doesn't exist or was deleted." | Go to dashboard |
| 4409 | "The owner locked this board." | — |
| 4410 | "This link has expired or was revoked — ask the owner for a new one." | — |
| 4400 | "ArchBoard was updated — reload to continue. Your work is safe." | **Reload** |
| 1013 / network | "Reconnecting…" (shown after 2 s) | auto, backoff |

**Toasts:** bottom-centre on desktop, top on phone. Max 3 stacked, 4 s default, 10 s for undo toasts, pausing on hover. They're announced via an `aria-live="polite"` region (`assertive` for errors).

**Destructive actions:** delete board (undo toast + 30-day restore), remove member (undo toast), revoke link (inline confirm), delete selection (undo), "Discard offline changes" (confirm dialog).

---

## 9. Accessibility (WCAG 2.1 AA for chrome)
- Radix primitives for dialogs, menus, popovers, tabs and tooltips give focus trapping, roving tabindex and Esc handling.
- Visible focus ring everywhere: 2 px `--focus` outline + 2 px offset, never removed.
- Contrast: body text ≥ 4.5:1, large text and UI glyphs ≥ 3:1, verified by tokens tests and axe.
- **Canvas keyboard access:** Tab moves focus into the canvas; when the canvas is focused, Tab/⇧Tab cycle nodes in reading order (top-left → bottom-right), Enter renames, arrows nudge, and ⌘⇧O opens the **Outline view**.
- **Outline view:** a side panel listing groups → components → connections as a tree ("Load Balancer 1 → URL service, sync, HTTP"). It's fully navigable, selecting an item focuses it on the canvas, and pen holders can rename and delete from the list.
- Live regions announce pen changes, phase changes, new comments (count only) and save failures.
- Respect `prefers-reduced-motion`: no follow-mode easing (jump instead), no reaction float (fade only), no landing animation.
- Touch targets ≥ 44×44 px on tablet and phone, and ≥ 32 px on desktop chrome.

---

## 10. Design tokens (`packages/ui/tokens`)

### 10.1 Colour (semantic; values are light / dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#0E1014` | app chrome |
| `--bg-subtle` | `#F6F7F9` | `#14171C` | panels |
| `--canvas` | `#F7F8FA` | `#0B0D11` | canvas background |
| `--canvas-dot` | `#D3D8E0` | `#262B34` | grid dots |
| `--surface` | `#FFFFFF` | `#181B21` | cards, nodes, popovers |
| `--surface-raised` | `#FFFFFF` | `#1F232A` | menus, dialogs |
| `--border` | `#E3E6EB` | `#2A2F38` | default borders |
| `--border-strong` | `#C9CED6` | `#3A404B` | inputs, node borders |
| `--text` | `#14171C` | `#E8EAEE` | primary text |
| `--text-muted` | `#5B6370` | `#9AA2AF` | secondary (4.6:1 / 6.1:1) |
| `--text-faint` | `#8A919C` | `#6B7380` | placeholders (non-essential only) |
| `--accent` | `#2B59C3` | `#7EA2F2` | primary actions, selection |
| `--accent-hover` | `#234AA6` | `#9AB6F5` | |
| `--accent-subtle` | `#E9EFFB` | `#1A2440` | selected backgrounds |
| `--on-accent` | `#FFFFFF` | `#0E1014` | text on accent |
| `--pen` | `#D97706` | `#F5A524` | pen holder chip and badge, presenter ring |
| `--pen-subtle` | `#FEF3E2` | `#2E2210` | |
| `--success` | `#1F8A4C` | `#4CC38A` | saved |
| `--warning` | `#B26B00` | `#E8A23B` | offline |
| `--danger` | `#C8312B` | `#F2726B` | errors, destructive |
| `--focus` | `#2B59C3` | `#9AB6F5` | focus ring |
| `--guide` | `#E0368A` | `#F06AAE` | alignment guides |

Group tints (12% fill, 60% border, dashed for logical boundaries): Region `slate`, AZ `teal`, VPC `blue`, Subnet `violet`, K8s `indigo`, Boundary `neutral`. Note colours: yellow, blue, green, pink, grey. **Presence colours:** 8 colour-blind-distinguishable hues (Okabe–Ito-derived), assigned deterministically per principal.

The export theme uses the light palette with a white or transparent background, no grid, and 32 px padding. Icons always use their original brand colours.

### 10.2 Typography
**Geist Sans** for UI and **Geist Mono** for numbers in the calculator and protocol tags (both OFL, self-hosted, `font-display: swap`, subset to Latin).

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `text-xs` | 12 / 16 | 500 | badges, captions |
| `text-sm` | 13 / 18 | 400 | node labels, secondary UI |
| `text-base` | 14 / 20 | 400 | default UI |
| `text-md` | 16 / 24 | 500 | panel titles, inputs on touch (prevents iOS zoom) |
| `text-lg` | 20 / 28 | 600 | dialog titles |
| `text-xl` | 24 / 32 | 600 | page titles |
| `text-2xl` | 32 / 40 | 650 | dashboard hero |
| `text-display` | 48 / 52 (clamp 34→48) | 700, −0.02em | landing headline |

Tabular numbers in timers, the calculator and zoom percentage.

### 10.3 Spacing, radius, elevation
- Spacing scale (4 px base): `0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Panels use 16 px padding, controls 8 px gaps, sections 24 px.
- Radius: `sm 4` (badges), `md 6` (buttons, inputs), `lg 8` (nodes, cards), `xl 12` (dialogs, sheets), `full`.
- Elevation (light; dark uses border + darker shadow): `e1 0 1px 2px rgb(16 24 40 / .06)` (nodes), `e2 0 4px 12px rgb(16 24 40 / .08)` (floating toolbar, popovers), `e3 0 12px 32px rgb(16 24 40 / .14)` (dialogs).
- Control heights: 32 px desktop, 40 px touch (44 px hit area).

### 10.4 Motion
`--dur-1: 100ms` (hover, press) · `--dur-2: 160ms` (popovers, toasts) · `--dur-3: 240ms` (drawers, sheets) · `--ease-out: cubic-bezier(.2,.8,.2,1)` · `--ease-in-out: cubic-bezier(.4,0,.2,1)`. Follow-mode viewport easing is 300 ms. Under `prefers-reduced-motion: reduce`, all durations are 0 except opacity fades of ≤ 100 ms.

### 10.5 Component node anatomy
```
┌──────────────────────────────┐   min 152×56, grows with label (max 2 lines, then ellipsis + tooltip)
│ [icon 32]  URL service        │   label text-sm 500; provider badge (AWS/GCP/AZ) text-xs top-right when not generic
│            ×3 · ap-south-1   │   meta line text-xs muted (only if replicas/region set)
└──────────────────────────────┘   1px --border-strong, radius lg, e1; selected: 2px --accent + accent-subtle halo
   handles: 10px dots on 4 sides, visible on hover/selected; hit area 24px (44px touch)
```

### 10.6 Core components in `packages/ui`
Button (primary / secondary / ghost / danger; sm / md / touch), IconButton (requires `aria-label` and a tooltip), Input, Textarea, Select, SegmentedControl, Switch, Checkbox, Tooltip, Popover, DropdownMenu, ContextMenu, Dialog, AlertDialog, Sheet (side + bottom), Toast, Tabs, Avatar + AvatarStack, Badge, Kbd, Skeleton, EmptyState, Banner, CommandPalette (cmdk), SearchField, StatusPill. Each has a Storybook-free **`/dev/ui` gallery route** (dev builds only), used for visual regression screenshots in both themes.

---

## 11. Onboarding
- **Tour** (first board only, after the first node exists or 10 s idle): 5 steps with spotlight + popover: (1) Palette & search, (2) Connect by dragging a handle, (3) Properties panel, (4) Share & pen, (5) `?` for shortcuts. Skip is always visible, and Esc skips. Dismissal is stored per user (server) or per device (guest) and never shown again. It can be restarted from Help.
- A **`?` button** in the bottom-left opens the shortcuts panel, plus links to "Take the tour" and "What's pass the pen?".

---

## 12. Usability acceptance (checked at every phase review)
1. A new user draws LB → Service → DB with a rename in under 60 s without help (I'll script this as a Playwright journey and time it).
2. Every disabled control explains why on hover, focus or tap.
3. Every async action has visible pending, success and failure states.
4. No horizontal scroll at 375 / 768 / 1024 / 1440 px. No control under 44 px on touch.
5. Every action is reachable from ⌘K.
6. Pulling the network mid-edit never loses an edit (Playwright offline test).
7. axe: 0 serious or critical violations on every screen in both themes.
