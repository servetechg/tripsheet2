-- Chapter 4 Phase 2: invite expiry
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "expiresAt" TEXT;
CREATE INDEX IF NOT EXISTS "Invite_status_idx" ON "Invite"("status");
