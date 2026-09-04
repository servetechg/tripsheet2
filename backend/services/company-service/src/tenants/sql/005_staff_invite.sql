-- Staff invites on tenant driver.Invite (CREATE TABLE IF NOT EXISTS will not add columns)
ALTER TABLE driver."Invite" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'driver';
ALTER TABLE driver."Invite" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'driver';
ALTER TABLE driver."Invite" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE driver."Invite" ADD COLUMN IF NOT EXISTS "name" TEXT;
