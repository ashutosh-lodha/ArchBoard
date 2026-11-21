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
