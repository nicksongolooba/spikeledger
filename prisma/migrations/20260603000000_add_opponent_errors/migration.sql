-- Track points that came from opponent mistakes (not earned by any one player).
ALTER TABLE "Match" ADD COLUMN "opponentErrors" INTEGER NOT NULL DEFAULT 0;
