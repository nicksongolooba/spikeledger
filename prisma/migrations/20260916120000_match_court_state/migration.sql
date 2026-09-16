-- Who is on court, per set, while a match is being scored.
--
-- Until now the server only ever learned who HAS played: a substitution
-- upserts a stat line for the incoming player and says nothing about the one
-- coming off. The parent live view needs the difference between "on court",
-- "on the bench" and "off the court right now", so the courtside screen now
-- syncs the lineup itself.

CREATE TABLE "MatchCourtState" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    -- Player ids on court right now.
    "onCourt" TEXT[],
    -- Player ids who have been on court at any point in this set. Only ever
    -- grows, so a child's stats stay correctly labelled after she comes off.
    "appeared" TEXT[],
    -- Everyone the courtside screen had available for this match.
    "roster" TEXT[],
    -- Each player's match totals at the moment this set's lineup was first
    -- synced. Stats are stored per match, not per set, so subtracting this
    -- is the only truthful way to say "her stats this set so far".
    "baseline" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchCourtState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchCourtState_matchId_setNumber_key" ON "MatchCourtState"("matchId", "setNumber");
ALTER TABLE "MatchCourtState" ADD CONSTRAINT "MatchCourtState_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
