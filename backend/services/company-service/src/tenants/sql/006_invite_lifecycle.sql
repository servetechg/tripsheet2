-- Chapter 4 Phase 2: invite TTL + Invite.expiresAt on tenant DBs
ALTER TABLE company_local."SecurityPolicy"
  ADD COLUMN IF NOT EXISTS "inviteTtlDays" INT NOT NULL DEFAULT 7;

ALTER TABLE driver."Invite" ADD COLUMN IF NOT EXISTS "expiresAt" TEXT;
