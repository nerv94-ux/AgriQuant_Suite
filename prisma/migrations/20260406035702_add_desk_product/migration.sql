-- CreateTable
CREATE TABLE "DeskProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "specLabel" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "hasOpenMarketMatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- 초기 예시 품목 (기존 DB에 있으면 무시)
INSERT OR IGNORE INTO "DeskProduct" ("id", "name", "specLabel", "source", "hasOpenMarketMatch", "createdAt", "updatedAt") VALUES
('deskseed_carrot', '당근', '500g', 'ECOUNT', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('deskseed_cabbage', '양배추', '망 기준', 'ECOUNT', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('deskseed_manual', '수동 등록 예시', '—', 'MANUAL', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
