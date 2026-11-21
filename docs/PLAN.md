# ArchBoard — Delivery Plan

Status: **Draft v1 — awaiting approval** · Last updated: 2026-11-21
See [DESIGN.md](DESIGN.md) and [UX.md](UX.md).

## How each phase runs
- Branch `feat/phase-N-<slug>` off `main`, with conventional commits. The phase ends with a PR into `main` once you're happy with it.
- **Definition of done for every phase:**
  - [ ] Code builds; `pnpm lint`, `pnpm typecheck`, `pnpm test` are green locally and in CI
  - [ ] New behaviour has tests (unit / integration / e2e as appropriate)
  - [ ] **Usability self-review:** core journeys walked at 375 / 768 / 1024 / 1440 px with Playwright screenshots saved under `docs/reviews/phase-N/`, with a list of every rough edge found and how it was fixed (or why it was deferred)
  - [ ] README updated; phase summary appended to `docs/CHANGELOG.md`
  - [ ] No secrets committed; `.env.example` updated
- 🔒 = **needs your explicit approval before I run it** (touches the VM, GCP, DNS, or costs money).

## Open decisions (please answer before or at the relevant phase)
| # | Decision | My recommendation | Needed by |
|---|---|---|---|
| D1 | ~~Edge proxy~~ | **Decided 2026-11-21:** dedicated VM, so ArchBoard's own Caddy owns 80/443 | — |
| D2 | ~~VM sizing~~ | **Decided:** new `archboard-vm`, e2-medium, asia-south1-a (≈ $37–40/mo all-in); UptimeHQ VM untouched | — |
| D3 | ~~VM scopes~~ | **Resolved:** service account attached at creation, no VM stop needed | — |
| D4 | GitHub repo name and visibility | `archboard`, **public** | Phase 1 (CI) |
| D5 | GCP project: the same one as UptimeHQ, or a new one? | Same project, `archboard-*` resource prefix (simpler billing and IAM); a new project gives cleaner isolation | Phase 7 |
| D6 | Monthly billing budget alert amount | $50 (covers the VM with margin) | Phase 7 |
| D7 | Icons: download official packs at build time rather than committing raw SVGs | **Yes** | Phase 1 |
| D8 | Region `asia-south1` (Mumbai): are most of your users and interviewers in India? | Yes → Mumbai; otherwise pick the region nearest them | Phase 7 |
| D9 | Upgrade the billing account from free trial to paid before ~day 80 (remaining credits carry over), so neither VM is stopped at trial end | **Yes**: calendar reminder + budget alert | before trial day 80 |

---

## Phase 1: Foundations (monorepo, schemas, icons, design system)
**Goal:** everything later phases stand on, including a design system you can look at.

- [x] `git init`, pnpm workspace, Turborepo pipelines (`build`, `dev`, `lint`, `typecheck`, `test`), Node 22 pinned via `.nvmrc` + `packageManager`
- [x] `packages/config`: tsconfig bases (strict), ESLint flat config (typescript-eslint, react, jsx-a11y, import), Prettier
- [x] `packages/shared`: Zod env loader, pino logger, `AppError` hierarchy, id helpers, `StorageProvider` interface (local-disk + GCS impls)
- [x] `packages/diagram-schema`: DiagramV1 Zod schema + cross-field refinements, Y.Doc converters, diagram ops (`addNode`, `connect`, `group`, `findFreeSpot`, `autoName`, `duplicate`, `align`…), property tests (fast-check) for round-trips
- [x] `packages/protocol`: control-message schemas + close codes + error codes
- [x] `packages/db`: Prisma schema from DESIGN §5, initial migration, seed script (sample user, 2 boards)
- [x] `packages/icons`: `scripts/import-icons.ts` (downloads official AWS / GCP / Azure packs from documented URLs, checks SHA-256, normalises to `{id, provider, category, label, aliases, svgPath}`, optimises with SVGO, builds sprite sheets per provider + search index); hand-made generic block set (21 icons) in our visual style; alias table (`lb/elb/alb → load balancer` …) — AWS + Azure imported; Google Cloud pending
- [x] `docs/ICONS.md`: each provider's licence and usage terms, source URLs, version, and what we redistribute — AWS + Azure recorded; Google Cloud terms still TODO
- [x] `packages/ui`: tokens (CSS variables, light + dark), Tailwind preset, shadcn/Radix components from UX §10.6, Clerk appearance theme, `/dev/ui` gallery route
- [x] `infra/compose/compose.dev.yml`: postgres, redis, api and sync with hot reload (tsx watch); `pnpm dev` runs Vite
- [x] `apps/api` / `apps/sync` / `apps/web` skeletons: health endpoints, logger, env validation, one test each
- [x] GitHub Actions CI skeleton: install (cached), lint, typecheck, unit tests, build; real-Postgres migration + drift + seed job (Testcontainers suites start in Phase 3)
- [x] Draft ADR-001 (Yjs vs OT), ADR-003 (Postgres vs Mongo), ADR-006 (React Flow vs custom canvas)

**Acceptance**
- [x] `docker compose -f infra/compose/compose.dev.yml up` + `pnpm dev` from a fresh clone works by following the README alone — verified: dev image + src mounts, healthy against Postgres/Redis, hot reload works on Windows
- [x] `/dev/ui` shows every component in both themes, with axe reporting 0 violations
- [ ] Icon registry: ≥ 95% of the provider icons imported, every generic block has ≥ 3 aliases, search for `lb`/`elb`/`load balancer` returns the same top result (unit test) — AWS 303 + Azure 643 imported (Google Cloud pending a download link)
- [x] DiagramV1 round-trip property test runs 1,000 cases green; invalid fixtures produce path-specific error messages
- [ ] `prisma migrate dev` from empty → seeded works; CI green — local verified; CI runs on first push

---

## Phase 2: Single-user canvas, polished (largest phase)
**Goal:** a local board (IndexedDB, no server) that feels finished. Everything in UX §4–§6 that doesn't need a second user.

- [ ] Board shell: header (title inline rename, save pill), collapsible left palette and right panel, floating toolbar, minimap, error boundaries per panel
- [ ] React Flow integration: Y.Doc → Zustand projection with per-frame coalescing; memoised custom nodes (component, group, note, text) and edges (smooth-step, label pill, sync/async, protocol tag, arrows)
- [ ] Palette: fuzzy search + aliases, provider filters, favourites, recents, drag-to-place (ghost + snap preview), click-to-add with `findFreeSpot`, lazy provider packs
- [ ] Quick-add popover (`/`, double-click, drop-to-connect)
- [ ] Connecting: hover handles, magnetic targets, drop-on-empty → quick-add + auto-connect, reconnect endpoints, duplicate-edge prevention
- [ ] Inline rename, properties panel per selection type, tradeoff hint cards for all 21 generic types
- [ ] Selection: click, Shift-click, box select, select all; nudge; delete with undo toast
- [ ] Groups: create via `G` menu, drag in and out with re-parenting, resize, nest, ungroup
- [ ] Snap to grid + alignment guides (toggle, Alt to bypass); align/distribute; zoom to fit and to selection
- [ ] Undo/redo via Y.UndoManager (drag merging, multi-op transactions)
- [ ] Copy/paste/duplicate (system clipboard, across boards and tabs), context menu
- [ ] Command palette (cmdk) with every action; `?` shortcuts panel; keyboard map from UX §6
- [ ] Notes and free text
- [ ] Autosave to IndexedDB + save pill; `/new` chooser (blank + templates placeholder)
- [ ] Export PNG/SVG (transparent, padding, scale, selection only) with live preview; JSON export; JSON import with validation errors shown per item
- [ ] Outline view (accessible tree) with keyboard focus management
- [ ] Responsive: tablet drawers + touch gestures + long-press menu + select toggle; phone layout with bottom sheets and tap-to-connect mode
- [ ] Empty, loading and error states for board, palette and import
- [ ] Light/dark theme toggle (system default)
- [ ] Perf harness: a `?perf=300` dev flag that generates 300/500/1,000 node boards; React profiler + FPS meter

**Acceptance**
- [ ] Playwright journey J1 (LB → Service → DB + rename) passes at desktop, tablet and phone, under 60 s scripted, with no help text needed
- [ ] Undo/redo e2e covers add, move, connect, rename, group, delete, paste, import
- [ ] 300-node board: pan, zoom and drag ≥ 55 fps average on the CI perf runner (budget recorded in `docs/PERFORMANCE.md`)
- [ ] Export: PNG/SVG visual snapshots match baselines (light, dark, transparent)
- [ ] Import: 10 malformed fixtures show human-readable errors; valid ones round-trip byte-equal
- [ ] axe 0 serious/critical on the editor in both themes; keyboard-only user can add, connect, rename and delete via ⌘K + outline
- [ ] Reload mid-edit restores the exact state from IndexedDB

---

## Phase 3: Auth, dashboard, sharing, roles
- [ ] Clerk in the SPA (dev instance), themed sign-in modal, protected routes, user button
- [ ] API: `@clerk/express`, JIT user upsert, Clerk webhook with svix verification and idempotency
- [ ] Boards CRUD + soft delete/restore + duplicate + rename; members; invites (hashed codes, expiry, revoke); guest accept → `ab_guest` EdDSA cookie
- [ ] Rate limiting (Redis), Helmet, problem+json errors, request ids, Zod everywhere
- [ ] Dashboard (thumbnails, search, recent, sort, grid/list, delete with undo, recently deleted)
- [ ] "Keep this board" flow after sign-in (local → server upload, validated)
- [ ] Share dialog (link role, expiry, copy, revoke, people list, remove with undo, lock)
- [ ] `/join/:code` page with all invalid/expired/locked states
- [ ] Supertest + Testcontainers integration suite (authz matrix: owner/editor/viewer/guest/stranger × every route)

**Acceptance**
- [ ] Authz matrix test: every route × every principal returns the expected status (generated table, 100% covered)
- [ ] Webhook: bad signature → 400; replayed `svix-id` → no-op; delete → PII scrubbed
- [ ] Invite: expired → 410 with the right UI message; revoked → existing guest cookie rejected within 30 s
- [ ] e2e: sign in (Clerk testing token) → create → share → guest joins (second browser context) → appears in the people list
- [ ] J7 (keep guest board) passes

---

## Phase 4: Sync server, presence, pass the pen
- [ ] `apps/sync`: ws server, upgrade auth (Clerk JWT / guest cookie), origin check, connect rate limit, `hello`, protocol version negotiation
- [ ] Room manager: load snapshot + updates, idle unload, Redis pub/sub fan-out for updates and awareness, gap detection + Postgres catch-up
- [ ] Durable update protocol (`MSG_UPDATE` + batched persist + `ack`), seq assignment, save pill wired to acks
- [ ] Pen lease Lua scripts (acquire / renew / transfer / release / resume), heartbeat, expiry watcher with fencing, events to `BoardEvent`
- [ ] Update rejection for non-holders; offline-edits conflict flow (Save as copy / Discard)
- [ ] `auth.refresh` loop; ACL change handling via `acl:{id}`; close-code → UI mapping
- [ ] Awareness UI: cursors with names, selection outlines, follow mode (default on for viewers) + "Follow X" pill, laser, reactions
- [ ] Header: presence avatars, pen chip and popover, Request pen → Accept/Decline card, toasts
- [ ] Read-only UI states (UX §5.7) everywhere
- [ ] Reconnect with backoff + jitter; offline banner; IndexedDB queue; viewer instant catch-up
- [ ] Thumbnail generation (presenter, debounced) → API
- [ ] Two sync instances in dev compose to exercise pub/sub locally

**Acceptance (integration tests against real Redis + Postgres, 2 sync instances)**
- [ ] 3 clients across 2 instances converge after 1,000 random ops (fuzz test)
- [ ] Non-holder update → rejected, not persisted, not broadcast
- [ ] Presenter killed → `pen.expired` within 15–17 s → pen to owner (or view-only when the owner is offline)
- [ ] Presenter blip of 5 s → keeps the pen, queued edits persist, no duplicates
- [ ] Lease race: two simultaneous requests + accept → exactly one holder (repeat 500×)
- [ ] Clerk token expiry: socket survives 10 min with refreshes; no refresh → 4401 → silent reconnect
- [ ] Invite revoked mid-session → guest socket closed with 4410 and the UI shows the right message
- [ ] e2e: full handoff journey (J2, J3, J4) across 3 browser contexts at desktop + phone
- [ ] p95 local edit → viewer render < 150 ms (measured in e2e via stamped updates)

---

## Phase 5: Comments, interview mode, templates, onboarding, landing
- [ ] Comments: threads pinned to nodes or the board, replies, resolve, @mentions, unread badges, live via `comment.event`; phone bottom sheet
- [ ] Interview mode: problem statement, requirements checklist, server-authoritative phase timer (server time offset), owner controls, phase-change toasts + events
- [ ] Capacity calculator (pure function + tests) with formulas on hover, "Attach to component"
- [ ] 8 templates in DiagramV1 (URL shortener, rate limiter, news feed, chat, ride sharing, video streaming, notification system, web crawler): polished layouts, groups, labelled edges, notes; seeded; gallery with thumbnails
- [ ] `/new` chooser complete; template insertion as one undo step
- [ ] Onboarding tour (5 steps, skippable, persisted dismissal) + help menu
- [ ] Landing page: prerendered, meta + OG image, poster → lazy interactive demo board, feature tiles, template strip
- [ ] Draft ADR-002 (pass-the-pen) and ADR-004 (Clerk)

**Acceptance**
- [ ] Calculator unit tests vs hand-computed reference cases (≥ 10)
- [ ] All 8 templates validate against DiagramV1, have no overlapping nodes (automated check), and pass visual snapshots
- [ ] Timer stays consistent across 3 clients with skewed clocks (±5 min fake clock) to within 1 s
- [ ] Landing: Lighthouse ≥ 95 performance / 100 accessibility / 100 SEO on mobile emulation
- [ ] Tour never reappears after dismissal (server + local tests)

---

## Phase 6: Session replay and compaction
- [ ] Checkpoint writer (every 200 updates), snapshot compaction job with Redis lock, GCS offload > 256 KB
- [ ] Replay index + binary updates stream endpoints (authz, paging)
- [ ] Replay page: transport controls, speed, scrubber with markers (pen, phases, AI, import), author track, "Open as new board at this point"
- [ ] Retention job (90-day raw → per-minute checkpoints)

**Acceptance**
- [ ] Replaying any board to its end produces a doc byte-equal to the live state (property test over random histories)
- [ ] Scrubbing to any point on a 20k-update board takes < 300 ms
- [ ] Compaction under concurrent writes loses nothing (integration test)
- [ ] e2e J5 at desktop + phone

---

## Phase 7: Deployment on a dedicated VM
- [ ] Production Dockerfiles (multi-stage, distroless, non-root, read-only FS) + `compose.prod.yml` / `compose.staging.yml` with limits from DESIGN §9.4
- [ ] Edge Caddyfile (prod + staging, security headers, CSP, caching, health-checked upstreams) + `archboard-edge` compose project
- [ ] cloud-init template for `archboard-vm` (Docker pinned, AR credential helper, swapfile, unattended security upgrades, log caps, directory layout)
- [ ] Terraform: state bucket, VM + static IP + snapshot schedule, firewall (web + IAP-only SSH), AR, buckets, SAs, WIF, secrets (placeholders), budget, uptime checks, `loadtest` module (plan only in CI)
- [ ] GitHub Actions: image build → Trivy → push (WIF); staging deploy on `main` via IAP SSH; prod on tag with manual approval; rollback workflow
- [ ] `deploy` / `rollback` / `backup` / `restore` scripts; sudoers allows only `/opt/archboard/bin/deploy` for the CI identity
- [ ] Observability: metrics endpoints, OTel, self-hosted Prometheus + Grafana (provisioned dashboards + alert rules), Sentry (web + node, source maps)
- [ ] `docs/RUNBOOK.md` (deploy, rollback, restore, rotate secrets, resize VM, incident checklist) + ADR-005, ADR-007, ADR-008
- [ ] 🔒 You confirm the GCP project (D5) and region (D8); I enable the needed APIs only after you approve
- [ ] 🔒 `terraform apply` (you run it, or approve me running it), after reviewing the plan; this creates the VM and starts billing (≈ $37–40/mo)
- [ ] 🔒 You add the DNS records from DESIGN §9.8 at Hostinger (A records point at the new IP from `terraform output`)
- [ ] 🔒 Set secret values in Secret Manager (you, or me with values you provide out of band)
- [ ] 🔒 Clerk production instance: domain, your Google + GitHub OAuth apps, webhook endpoint
- [ ] 🔒 First staging deploy → smoke → first prod deploy
- [ ] UptimeHQ monitors added for ArchBoard (in UptimeHQ's UI; no change to its VM); Cloud Monitoring uptime checks for both apps ("who monitors the monitor")
- [ ] Monthly automated restore test workflow

**Acceptance**
- [ ] `terraform destroy -target` of a scratch copy + `apply` rebuilds a working VM from nothing (proves the VM is fully reproducible; run on the `loadtest` clone, never prod)
- [ ] UptimeHQ is not touched at any point (no SSH sessions to `uptime-hq` in Phase 7)
- [ ] Deploy causes no dropped edits: an e2e presenter session runs during a rolling deploy with 0 lost updates
- [ ] `rollback prod` returns to the previous tag (containers + SPA) in < 2 min
- [ ] Backup → restore into a scratch container verified; procedure in RUNBOOK
- [ ] Images < 120 MB each, Trivy 0 HIGH/CRITICAL with a fix available
- [ ] No public SSH: port 22 reachable only via IAP (verified with an external port check)
- [ ] securityheaders.com grade A; SSL Labs A

---

## Phase 8: Hardening
- [ ] Full e2e matrix (every core journey × desktop/tablet/phone) + visual regression of key screens (light + dark)
- [ ] axe + Lighthouse CI budgets that fail the build (editor and landing)
- [ ] Performance pass: 300 / 500 / 1,000 node profiling, results + methodology in `docs/PERFORMANCE.md`
- [ ] 🔒 Load test on temporary spot VMs (< $1): 50 rooms × 30 clients across 2 sync instances; results in `docs/LOAD_TEST.md`
- [ ] Security review: `docs/THREAT_MODEL.md` (STRIDE per boundary), fuzz WS control messages, payload limit tests, dependency audit
- [ ] Docs: README with screenshots, demo GIF, architecture diagram; all ADRs final
- [ ] Manual exploratory pass on a real phone and tablet (you, if possible, plus my emulation pass)

**Acceptance**
- [ ] All CI gates green and enforced on `main`
- [ ] Load test report with p50/p95/p99 broadcast latency, msgs/s, CPU/RAM per container
- [ ] Zero known P1/P2 bugs; P3s listed in issues

---

## Phase 9: AI architecture agent (after MVP sign-off)
- [ ] `LlmProvider` interface + Claude implementation (tool use: `emit_diagram`, `search_icons`), keys from Secret Manager
- [ ] BullMQ queue + worker container (memory-limited), job API + SSE progress
- [ ] Validate → feed back errors → retry (max 3); ELK.js layout honouring groups
- [ ] UI: "Generate with AI" on `/new` and a board panel; progress steps; preview vs apply; single-transaction apply (one undo step, replay marker)
- [ ] Guardrails: per-user daily limit, global token budget, redacted logs, cost dashboard panel
- [ ] Eval set (20 prompts) nightly: schema validity, expected components, zero overlap
- [ ] 🔒 LLM API key and spending cap (your account)

**Acceptance**
- [ ] ≥ 19/20 eval prompts produce valid diagrams with the expected components
- [ ] Generated diagrams have no overlaps and respect groups
- [ ] Budget exhaustion shows a friendly state, never a raw error

---

## Rough sizing (relative effort)
Phase 1 ▓▓▓ · **Phase 2 ▓▓▓▓▓▓▓** · Phase 3 ▓▓▓ · Phase 4 ▓▓▓▓▓ · Phase 5 ▓▓▓▓ · Phase 6 ▓▓ · Phase 7 ▓▓▓▓ · Phase 8 ▓▓▓ · Phase 9 ▓▓▓▓
