/**
 * 이미 동기화된 이카운트 품목 중 `deskEnabled: false` 인 행을 모두 `true`로 맞춥니다.
 * (예전 동기화가 `deskEnabled: false` 로 넣었던 데이터 보정용)
 *
 *   npx tsx scripts/enable-all-desk-ecount-products.ts
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

function loadDatabaseUrlFromEnvLocal(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const p = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("#") || !t) continue;
    const m = t.match(/^DATABASE_URL\s*=\s*(.+)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env.DATABASE_URL = v;
    return;
  }
}

function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim() || "file:./dev.db";
  if (!raw.startsWith("file:")) {
    return raw;
  }
  let p = raw.slice("file:".length);
  if (p.startsWith("//")) {
    p = p.slice(2);
  }
  if (p.startsWith("/") && /^[A-Za-z]:/.test(p.slice(1, 3))) {
    p = p.slice(1);
  }
  if (!path.isAbsolute(p)) {
    p = path.resolve(process.cwd(), p);
  }
  return `file:${p.replace(/\\/g, "/")}`;
}

async function main(): Promise<void> {
  loadDatabaseUrlFromEnvLocal();
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: resolveDatabaseUrl() }),
  });

  try {
    const result = await prisma.deskProduct.updateMany({
      where: { source: "ECOUNT", deskEnabled: false },
      data: { deskEnabled: true },
    });
    console.log(`이카운트 품목 중 미사용이었던 ${result.count}건을 「사용 중」으로 바꿨습니다.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
