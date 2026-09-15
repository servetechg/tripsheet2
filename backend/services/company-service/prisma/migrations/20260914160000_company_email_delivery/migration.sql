-- Per-tenant email delivery profile (platform branding + optional BYO SMTP)
CREATE TABLE "CompanyEmailDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'platform',
    "fromDisplayName" TEXT NOT NULL DEFAULT '',
    "fromEmail" TEXT NOT NULL DEFAULT '',
    "replyToEmail" TEXT NOT NULL DEFAULT '',
    "smtpHost" TEXT NOT NULL DEFAULT '',
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpUser" TEXT NOT NULL DEFAULT '',
    "smtpPassCipher" TEXT NOT NULL DEFAULT '',
    "domainVerifiedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyEmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyEmailDelivery_companyId_key" ON "CompanyEmailDelivery"("companyId");
CREATE INDEX "CompanyEmailDelivery_mode_idx" ON "CompanyEmailDelivery"("mode");
CREATE INDEX "CompanyEmailDelivery_active_idx" ON "CompanyEmailDelivery"("active");

ALTER TABLE "CompanyEmailDelivery" ADD CONSTRAINT "CompanyEmailDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default platform profiles for existing companies
INSERT INTO "CompanyEmailDelivery" ("id", "companyId", "mode", "fromDisplayName", "updatedAt")
SELECT
    'ced_' || substr(md5(c."id" || random()::text), 1, 22),
    c."id",
    'platform',
    c."name",
    CURRENT_TIMESTAMP
FROM "Company" c
LEFT JOIN "CompanyEmailDelivery" d ON d."companyId" = c."id"
WHERE d."id" IS NULL;
