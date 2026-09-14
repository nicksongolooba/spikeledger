-- AlterTable: parent codes redeem at most 3 times within 30 days
ALTER TABLE "Player" ADD COLUMN "parentCodeRedemptions" INTEGER NOT NULL DEFAULT 0,
                     ADD COLUMN "parentCodeExpiresAt" TIMESTAMP(3);
UPDATE "Player" SET "parentCodeExpiresAt" = "parentCodeCreatedAt" + INTERVAL '30 days'
  WHERE "parentCode" IS NOT NULL AND "parentCodeCreatedAt" IS NOT NULL;

-- AlterTable: "parent linked" notices for the coach
ALTER TABLE "ParentPlayerLink" ADD COLUMN "coachSeenAt" TIMESTAMP(3);
UPDATE "ParentPlayerLink" SET "coachSeenAt" = "linkedAt";

-- CreateTable: live per-set scores
CREATE TABLE "MatchSetScore" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "us" INTEGER NOT NULL DEFAULT 0,
    "them" INTEGER NOT NULL DEFAULT 0,
    "history" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchSetScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchSetScore_matchId_setNumber_key" ON "MatchSetScore"("matchId", "setNumber");

-- AddForeignKey
ALTER TABLE "MatchSetScore" ADD CONSTRAINT "MatchSetScore_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
