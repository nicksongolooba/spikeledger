-- Match format: best of 3 or best of 5.
--
-- Additive only. The column is nullable with no default, so every existing
-- match keeps a null format and nothing already stored changes. The app reads
-- a null format as best of 5, the rule it has always used. New matches are
-- saved with 3 or 5 by the app.
ALTER TABLE "Match" ADD COLUMN "bestOf" INTEGER;
ALTER TABLE "Match" ADD CONSTRAINT "Match_bestOf_check" CHECK ("bestOf" IS NULL OR "bestOf" IN (3, 5));
