import { readEcoRowCodes } from "@/components/desk/server/filterEcoPriceItems";

export type EcoCodeSuggestion = {
  ctgryCd: string;
  itemCd: string;
  vrtyCd: string;
  itemName: string;
  vrtyName: string;
  count: number;
};

function pickStr(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function normText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** 품목명·규격에서 친환경 API 응답 `item_nm` 매칭용 키워드 */
const GENERIC_TOKENS = new Set([
  "일반",
  "세척",
  "무세척",
  "특",
  "상",
  "중",
  "하",
  "포장",
  "국산",
  "수입",
  "대",
  "소",
  "중량",
  "크기",
]);

export function extractEcoSearchKeyword(name: string, specLabel: string): string {
  const raw = `${name} ${specLabel}`.replace(/[\[\]()]/g, " ");
  const words = raw.match(/[가-힣]{2,}/g) ?? [];
  for (const w of words) {
    if (!GENERIC_TOKENS.has(w)) return w;
  }
  const short = raw.match(/[가-힣]+/);
  return short ? short[0]! : "";
}

/**
 * 기간 내 친환경 가격 샘플 행에서 품목명이 키워드를 포함하는 행만 모아 부류·품목·품종 후보를 만든다.
 */
export function suggestEcoCodesFromNameMatch(
  items: Record<string, unknown>[],
  keyword: string,
  limit = 18,
): EcoCodeSuggestion[] {
  const k = normText(keyword.trim());
  if (k.length < 2) return [];

  const m = new Map<string, EcoCodeSuggestion>();

  for (const raw of items) {
    const row = raw as Record<string, unknown>;
    const codes = readEcoRowCodes(row);
    if (!codes.ctgry || !codes.item || !codes.vrty) continue;

    const itemName = pickStr(row, ["item_nm", "itemNm"]);
    const vrtyName = pickStr(row, ["vrty_nm", "vrtyNm"]);
    const blob = normText(`${itemName} ${vrtyName}`);
    if (!blob.includes(k)) continue;

    const key = `${codes.ctgry}|${codes.item}|${codes.vrty}|${itemName}|${vrtyName}`;
    const prev = m.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      m.set(key, {
        ctgryCd: codes.ctgry,
        itemCd: codes.item,
        vrtyCd: codes.vrty,
        itemName,
        vrtyName,
        count: 1,
      });
    }
  }

  const arr = [...m.values()];
  arr.sort((a, b) => {
    const aExact = normText(a.itemName).startsWith(k) ? 1 : 0;
    const bExact = normText(b.itemName).startsWith(k) ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    if (b.count !== a.count) return b.count - a.count;
    return `${a.ctgryCd}${a.itemCd}${a.vrtyCd}`.localeCompare(
      `${b.ctgryCd}${b.itemCd}${b.vrtyCd}`,
      "ko",
    );
  });

  return arr.slice(0, limit);
}
