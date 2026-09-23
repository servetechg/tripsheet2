-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "type" TEXT NOT NULL DEFAULT 'general',
    "readAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InAppNotification_companyId_userId_createdAt_idx" ON "InAppNotification"("companyId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_readAt_idx" ON "InAppNotification"("userId", "readAt");
