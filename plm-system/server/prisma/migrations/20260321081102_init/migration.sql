-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ENGINEERING_USER', 'APPROVER', 'OPERATIONS_USER');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EcoType" AS ENUM ('PRODUCT', 'BOM');

-- CreateEnum
CREATE TYPE "EcoState" AS ENUM ('IN_PROGRESS', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalCategory" AS ENUM ('REQUIRED', 'OPTIONAL');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ENGINEERING_USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salesPrice" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bom" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "units" TEXT NOT NULL DEFAULT 'Units',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomComponent" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "units" TEXT NOT NULL DEFAULT 'Units',

    CONSTRAINT "BomComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomOperation" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "operationName" TEXT NOT NULL,
    "expectedDuration" INTEGER NOT NULL,
    "workCenter" TEXT NOT NULL,

    CONSTRAINT "BomOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcoStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcoStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "approvalCategory" "ApprovalCategory" NOT NULL DEFAULT 'REQUIRED',

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Eco" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ecoType" "EcoType" NOT NULL,
    "productId" TEXT NOT NULL,
    "bomId" TEXT,
    "userId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "versionUpdate" BOOLEAN NOT NULL DEFAULT true,
    "state" "EcoState" NOT NULL DEFAULT 'IN_PROGRESS',
    "isStarted" BOOLEAN NOT NULL DEFAULT false,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "proposedProductChanges" JSONB,
    "proposedBomChanges" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Eco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcoApproval" (
    "id" TEXT NOT NULL,
    "ecoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcoApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "userId" TEXT NOT NULL,
    "ecoId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Product_name_version_idx" ON "Product"("name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Bom_reference_key" ON "Bom"("reference");

-- CreateIndex
CREATE INDEX "Bom_productId_version_idx" ON "Bom"("productId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "EcoStage_name_key" ON "EcoStage"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EcoStage_sequence_key" ON "EcoStage"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Eco_reference_key" ON "Eco"("reference");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_ecoId_idx" ON "AuditLog"("ecoId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bom" ADD CONSTRAINT "Bom_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bom" ADD CONSTRAINT "Bom_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Bom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomComponent" ADD CONSTRAINT "BomComponent_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomOperation" ADD CONSTRAINT "BomOperation_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRule" ADD CONSTRAINT "ApprovalRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eco" ADD CONSTRAINT "Eco_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eco" ADD CONSTRAINT "Eco_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eco" ADD CONSTRAINT "Eco_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eco" ADD CONSTRAINT "Eco_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "EcoStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcoApproval" ADD CONSTRAINT "EcoApproval_ecoId_fkey" FOREIGN KEY ("ecoId") REFERENCES "Eco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcoApproval" ADD CONSTRAINT "EcoApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_ecoId_fkey" FOREIGN KEY ("ecoId") REFERENCES "Eco"("id") ON DELETE SET NULL ON UPDATE CASCADE;
