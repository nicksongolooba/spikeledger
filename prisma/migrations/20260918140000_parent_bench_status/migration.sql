-- Coach control over whether parents see on-court and off-court status.
--
-- The live states are useful to a parent following along: a child on the bench
-- this set is not a child having a bad match. But some coaches would rather
-- not put that in front of parents at all, because playing time is what turns
-- a parent into a Monday morning email. Default on; off is one tap.
ALTER TABLE "Team" ADD COLUMN "showBenchStatusToParents" BOOLEAN NOT NULL DEFAULT true;
