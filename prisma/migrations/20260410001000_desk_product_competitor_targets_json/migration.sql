-- 데스크 품목 상세: 사용자별 경쟁상품 URL/상품번호 등록(JSON)
ALTER TABLE "DeskProductUserDraft" ADD COLUMN "competitorTargetsJson" TEXT NOT NULL DEFAULT '[]';

