-- AlterTable
ALTER TABLE "DeskProduct" ADD COLUMN "lastApiFingerprint" TEXT;
ALTER TABLE "DeskProduct" ADD COLUMN "displayLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DeskProduct" ADD COLUMN "lockedAtFingerprint" TEXT;
ALTER TABLE "DeskProduct" ADD COLUMN "needsSourceReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DeskProduct" ADD COLUMN "curatedAt" DATETIME;
ALTER TABLE "DeskProduct" ADD COLUMN "curatedByUserId" TEXT;
