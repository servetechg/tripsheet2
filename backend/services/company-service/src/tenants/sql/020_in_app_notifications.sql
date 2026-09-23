-- In-app notification inbox (notification-service Prisma InAppNotification)
CREATE TABLE IF NOT EXISTS notification."InAppNotification" (
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

CREATE INDEX IF NOT EXISTS "InAppNotification_companyId_userId_createdAt_idx"
  ON notification."InAppNotification"("companyId", "userId", "createdAt");

CREATE INDEX IF NOT EXISTS "InAppNotification_userId_readAt_idx"
  ON notification."InAppNotification"("userId", "readAt");
