import type { EcoPriceResolvedCodes } from "@/components/desk/server/ecoPriceDeskCodes";

function pickStr(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

/** 공공 API 응답 행에서 부류·품목·품종 코드 추출(필드명 변형 대응) */
export function readEcoRowCodes(row: Record<string, unknown>): {
  ctgry: string;
  item: string;
  vrty: string;
} {
  return {
    ctgry: pickStr(row, ["ctgry_cd", "ctgryCd", "frmprd_catgory_cd", "frmprdCatgoryCd"]),
    item: pickStr(row, ["item_cd", "itemCd", "prdlst_cd", "prdlstCd"]),
    vrty: pickStr(row, ["vrty_cd", "vrtyCd", "spcies_cd", "spciesCd"]),
  };
}

/**
 * 조회에 사용한 코드와 응답 행을 맞춤. API가 넓게 주거나 필드명이 달라 섞여 보일 때 표시용으로 좁힘.
 * @param matchVrty false면 품종은 맞추지 않음(같은 품목의 여러 품종 행 유지).
 */
export function filterEcoPriceItemsByResolved(
  items: Record<string, unknown>[],
  resolved: EcoPriceResolvedCodes,
  opts?: { matchVrty?: boolean },
): Record<string, unknown>[] {
  const matchVrty = opts?.matchVrty !== false;
  const wantC = resolved.ctgryCd?.trim() ?? "";
  const wantI = resolved.itemCd?.trim() ?? "";
  const wantV = resolved.vrtyCd?.trim() ?? "";

  if (!wantC && !wantI && (!matchVrty || !wantV)) {
    return items;
  }

  return items.filter((raw) => {
    const row = raw as Record<string, unknown>;
    const c = readEcoRowCodes(row);
    if (wantC) {
      if (!c.ctgry) return false;
      if (c.ctgry !== wantC) return false;
    }
    if (wantI) {
      if (!c.item) return false;
      if (c.item !== wantI) return false;
    }
    if (matchVrty && wantV) {
      if (!c.vrty) return false;
      if (c.vrty !== wantV) return false;
    }
    return true;
  });
}
