-- Board storage and the board policy (one live board per person, deleted after 7 days).

-- AlterTable
ALTER TABLE "Board" ADD COLUMN "content" BYTEA,
ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (now() + '7 days'::interval);

-- CreateIndex
CREATE INDEX "Board_expiresAt_idx" ON "Board"("expiresAt");

-- Existing data: keep each owner's most recently active board, soft-delete the rest.
UPDATE "Board" b SET "deletedAt" = now()
WHERE b."deletedAt" IS NULL AND EXISTS (
  SELECT 1 FROM "Board" o
  WHERE o."ownerId" = b."ownerId" AND o."deletedAt" IS NULL
    AND (o."lastActivityAt", o."id") > (b."lastActivityAt", b."id")
);

-- One live board per owner. Prisma can't express a partial unique index, so it lives here.
CREATE UNIQUE INDEX "Board_one_live_board_per_owner" ON "Board"("ownerId") WHERE "deletedAt" IS NULL;
