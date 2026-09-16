-- Public share links are time limited and revocable.
--
-- A /share/[id] page needs no login and carries a minor's performance data, so
-- a forwarded or posted link must stop working on its own. New links get 30
-- days.
--
-- Existing links were created with no expiry at all. They are backfilled from
-- the date they were generated, which retires the old ones immediately rather
-- than leaving them open forever. Those links also have the player's full name
-- baked into the report images, which is exactly what should stop circulating.

ALTER TABLE "Report" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "revokedAt" TIMESTAMP(3);

UPDATE "Report"
   SET "expiresAt" = "generatedAt" + INTERVAL '30 days'
 WHERE "expiresAt" IS NULL;

CREATE INDEX "Report_teamId_generatedAt_idx" ON "Report"("teamId", "generatedAt");
