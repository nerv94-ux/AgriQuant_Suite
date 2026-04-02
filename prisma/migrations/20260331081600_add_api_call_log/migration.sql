-- CreateTable
CREATE TABLE "ApiCallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "appId" TEXT,
    "errorCategory" TEXT,
    "message" TEXT,
    "extra" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiCallLog_requestId_key" ON "ApiCallLog"("requestId");
