-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unitNo" TEXT NOT NULL,
    "year" TEXT,
    "make" TEXT,
    "model" TEXT,
    "vin" TEXT,
    "plate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Load" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverId" TEXT,
    "truckId" TEXT,
    "trailerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "pickupTime" TEXT,
    "eta" TEXT,
    "tripNo" TEXT,
    "notes" TEXT,
    "truckNo" TEXT,
    "trailerNo" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" TEXT,
    "lastUpdate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Load_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_companyId_idx" ON "Asset"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_companyId_unitNo_key" ON "Asset"("companyId", "unitNo");

-- CreateIndex
CREATE INDEX "Load_companyId_idx" ON "Load"("companyId");

-- CreateIndex
CREATE INDEX "Load_driverId_idx" ON "Load"("driverId");

-- CreateIndex
CREATE INDEX "Load_status_idx" ON "Load"("status");
