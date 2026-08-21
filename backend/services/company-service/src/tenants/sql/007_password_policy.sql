-- Chapter 4 Phase 3: password history count on tenant SecurityPolicy
ALTER TABLE company_local."SecurityPolicy"
  ADD COLUMN IF NOT EXISTS "passwordHistoryCount" INT NOT NULL DEFAULT 10;
