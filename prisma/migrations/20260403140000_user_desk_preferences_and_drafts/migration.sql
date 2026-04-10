-- AlterTable
ALTER TABLE "User" ADD COLUMN "preferences" TEXT;

-- CreateTable
CREATE TABLE "DeskProductUserDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deskProductId" TEXT NOT NULL,
    "targetPriceWon" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeskProductUserDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeskProductUserDraft_deskProductId_fkey" FOREIGN KEY ("deskProductId") REFERENCES "DeskProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeskProductUserDraft_userId_deskProductId_key" ON "DeskProductUserDraft"("userId", "deskProductId");
