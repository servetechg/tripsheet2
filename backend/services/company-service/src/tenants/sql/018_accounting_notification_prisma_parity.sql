-- Tenant DB parity with accounting-service + notification-service Prisma (staging tenants from older bootstrap).

-- notification.NotificationLog (SMS channel + provider id)
ALTER TABLE notification."NotificationLog"
  ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'sms';
ALTER TABLE notification."NotificationLog"
  ADD COLUMN IF NOT EXISTS "providerId" TEXT;
CREATE INDEX IF NOT EXISTS "NotificationLog_channel_idx"
  ON notification."NotificationLog"("channel");

-- accounting.Settlement — period columns must be TIMESTAMP for Prisma DateTime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'accounting'
      AND table_name = 'Settlement'
      AND column_name = 'periodStart'
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE accounting."Settlement"
      ALTER COLUMN "periodStart" TYPE TIMESTAMP(3)
      USING (
        CASE
          WHEN "periodStart" ~ '^\d{4}-' THEN "periodStart"::timestamp
          ELSE NOW()
        END
      ),
      ALTER COLUMN "periodEnd" TYPE TIMESTAMP(3)
      USING (
        CASE
          WHEN "periodEnd" ~ '^\d{4}-' THEN "periodEnd"::timestamp
          ELSE NOW()
        END
      );
  END IF;
END $$;

-- accounting.Payment — columns added after initial bootstrap
ALTER TABLE accounting."Payment"
  ADD COLUMN IF NOT EXISTS "reference" TEXT NOT NULL DEFAULT '';
ALTER TABLE accounting."Payment"
  ADD COLUMN IF NOT EXISTS "notes" TEXT NOT NULL DEFAULT '';
ALTER TABLE accounting."Payment"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE accounting."Payment"
  ALTER COLUMN "createdAt" TYPE TIMESTAMP(3)
  USING "createdAt"::timestamp;

ALTER TABLE accounting."Payment"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3)
  USING "updatedAt"::timestamp;
