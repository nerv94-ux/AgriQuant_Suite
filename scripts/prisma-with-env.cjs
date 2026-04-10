/**
 * prisma.config.ts 가 env("DATABASE_URL") 를 요구하므로,
 * .env / .env.local 이 없거나 postinstall 시 로드되지 않으면 generate 가 실패·스킵되어
 * 생성된 클라이언트가 schema.prisma 와 어긋날 수 있습니다.
 * 최소한의 KEY=VALUE 파싱으로 보조하고, 없으면 SQLite 기본 경로를 씁니다.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");

function loadEnvFile(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

if (!String(process.env.DATABASE_URL ?? "").trim()) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const args = process.argv.slice(2);
const r = spawnSync("npx", ["prisma", ...args], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: true,
});
process.exit(r.status === null ? 1 : r.status);
