-- AlterTable: no-positions mode + parent live view toggle
ALTER TABLE "Team" ADD COLUMN "usesPositions" BOOLEAN NOT NULL DEFAULT true,
                   ADD COLUMN "allowParentView" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: parent invite code per player
ALTER TABLE "Player" ADD COLUMN "parentCode" TEXT,
                     ADD COLUMN "parentCodeCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Player_parentCode_key" ON "Player"("parentCode");

-- CreateTable
CREATE TABLE "ParentPlayerLink" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentPlayerLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentPlayerLink_parentId_playerId_key" ON "ParentPlayerLink"("parentId", "playerId");
CREATE INDEX "ParentPlayerLink_playerId_idx" ON "ParentPlayerLink"("playerId");

-- AddForeignKey
ALTER TABLE "ParentPlayerLink" ADD CONSTRAINT "ParentPlayerLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentPlayerLink" ADD CONSTRAINT "ParentPlayerLink_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
