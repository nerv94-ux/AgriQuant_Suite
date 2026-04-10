-- AlterTable
ALTER TABLE "DeskProduct" ADD COLUMN "ecountCategorySuffix" TEXT;

-- 기존 행: 품목코드에 *가 있으면 뒤쪽을 접미 구분으로 채움
UPDATE "DeskProduct"
SET "ecountCategorySuffix" = trim(substr("ecountProdCode", instr("ecountProdCode", '*') + 1))
WHERE "ecountProdCode" LIKE '%*%';
