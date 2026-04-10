import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const DATABASE_URL_FALLBACK = "file:./dev.db";

/**
 * `prisma/schema.prisma` 가 있는 디렉터리(저장소 루트)를 찾습니다.
 * Next/IDE가 cwd를 바꿔도 `file:./dev.db` 가 항상 같은 DB를 가리키게 합니다.
 */
function findRepoRoot(): string {
  const starts: string[] = [process.cwd()];
  if (typeof import.meta !== "undefined" && import.meta.url) {
    starts.push(path.dirname(fileURLToPath(import.meta.url)));
  }
  for (const start of starts) {
    let dir = path.resolve(start);
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(path.join(dir, "prisma", "schema.prisma"))) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return process.cwd();
}

/**
 * `file:./dev.db` 는 cwd에 따라 다른 파일을 가리킬 수 있어,
 * 상대 경로는 저장소 루트 기준으로 절대 file URL로 고정합니다.
 */
function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim() || DATABASE_URL_FALLBACK;
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
  const root = findRepoRoot();
  if (!path.isAbsolute(p)) {
    p = path.resolve(root, p);
  }
  return `file:${p.replace(/\\/g, "/")}`;
}

// Next.js hot-reload 환경에서 PrismaClient 중복 생성 방지
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: resolveDatabaseUrl(),
    }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
