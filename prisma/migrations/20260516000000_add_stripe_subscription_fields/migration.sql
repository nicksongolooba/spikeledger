-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripeSubscriptionId" TEXT,
ADD COLUMN     "planExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
