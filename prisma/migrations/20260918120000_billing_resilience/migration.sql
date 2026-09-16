-- Billing that survives a missing webhook, and a failed card that does not
-- take eight coaches offline on a tournament morning.
--
-- subscriptionStatus mirrors Stripe so the app can tell "retrying a failed
-- payment" (past_due, keeps access) from "gone" (canceled or unpaid).
-- The dunning columns drive the warning emails and the owner's banner.
-- pendingDowngradeAt holds a downgrade back while a match is being scored.

ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "paymentFailedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "dunningEmailsSent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastDunningEmailAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "pendingDowngradeAt" TIMESTAMP(3);

-- Existing paid accounts are active until Stripe says otherwise; the next
-- reconcile corrects anything that is not.
UPDATE "User" SET "subscriptionStatus" = 'active' WHERE "plan" <> 'FREE';

-- Every Stripe event we have already handled. A retried delivery finds its own
-- id here and is ignored instead of being processed twice.
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StripeEvent_receivedAt_idx" ON "StripeEvent"("receivedAt");
