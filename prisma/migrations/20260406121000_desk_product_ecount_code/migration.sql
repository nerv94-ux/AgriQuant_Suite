-- AlterTable
ALTER TABLE "DeskProduct" ADD COLUMN "ecountProdCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DeskProduct_ecountProdCode_key" ON "DeskProduct"("ecountProdCode");
