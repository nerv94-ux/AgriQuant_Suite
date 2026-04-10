-- 친환경 농산물 가격 API 조회용 코드(수동·자동 추정 병행)
ALTER TABLE "DeskProduct" ADD COLUMN "ecoCtgryCd" TEXT;
ALTER TABLE "DeskProduct" ADD COLUMN "ecoItemCd" TEXT;
ALTER TABLE "DeskProduct" ADD COLUMN "ecoVrtyCd" TEXT;
ALTER TABLE "DeskProduct" ADD COLUMN "ecoGrdCd" TEXT;
ALTER TABLE "DeskProduct" ADD COLUMN "ecoSggCd" TEXT;
ALTER TABLE "DeskProduct" ADD COLUMN "ecoMrktCd" TEXT;
