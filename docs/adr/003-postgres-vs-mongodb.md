# ADR-003: PostgreSQL (with Prisma) instead of MongoDB

- Status: Accepted (Phase 1)
- Date: 2026-11-21

## Context
The data is relational: users, boards, memberships with roles, invites, guests, comments in threads, interview sessions. It also includes an append-only binary log of Yjs updates with per-board sequence numbers. Authorisation queries join memberships to boards on every request. We run on one small VM, so operational simplicity matters.

## Options
1. **PostgreSQL**: relational integrity (foreign keys, unique constraints, cascades), transactions for gap-free per-board `seq` assignment, `bytea` for Yjs updates, `jsonb` for flexible payloads (interview state, AI job options), a mature backup story (`pg_dump`), and a clear path to Cloud SQL.
2. **MongoDB**: flexible documents fit "a board is a JSON blob". But memberships, invites and comment threads would need application-level integrity, and multi-document transactions are heavier. Also the live diagram is a Y.Doc, not a Mongo document, so the main schema-flexibility advantage disappears.
3. **SQLite**: excellent for one process, but two sync instances plus the API need concurrent writers.

## Decision
**PostgreSQL 16** with **Prisma 7** (driver adapter `@prisma/adapter-pg`) and versioned `prisma migrate` migrations, in `packages/db`.

## Consequences
- ✅ Integrity is enforced by the database: a membership can't point at a missing board, and invite code hashes are unique.
- ✅ `@@unique([boardId, seq])`, plus incrementing `Board.lastSeq` in the same transaction, makes the update log gap-free across sync instances.
- ✅ CI applies every migration to an empty database and fails on schema drift (`prisma migrate diff --exit-code`).
- ⚠️ Large snapshots don't belong in rows: blobs over 256 KB go to GCS, with metadata in Postgres.
- ⚠️ Expand → deploy → contract migration discipline is required for zero-downtime deploys (documented in the schema header).
