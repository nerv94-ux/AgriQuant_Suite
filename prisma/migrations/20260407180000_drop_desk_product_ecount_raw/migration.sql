-- AlterTable: 임시 로우데이터 저장 제거 — 동기화 부담·용량 절감
ALTER TABLE "DeskProduct" DROP COLUMN "ecountRaw";
