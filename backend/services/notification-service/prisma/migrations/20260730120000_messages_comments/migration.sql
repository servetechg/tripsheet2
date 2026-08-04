CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "threadType" TEXT NOT NULL DEFAULT 'driver',
    "fromUserId" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT '',
    "toUserId" TEXT,
    "toName" TEXT NOT NULL DEFAULT '',
    "loadId" TEXT,
    "body" TEXT NOT NULL,
    "readAt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Message_companyId_idx" ON "Message"("companyId");
CREATE INDEX IF NOT EXISTS "Message_toUserId_idx" ON "Message"("toUserId");
CREATE INDEX IF NOT EXISTS "Message_loadId_idx" ON "Message"("loadId");

CREATE TABLE IF NOT EXISTS "Comment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Comment_companyId_idx" ON "Comment"("companyId");
CREATE INDEX IF NOT EXISTS "Comment_entityType_entityId_idx" ON "Comment"("entityType", "entityId");
