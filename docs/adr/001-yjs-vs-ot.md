# ADR-001: Yjs (CRDT) as the board's data model

- Status: Accepted
- Date: 2026-11-21

## Context

A board must never lose work. It's edited in the browser, saved to the server about a second later, kept in IndexedDB while offline, and may be open in more than one tab or device at once. Undo has to be exact, and a save that arrives late (from a tab that was offline) must not overwrite newer changes.

## Options

1. **Last-writer-wins JSON snapshots.** Simple, but a late save from a stale tab silently erases newer work.
2. **Operational Transformation (OT)**, e.g. ShareDB. It needs a central server transforming every operation, and the transform functions for a custom diagram shape (nodes, edges, groups) are hand-written and hard to get right.
3. **Yjs CRDT.** Merging is conflict-free by construction; updates are small, binary and idempotent; `y-indexeddb` gives offline storage; `Y.UndoManager` gives undo scoped to the local user's transactions.
4. **Automerge.** Also a CRDT, with a richer history model, but heavier at runtime and with a smaller ecosystem for the IndexedDB piece.

## Decision

Use **Yjs**. The Y.Doc is the source of truth for a board (`nodes`, `edges` and `meta` maps of field-level Y.Maps). Every edit is a diagram operation in one transaction. The server stores the board as a merged Yjs state (`Y.mergeUpdates`), and JSON (`DiagramV1`) is the interchange format, with property-tested converters.

## Consequences

- ✅ Saves merge instead of overwrite: two tabs, or a tab that was offline, can't erase each other's work.
- ✅ Offline is simple. IndexedDB holds every change, and the next save sends the full state, which merges cleanly.
- ✅ Undo is exact: one action is one transaction is one undo step.
- ✅ Field-level maps mean edits to different properties of the same node never conflict.
- ⚠️ Deleted content leaves small tombstones. The 7-day board lifetime and the 2 MB cap keep documents small.
- ⚠️ CRDT merges are "valid", not necessarily "intended", if two tabs edit the same field at the same moment. That's rare for a personal board, and the result is still a consistent board.
