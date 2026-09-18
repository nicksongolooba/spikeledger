-- Remove 0-0 set rows written to matches that were never started.
--
-- The courtside page used to sync the current set score on load, before any
-- point was scored and before a lineup existed. Merely opening a match wrote
-- a "set 1, 0-0" row. The fix in this same change stops that happening; this
-- clears what it already wrote.
--
-- These rows were not inert. They feed the team's historical rally rate, which
-- drives the live set win probability a parent watches, and they put a 0-0
-- scoreboard in front of a parent opening a match nobody had started.
--
-- Deliberately narrow. Only rows on matches with no startedAt, and only where
-- both scores are zero, so nothing that records an actual score is touched.
-- A match's own stat lines are not affected.
DELETE FROM "MatchSetScore" s
USING "Match" m
WHERE s."matchId" = m.id
  AND m."startedAt" IS NULL
  AND s."us" = 0
  AND s."them" = 0;
