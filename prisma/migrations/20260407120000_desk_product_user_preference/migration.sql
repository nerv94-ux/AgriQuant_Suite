-- CreateTable
CREATE TABLE "DeskProductUserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deskProductId" TEXT NOT NULL,
    "favorite" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER,
    "shortcutNumber" INTEGER,
    "lastUsedAt" DATETIME,
    CONSTRAINT "DeskProductUserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeskProductUserPreference_deskProductId_fkey" FOREIGN KEY ("deskProductId") REFERENCES "DeskProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DeskProductUserPreference_userId_deskProductId_key" ON "DeskProductUserPreference"("userId", "deskProductId");

-- CreateIndex
CREATE INDEX "DeskProductUserPreference_userId_idx" ON "DeskProductUserPreference"("userId");
