CREATE TABLE IF NOT EXISTS "FcmDevice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "FcmDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FcmDevice_token_key" ON "FcmDevice"("token");
CREATE INDEX IF NOT EXISTS "FcmDevice_companyId_userId_idx" ON "FcmDevice"("companyId", "userId");
CREATE INDEX IF NOT EXISTS "FcmDevice_userId_idx" ON "FcmDevice"("userId");
