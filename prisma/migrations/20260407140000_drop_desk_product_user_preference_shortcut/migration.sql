-- Redefine SQLite table without shortcutNumber (SQLite ALTER DROP COLUMN)
PRAGMA foreign_keys=OFF;

CREATE TABLE "DeskProductUserPreference_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deskProductId" TEXT NOT NULL,
    "favorite" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER,
    "lastUsedAt" DATETIME,
    CONSTRAINT "DeskProductUserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeskProductUserPreference_deskProductId_fkey" FOREIGN KEY ("deskProductId") REFERENCES "DeskProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "DeskProductUserPreference_new" ("id", "userId", "deskProductId", "favorite", "sortOrder", "lastUsedAt")
SELECT "id", "userId", "deskProductId", "favorite", "sortOrder", "lastUsedAt" FROM "DeskProductUserPreference";

DROP TABLE "DeskProductUserPreference";
ALTER TABLE "DeskProductUserPreference_new" RENAME TO "DeskProductUserPreference";

CREATE UNIQUE INDEX "DeskProductUserPreference_userId_deskProductId_key" ON "DeskProductUserPreference"("userId", "deskProductId");
CREATE INDEX "DeskProductUserPreference_userId_idx" ON "DeskProductUserPreference"("userId");

PRAGMA foreign_keys=ON;
