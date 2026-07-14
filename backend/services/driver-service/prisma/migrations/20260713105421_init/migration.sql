-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "dob" TEXT,
    "licenseNo" TEXT,
    "citizenship" TEXT,
    "address" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "fastCard" TEXT,
    "notes" TEXT,
    "sin" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverDocument" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "fileData" TEXT,
    "uploadedAt" TEXT NOT NULL,
    "expiryDate" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "driverName" TEXT,
    "companyName" TEXT,
    "startDate" TEXT,
    "payType" TEXT,
    "payRate" TEXT,
    "payUnit" TEXT,
    "teamRate" TEXT,
    "detentionRate" TEXT,
    "waitRate" TEXT,
    "fuelSurcharge" TEXT,
    "vacationPct" TEXT,
    "trialDays" TEXT,
    "noticeDays" TEXT,
    "benefits" TEXT,
    "signedByDriver" BOOLEAN NOT NULL DEFAULT false,
    "signedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "signedAt" TEXT,
    "driverSignature" TEXT,
    "adminSignature" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "driverId" TEXT,
    "createdAt" TEXT NOT NULL,
    "completedAt" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Driver_companyId_idx" ON "Driver"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_companyId_email_key" ON "Driver"("companyId", "email");

-- CreateIndex
CREATE INDEX "DriverDocument_driverId_idx" ON "DriverDocument"("driverId");

-- CreateIndex
CREATE INDEX "DriverDocument_companyId_idx" ON "DriverDocument"("companyId");

-- CreateIndex
CREATE INDEX "Contract_driverId_idx" ON "Contract"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_companyId_idx" ON "Invite"("companyId");

-- AddForeignKey
ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
