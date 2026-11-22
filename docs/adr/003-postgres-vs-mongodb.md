# ADR-003: PostgreSQL (with Prisma) instead of MongoDB

- Status: Accepted
- Date: 2026-11-21

## Context

The server stores one board per account: the owner's Clerk id, the board content (a binary Yjs state), and the dates that drive the 7-day lifetime. The rules must hold under concurrency: two simultaneous "create board" requests must never produce two boards. Everything runs on one small VM, so operational simplicity and backups matter.

## Options

1. **PostgreSQL**: unique constraints enforced by the database, transactions, `bytea` for the Yjs state, indexed expiry queries, a mature backup story (`pg_dump`), and a clear path to Cloud SQL if the app outgrows one VM.
2. **MongoDB**: "a board is a document" fits, but the live board is a Yjs state, not a Mongo document, so schema flexibility buys little. Unique indexes exist, but the backup and migration tooling is less familiar to most teams.
3. **SQLite**: excellent for a single process, but it ties the API to the VM's disk and complicates running migrations from a separate container.

## Decision

**PostgreSQL 16** with **Prisma 7** (driver adapter `@prisma/adapter-pg`) and versioned `prisma migrate` migrations, in `packages/db`.

## Consequences

- ✅ "One board per account" is a unique index, so the database itself rejects the second of two racing creates (covered by an integration test against real Postgres in CI).
- ✅ Expiry is an indexed `expiresAt` column, so the hourly cleanup is a single indexed delete.
- ✅ CI applies every migration to an empty database and fails on schema drift (`prisma migrate diff --exit-code`).
- ✅ Nightly `pg_dump` backups plus daily disk snapshots.
- ⚠️ Expand → deploy → contract migration discipline is needed for zero-downtime deploys (documented in the schema header).
