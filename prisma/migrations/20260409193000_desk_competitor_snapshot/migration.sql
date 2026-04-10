-- CreateTable
CREATE TABLE "DeskCompetitorSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deskProductId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "productNo" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL DEFAULT '',
    "price" INTEGER,
    "optionPriceMin" INTEGER,
    "optionPriceMax" INTEGER,
    "soldOut" BOOLEAN,
    "reviewCount" INTEGER,
    "rating" REAL,
    "status" TEXT NOT NULL DEFAULT 'FAILED',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "rawJson" TEXT NOT NULL DEFAULT '{}',
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeskCompetitorSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeskCompetitorSnapshot_deskProductId_fkey" FOREIGN KEY ("deskProductId") REFERENCES "DeskProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DeskCompetitorSnapshot_userId_deskProductId_collectedAt_idx" ON "DeskCompetitorSnapshot"("userId", "deskProductId", "collectedAt");

-- CreateIndex
CREATE INDEX "DeskCompetitorSnapshot_targetId_collectedAt_idx" ON "DeskCompetitorSnapshot"("targetId", "collectedAt");
