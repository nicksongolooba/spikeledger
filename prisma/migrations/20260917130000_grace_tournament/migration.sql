-- One free courtesy tournament per coach.
--
-- A free coach who hits the tournament limit while standing in a gym with
-- players warming up does not upgrade; they put the phone away and never come
-- back. The fourth tournament is allowed once, with a banner saying so, and
-- the limit applies normally after that.

ALTER TABLE "User" ADD COLUMN "graceTournamentId" TEXT;
ALTER TABLE "User" ADD COLUMN "graceTournamentUsedAt" TIMESTAMP(3);
