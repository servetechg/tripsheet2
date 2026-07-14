-- CreateTable
CREATE TABLE "TripSheet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "header" JSONB NOT NULL,
    "trips" JSONB NOT NULL DEFAULT '[]',
    "expenses" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripSheet_companyId_idx" ON "TripSheet"("companyId");

-- CreateIndex
CREATE INDEX "TripSheet_driverId_idx" ON "TripSheet"("driverId");
