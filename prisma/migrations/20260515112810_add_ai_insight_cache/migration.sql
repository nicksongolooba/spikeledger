-- CreateTable
CREATE TABLE "AIInsightCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIInsightCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AIInsightCache_cacheKey_key" ON "AIInsightCache"("cacheKey");

-- CreateIndex
CREATE INDEX "AIInsightCache_cacheKey_expiresAt_idx" ON "AIInsightCache"("cacheKey", "expiresAt");
