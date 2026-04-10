/**
 * 이카운트에서 동기화된 데스크 품목(`DeskProduct.source = ECOUNT`)만 전부 삭제합니다.
 * 연결된 `DeskProductUserDraft`는 FK CASCADE로 함께 삭제됩니다.
 *
 * 사용: 프로젝트 루트에서
 *   npx tsx scripts/clear-desk-ecount-products.ts
 *
 * DATABASE_URL은 환경 변수 또는 `.env.local`의 값을 사용합니다.
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
  const url = resolveDatabaseUrl();
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url }),
  });

  try {
    const result = await prisma.deskProduct.deleteMany({
      where: { source: "ECOUNT" },
    });
    console.log(
      `이카운트 데스크 품목 ${result.count}건을 삭제했습니다. (수동 품목·다른 출처는 유지)`,
    );
    console.log("이어서 데스크에서 「이카운트 품목 불러오기」로 다시 동기화하세요.");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
