# ADR-001: Yjs (CRDT) for document sync instead of Operational Transformation

- Status: Accepted (Phase 1)
- Date: 2026-11-21

## Context
Boards must sync in real time between a presenter and many viewers. They must keep working offline and survive reconnects without losing edits (UX: "never lose work"). The same edit history drives session replay. Only one person edits at a time (pass the pen, ADR-002), but brief overlaps still happen: a lease handoff while edits are in flight, or a presenter flushing offline edits.

## Options
1. **Operational Transformation (OT)**, e.g. ShareDB. It needs a central server to transform every operation against concurrent ones, and the transform functions for a custom JSON shape (nodes, edges, groups) are hand-written and notoriously hard to get right.
2. **Yjs CRDT.** Conflict-free merging by construction; binary updates that are small and idempotent; mature y-protocols for sync and awareness; `y-indexeddb` for offline; `Y.UndoManager` scoped by transaction origin.
3. **Automerge.** Also a CRDT, with a richer history model, but heavier at runtime and with a smaller ecosystem for the presence and IndexedDB pieces we need.
4. **Last-writer-wins JSON snapshots.** Simple, but it loses concurrent edits and gives replay nothing to work with.

## Decision
Use **Yjs**. The Y.Doc is the source of truth for the diagram (`nodes`, `edges`, `meta` maps of field-level Y.Maps, DESIGN §4.1). JSON (`DiagramV1`) is the interchange format, with property-tested converters.

## Consequences
- ✅ Updates are idempotent, so double delivery across sync instances and Redis pub/sub is harmless. Replay is "apply updates up to time T".
- ✅ Offline queueing and reconnect come almost for free (state-vector diff on reconnect).
- ✅ Undo scoped to local origin means a presenter can never undo someone else's work.
- ⚠️ Plain y-protocols has no durable-write acknowledgement, so we add our own message type (ADR-008) to make "Saved" truthful.
- ⚠️ Deleted content leaves tombstones; snapshot compaction (Phase 6) keeps document size bounded.
- ⚠️ CRDT merges are "valid", not necessarily "intended". Server-side pen enforcement keeps concurrent authorship rare by design.
