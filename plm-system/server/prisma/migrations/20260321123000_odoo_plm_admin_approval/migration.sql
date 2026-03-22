DO $$
BEGIN
  CREATE TYPE "AccountStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "ApprovalCategory" ADD VALUE IF NOT EXISTS 'COMMENT_ONLY';

ALTER TABLE "ApprovalRule"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "stageId" TEXT;

UPDATE "ApprovalRule"
SET "stageId" = COALESCE(
  (SELECT "id" FROM "EcoStage" WHERE "requiresApproval" = true ORDER BY "sequence" ASC LIMIT 1),
  (SELECT "id" FROM "EcoStage" ORDER BY "sequence" ASC LIMIT 1)
)
WHERE "stageId" IS NULL;

ALTER TABLE "ApprovalRule"
  ALTER COLUMN "stageId" SET NOT NULL;

ALTER TABLE "Eco"
  ADD COLUMN "appliedAt" TIMESTAMP(3),
  ADD COLUMN "description" TEXT;

ALTER TABLE "EcoApproval"
  ADD COLUMN "stageId" TEXT;

UPDATE "EcoApproval" ea
SET "stageId" = e."stageId"
FROM "Eco" e
WHERE e."id" = ea."ecoId"
  AND ea."stageId" IS NULL;

ALTER TABLE "EcoApproval"
  ALTER COLUMN "stageId" SET NOT NULL;

ALTER TABLE "EcoStage"
  ADD COLUMN "allowApplyChanges" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "folded" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
  ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "approvedRole" "Role",
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "requestedRole" "Role";

CREATE TABLE "Attachment" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "bomId" TEXT,
  "ecoId" TEXT,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "Status" NOT NULL DEFAULT 'ACTIVE',
  "uploadedBy" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_productId_fileName_version_idx" ON "Attachment"("productId", "fileName", "version");
CREATE INDEX "Attachment_bomId_fileName_version_idx" ON "Attachment"("bomId", "fileName", "version");
CREATE INDEX "Attachment_ecoId_fileName_version_idx" ON "Attachment"("ecoId", "fileName", "version");
CREATE UNIQUE INDEX "ApprovalRule_userId_stageId_key" ON "ApprovalRule"("userId", "stageId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_approvedBy_fkey"
  FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApprovalRule"
  ADD CONSTRAINT "ApprovalRule_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "EcoStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EcoApproval"
  ADD CONSTRAINT "EcoApproval_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "EcoStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_bomId_fkey"
  FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_ecoId_fkey"
  FOREIGN KEY ("ecoId") REFERENCES "Eco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_uploadedBy_fkey"
  FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
