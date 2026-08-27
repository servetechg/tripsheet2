ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "commodityId" TEXT;
ALTER TABLE "Load" ADD COLUMN IF NOT EXISTS "commodityName" TEXT;
CREATE INDEX IF NOT EXISTS "Load_commodityId_idx" ON "Load"("commodityId");
