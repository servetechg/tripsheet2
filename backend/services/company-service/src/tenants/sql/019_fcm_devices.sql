-- Web push: FCM device tokens (notification-service Prisma FcmDevice)
CREATE TABLE IF NOT EXISTS notification."FcmDevice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "FcmDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FcmDevice_token_key"
  ON notification."FcmDevice"("token");
CREATE INDEX IF NOT EXISTS "FcmDevice_companyId_userId_idx"
  ON notification."FcmDevice"("companyId", "userId");
CREATE INDEX IF NOT EXISTS "FcmDevice_userId_idx"
  ON notification."FcmDevice"("userId");
