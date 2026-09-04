-- Staff invites (dispatcher / other system roles)

ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'driver';
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'driver';
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Invite" ADD COLUMN IF NOT EXISTS "name" TEXT;
