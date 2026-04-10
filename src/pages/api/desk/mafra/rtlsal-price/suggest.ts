import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/components/common/auth/server/authOptions";
import { fetchMafraRetailSalPrice } from "@/components/common/api/server/connectors/mafra-rtlsal-price";

type Suggestion = {
  ctgryCd: string;
  itemCd: string;
  speciesCd: string;
  itemName: string;
  speciesName: string;
  count: number;
};

function normalizeText(v: string): string {
  return v.toLowerCase().replace(/\s+/g, "");
}

function buildKeywordTokens(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const out = new Set<string>();
  out.add(t);
  for (const part of t.split(/[\s*\/|,\[\]()]+/)) {
    const p = part.trim();
    if (p.length >= 2) out.add(p);
  }
  return [...out].map(normalizeText).filter((x) => x.length >= 2);
}

function minusDaysYmd(ymd: string, days: number): string {
  if (!/^\d{8}$/.test(ymd)) return ymd;
  const d = new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T00:00:00`);
  d.setDate(d.getDate() - days);
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function scoreRow(itemName: string, speciesName: string, tokens: string[]): number {
  const i = normalizeText(itemName);
  const s = normalizeText(speciesName);
  let score = 0;
  for (const tok of tokens) {
    if (i === tok) score += 120;
    else if (i.startsWith(tok)) score += 80;
    else if (i.includes(tok)) score += 60;
    if (s === tok) score += 70;
    else if (s.startsWith(tok)) score += 40;
    else if (s.includes(tok)) score += 25;
  }
  return score;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const keyword = String(req.query.keyword ?? "").trim();
  const examinDe = String(req.query.examinDe ?? "").trim();
  if (!keyword) {
    return res.status(400).json({ ok: false, message: "keyword가 필요합니다." });
  }
  if (!/^\d{8}$/.test(examinDe)) {
    return res.status(400).json({ ok: false, message: "examinDe는 YYYYMMDD 형식이어야 합니다." });
  }

  const tokens = buildKeywordTokens(keyword);
  if (tokens.length === 0) {
    return res.status(200).json({
      ok: true,
      data: { suggestions: [], searchedDates: [examinDe], hint: "검색 키워드를 더 구체적으로 입력해 주세요." },
    });
  }

  const dates = [examinDe];
  for (let i = 1; i <= 6; i += 1) dates.push(minusDaysYmd(examinDe, i));
  dates.push("20150401"); // 명세 예시 일자 폴백

  const agg = new Map<string, Suggestion & { score: number }>();
  const searchedDates: string[] = [];
  let sampledRows = 0;

  for (const d of dates) {
    const r = await fetchMafraRetailSalPrice({
      requestId: `${crypto.randomUUID()}-rtlsal-suggest`,
      appId: "desk-mafra-rtlsal-suggest",
      request: { examinDe: d, startIndex: 1, endIndex: 250 },
    });
    searchedDates.push(d);
    if (!r.ok || !r.data || !Array.isArray(r.data.rows) || r.data.rows.length === 0) continue;
    sampledRows += r.data.rows.length;
    for (const row of r.data.rows) {
      const itemName = String(row.PRDLST_NM ?? "").trim();
      const speciesName = String(row.SPCIES_NM ?? "").trim();
      const s = scoreRow(itemName, speciesName, tokens);
      if (s <= 0) continue;
      const ctgryCd = String(row.FRMPRD_CATGORY_CD ?? "").trim();
      const itemCd = String(row.PRDLST_CD ?? "").trim();
      const speciesCd = String(row.SPCIES_CD ?? "").trim();
      if (!ctgryCd || !itemCd || !speciesCd) continue;
      const key = `${ctgryCd}|${itemCd}|${speciesCd}|${itemName}|${speciesName}`;
      const prev = agg.get(key);
      if (prev) {
        prev.count += 1;
        prev.score = Math.max(prev.score, s);
      } else {
        agg.set(key, { ctgryCd, itemCd, speciesCd, itemName, speciesName, count: 1, score: s });
      }
    }
  }

  const suggestions = [...agg.values()]
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 12)
    .map(({ score: _score, ...rest }) => rest);

  const hint =
    suggestions.length === 0
      ? "최근 7일(+명세 예시일) 샘플에서 품목명이 일치하는 후보를 찾지 못했습니다. 조사일을 바꾸거나 코드를 직접 입력해 주세요."
      : null;

  return res.status(200).json({
    ok: true,
    data: {
      keyword,
      searchedDates,
      sampledRows,
      suggestions,
      hint,
    },
  });
}

