# Changelog

## Phase 1: Foundations (2026-11-21)

**Monorepo and tooling**
- pnpm workspaces + Turborepo; TypeScript 6 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); ESLint 9 flat config with jsx-a11y; Prettier; exact version pinning.
- `pnpm audit` is clean. `effect` is overridden to 3.22.5 to patch a ReDoS (GHSA-7589-6fvf-x4pw) pulled in by `@prisma/config`.

**Packages**
- `shared`: error hierarchy (RFC 9457-ready), Zod env loader that lists every problem at once, pino logger with redaction, traversal-safe local storage provider.
- `diagram-schema`: DiagramV1 Zod schema; cross-field integrity checks with path-specific human messages; Y.Doc converters; diagram ops (add with no-overlap placement, connect, delete with cascade, group/ungroup/reparent without visual jumps, copy/paste/duplicate across boards, align/distribute); capacity calculator; clipboard format. 30 tests, including a 1,000-case round-trip property test.
- `protocol`: versioned WebSocket control messages (Zod), binary message ids, close codes with the exact UI copy for each.
- `db`: Prisma 7 schema (users, boards, members, invites, guests, update log, snapshots, events, comments, interview sessions, templates, AI jobs), initial migration, idempotent seed.
- `icons`: 21 original generic icons with ≥ 3 aliases each; ranked fuzzy search (`lb`/`elb`/`load balancer` → Load Balancer); registry builder (SVGO, id prefixing); vendor import pipeline with SHA-256 pinning and zip-slip protection; per-provider filename normalisers.
- `ui`: design tokens (light and dark, WCAG AA-checked), Tailwind v4 theme, Geist fonts, and these components: Button, IconButton (mandatory label, shortcut tooltip, explains why it's disabled), form controls, Field, SegmentedControl, Select, Tabs, Badge, Kbd, Skeleton, Banner, StatusPill, EmptyState, Tooltip, Popover, DropdownMenu, ContextMenu, Dialog, ConfirmDialog, Sheet (side and bottom), Avatar/AvatarStack with pen badge, Toaster and undo toasts, CommandPalette, ThemeProvider, Clerk appearance.

**Apps**
- `web`: Vite + React 19 + React Router, theme bootstrap with no flash, `/dev/ui` design-system gallery (dev only), error pages.
- `api`: Express 5 app factory, Helmet, request ids, liveness and readiness (DB + Redis, with a 2 s timeout), problem+json errors, graceful shutdown. 8 tests.
- `sync`: WebSocket server skeleton with health endpoints, origin check, WS echo for uptime checks, graceful "try again" close on shutdown. 6 tests.

**Quality**
- Playwright + axe at 4 viewports in light and dark: 20 checks (0 serious/critical violations, no horizontal scroll, keyboard and focus paths).
- GitHub Actions: lint/typecheck/unit/audit; migrations applied to a real Postgres, plus a drift check and a double seed; e2e.
- ADR-001 (Yjs vs OT), ADR-003 (Postgres vs MongoDB), ADR-006 (React Flow vs custom canvas).

### Phase 1 follow-up: vendor icons (2026-11-21)
- Imported the official AWS (2026-07-31, 303 service icons) and Azure (V25, 643 icons) packs after the owner accepted both providers' terms. SHA-256 hashes are pinned in `packages/icons/sources.json`. Raw packs stay out of git.
- Registry: 967 icons in total. Labels keep vendor casing ("Amazon CodeGuru", "AKS Automatic"). Fixed Azure's stray-space file name and the "new icons" pseudo-category.
- Renamed the package script to `import-packs`, because `pnpm import` is a built-in pnpm command and silently shadowed it. `pnpm icons:import` works again.
- New tests against the real registry: unique ids, every SVG present, and search finds S3, SQS, Lambda, DynamoDB, Azure Load Balancers, Kubernetes and VMs, with the generic blocks still ranked first. 42 icon tests in total.
- The design-system gallery shows a sample of provider icons, for visual checks.

## Phase 2 (in progress)

### Slice 1: whiteboard with component panel
Local boards with IndexedDB autosave; a component panel (search, aliases, provider tabs, recents, click or drag); connections, rename, delete with per-delete undo, keyboard shortcuts; phone/tablet sheets.

### Slice 2: properties, groups, drawing tools, Google Cloud
- Contextual properties panel and tradeoff hint cards for all 21 generic components.
- Groups (6 container types): G menu, drag in/out, resize, ungroup; align and distribute.
- Connection labels, sync/async styles, protocol tags (HTTP, gRPC, WebSocket, TCP, Pub/Sub), arrow options.
- Diagram schema v1 gains `shape` and `drawing` node kinds (still format version 1; additive). Pen, shape and text-box tools.
- Google Cloud icons: 2025 core + legacy packs (226), with multi-pack support in the importer. The registry now has 1,193 icons.
- Fixes: frozen recents order, Shift-click multi-select, text-box focus, no unexpected zoom on first add, atomic icon build.
- Tests: 8 new e2e scenarios (groups, drag in/out, properties, connections, pen, shapes, text, GCP); 60 e2e checks pass.

### Slice 3: feedback fixes
- Pen: strokes keep exactly the drawn shape on release (grid snapping no longer applied to ink).
- Box (R) and Circle (O) tools; drawn shapes open for typing immediately.
- Components: resizable cards with text on the card (schema: optional `size` and `data.description`, additive).
- Sturdier focus for new editors; drawing no longer depends on pointer capture.
- Tests: pen fidelity, box/circle typing, component text and resize across reload; 68 e2e checks pass.

### Slice 4: capacity calculator, board policy, landing page, deployment
- Capacity calculator (E): live QPS/storage/bandwidth with formulas; inputs saved with the board; attach to a component or add as a note.
- Board policy: one board per person, auto-deleted after 7 days; countdown badge, delete-board action, clear messages for expired boards.
- Landing page with real product screenshots (light/dark), roadmap clearly separated, OG/Twitter tags, robots.txt, sitemap.
- Production: Caddyfile (strict CSP with no inline scripts, HSTS, caching), VM startup script, deploy and rollback scripts, deploy workflow.
