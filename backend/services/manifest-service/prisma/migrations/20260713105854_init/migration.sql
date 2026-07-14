-- CreateTable
CREATE TABLE "CarrierProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cbsaCarrierCode" TEXT NOT NULL DEFAULT '',
    "scacCode" TEXT NOT NULL DEFAULT '',
    "dotNumber" TEXT NOT NULL DEFAULT '',
    "csnNumber" TEXT NOT NULL DEFAULT '',
    "fastLane" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarrierProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manifest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "crn" TEXT,
    "loadId" TEXT,
    "driverId" TEXT,
    "truckId" TEXT,
    "trailerId" TEXT,
    "portOfEntry" TEXT,
    "estimatedArrival" TEXT,
    "shipments" JSONB NOT NULL DEFAULT '[]',
    "rejectionReason" TEXT,
    "submittedAt" TEXT,
    "acceptedAt" TEXT,
    "rejectedAt" TEXT,
    "formData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manifest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarrierProfile_companyId_key" ON "CarrierProfile"("companyId");

-- CreateIndex
CREATE INDEX "Manifest_companyId_idx" ON "Manifest"("companyId");
