-- A dig error: a ball touched in defence and not kept alive.
--
-- Digs are recorded on most player-matches and were credited to nobody in
-- positions mode. Counting them as a deposit is the fix, but a positive with
-- no matching negative makes a distribution worse rather than better: liberos
-- already read Strong contribution three quarters of the time. So the deposit
-- arrives with the failure that belongs to it.
ALTER TABLE "StatLine" ADD COLUMN "digErrors" INTEGER NOT NULL DEFAULT 0;
