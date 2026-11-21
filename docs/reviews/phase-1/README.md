# Phase 1 usability self-review

Date: 2026-11-21 · Scope: the design-system gallery (`/dev/ui`) and placeholder home page. Phase 1 has no user journeys yet; the editor arrives in Phase 2.

Screenshots in this folder come from the Playwright suite (`pnpm test:e2e`) at 375 px (phone, touch), 768 px (tablet, touch), 1024 px and 1440 px, each with a light and a dark system theme. Every run also checks axe (WCAG 2.1 A/AA, serious and critical), horizontal overflow, keyboard paths and the theme toggle.

## Rough edges found and fixed

| # | Found | Fix |
|---|---|---|
| 1 | axe: "faint" text (shortcut hints, panel labels) at 3.2:1 on white and 4.3:1 on hovered rows | `--text-faint` darkened to #646B77 (light) and #8F97A3 (dark), ≥ 4.5:1 on every surface |
| 2 | axe: pen-coloured text on the pen tint at 4.2:1 ("Request pen", "Priya has the pen") | Split into `--pen` (text, #9A4F00) and `--pen-strong` (fills, #D97706) |
| 3 | axe: green "Saved" badge at 3.9:1 | `--success` darkened to #177040 |
| 4 | axe: white initials on bright presence colours (2.3:1 on sky blue) | Initials now pick white or near-black by contrast (`readableTextOn`); the violet that failed both was replaced; a unit test checks all 8 colours are ≥ 4.5:1 |
| 5 | axe (critical): inputs inside `Field` weren't linked to their labels | `Field` now passes `id`, `aria-describedby` and `aria-invalid` to its control automatically |
| 6 | Phone header: title wrapped to 3 lines and was clipped | Title truncates; "Command palette ⌘K" collapses to a labelled search icon below 640 px |
| 7 | Generic component labels truncated ("Load B…") in a 4-column grid on laptops | Grid is now 2 / 3 / 4 columns by width |
| 8 | Port 5173 was taken by another local project, so the dev server couldn't start | ArchBoard dev now uses port 5180 (`strictPort`, so it never silently moves) |
| 9 | ⌘K test flaked because the gallery is lazy-loaded | Test waits for the route to mount; real users can't press ⌘K before the page renders |

## Deferred (with reason)
- **Visual-regression baselines (pixel diffs)**: Phase 8, once screens stop changing every phase. Screenshots are archived per phase for now.
- **Clerk theme preview**: `clerkAppearance` is ready; it's checked in Phase 3 when Clerk is wired in.
- **Vendor icon packs**: AWS and Azure imported after approval; Google Cloud still needs a download link.
