/**
 * 친환경 가격 API 필터 코드 — 저장값 우선, 없으면 MAFRA 대·중·소에서 추정(부류·품목·품종 자릿수 맞춤).
 * 도매 품목코드 체계와 1:1 대응이 아닐 수 있어 수동 보정(eco* 컬럼)을 권장.
 */

export type EcoPriceResolvedCodes = {
  ctgryCd: string | null;
  itemCd: string | null;
  vrtyCd: string | null;
  grdCd: string | null;
  sggCd: string | null;
  mrktCd: string | null;
  /** 저장된 eco*가 하나라도 있으면 saved, 아니면 inferred */
  source: "saved" | "inferred" | "empty";
  /**
   * 조회 불가 사유. 품종만 추정·저장된 경우 등 — 부류·품목 없이 vrty만 쓰면 API가 다른 품목이 섞인 결과를 줌.
   */
  detail?: "need_ctgry_item";
};

function normSegment(raw: string | null | undefined, len: number): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (t === "") return null;
  const digits = t.replace(/\D/g, "");
  if (digits.length === len) {
    return digits;
  }
  /**
   * 길이가 맞지 않으면 추정하지 않는다.
   * (예: 11 -> 011 처럼 패딩 추정하면 전혀 다른 코드로 좁혀져 0건이 자주 발생)
   */
  return null;
}

export function inferEcoCodesFromMafra(
  mafraLarge: string | null | undefined,
  mafraMid: string | null | undefined,
  mafraSmall: string | null | undefined,
): Pick<EcoPriceResolvedCodes, "ctgryCd" | "itemCd" | "vrtyCd"> {
  return {
    ctgryCd: normSegment(mafraLarge, 3),
    itemCd: normSegment(mafraMid, 3),
    vrtyCd: normSegment(mafraSmall, 2),
  };
}

export type DeskProductEcoFields = {
  ecoCtgryCd: string | null;
  ecoItemCd: string | null;
  ecoVrtyCd: string | null;
  ecoGrdCd: string | null;
  ecoSggCd: string | null;
  ecoMrktCd: string | null;
  mafraLarge: string | null;
  mafraMid: string | null;
  mafraSmall: string | null;
};

export function resolveEcoPriceCodes(row: DeskProductEcoFields): EcoPriceResolvedCodes {
  const hasSaved =
    !!(row.ecoCtgryCd?.trim() ||
      row.ecoItemCd?.trim() ||
      row.ecoVrtyCd?.trim() ||
      row.ecoGrdCd?.trim() ||
      row.ecoSggCd?.trim() ||
      row.ecoMrktCd?.trim());

  const inferred = inferEcoCodesFromMafra(row.mafraLarge, row.mafraMid, row.mafraSmall);

  const ctgryCd = row.ecoCtgryCd?.trim() || inferred.ctgryCd;
  const itemCd = row.ecoItemCd?.trim() || inferred.itemCd;
  const vrtyCd = row.ecoVrtyCd?.trim() || inferred.vrtyCd;
  const grdCd = row.ecoGrdCd?.trim() || null;
  const sggCd = row.ecoSggCd?.trim() || null;
  const mrktCd = row.ecoMrktCd?.trim() || null;

  /** 친환경 API는 부류·품목이 없으면 품종만으로 조회할 수 없음(품종 코드가 여러 품목에서 겹침). */
  const hasCorePair = !!(ctgryCd?.trim() && itemCd?.trim());
  if (!hasCorePair) {
    return {
      ctgryCd: null,
      itemCd: null,
      vrtyCd: null,
      grdCd: null,
      sggCd: null,
      mrktCd: null,
      source: "empty",
      detail: "need_ctgry_item",
    };
  }

  let source: EcoPriceResolvedCodes["source"] = "inferred";
  if (hasSaved) source = "saved";

  return {
    ctgryCd,
    itemCd,
    vrtyCd,
    grdCd,
    sggCd,
    mrktCd,
    source,
  };
}
