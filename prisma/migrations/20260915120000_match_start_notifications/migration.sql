-- Match-start notifications for linked parents: push subscriptions, the
-- per-match notification log, parent preferences, the team toggle and the
-- match start time.

-- Parent preferences
ALTER TABLE "User" ADD COLUMN "emailMatchAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "installCardDismissedAt" TIMESTAMP(3);

-- Team toggle (default on)
ALTER TABLE "Team" ADD COLUMN "notifyParentsOnStart" BOOLEAN NOT NULL DEFAULT true;

-- When the coach confirmed the starting lineup
ALTER TABLE "Match" ADD COLUMN "startedAt" TIMESTAMP(3);

-- Enums
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL', 'NONE');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- Push subscriptions
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiredAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_parentId_active_idx" ON "PushSubscription"("parentId", "active");
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One notification per (match, parent)
CREATE TABLE "MatchNotification" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "playerIds" TEXT[],
    "channel" "NotificationChannel" NOT NULL DEFAULT 'NONE',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchNotification_matchId_parentId_key" ON "MatchNotification"("matchId", "parentId");
CREATE INDEX "MatchNotification_parentId_createdAt_idx" ON "MatchNotification"("parentId", "createdAt");
ALTER TABLE "MatchNotification" ADD CONSTRAINT "MatchNotification_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchNotification" ADD CONSTRAINT "MatchNotification_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
