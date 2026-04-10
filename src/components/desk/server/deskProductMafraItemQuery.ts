import type { DeskProduct } from "@/types/deskProduct";

/**
 * 품목명에서 토큰(숫자·단위만 있는 조각은 제외).
 * 1글자 한글도 허용해 짧은 품목명에서 검증이 비지 않게 함.
 */
export function deskProductNameTokensForPlausibility(product: DeskProduct): string[] {
  const raw = (product.name.split("*")[0] ?? product.name).trim();
  return raw
    .split(/[\s*\/|,\[\]()]+/)
    .map((t) => t.trim())
    .filter((t) => {
      if (!t.length) return false;
      if (/^\d+([.,]\d+)?\s*(g|kg|ml|l|m|개|입|포|장)?$/i.test(t)) return false;
      return true;
    });
}

/**
 * 코드사전 품목 매칭에 쓸 검색 문장 후보.
 * 품목명 단독을 먼저 두고, 부족하면 규격 포함·추가 토큰을 시도.
 */
export function deskProductItemSearchQueries(product: DeskProduct): string[] {
  const name = product.name.trim();
  const specRaw = product.specLabel.trim();
  const spec = specRaw === "—" || specRaw === "" ? "" : specRaw;
  const unit = product.packageUnit.trim();
  const qNameSpec = [name, spec].filter(Boolean).join(" ").trim();
  const qFull = [name, spec, unit].filter(Boolean).join(" ").trim();
  const beforeStar = name.split("*")[0]?.trim() ?? "";

  const raw: string[] = [];
  if (name) raw.push(name);
  if (beforeStar && beforeStar !== name) raw.push(beforeStar);
  if (qNameSpec && qNameSpec !== name && qNameSpec !== beforeStar) raw.push(qNameSpec);
  if (qFull && qFull !== name && qFull !== qNameSpec && qFull !== beforeStar) raw.push(qFull);

  /** 품목명이 여러 단어일 때 각 조각(키워드) 추가 */
  const core = beforeStar || name;
  if (core) {
    for (const part of core.split(/[\s/|]+/).map((p) => p.trim())) {
      if (part.length >= 2 && !raw.includes(part)) raw.push(part);
    }
  }

  /** 품목명이 비었을 때 규격만이라도 시도 */
  if (!name && spec) raw.push(spec);

  return [...new Set(raw.filter((q) => q.length > 0))];
}

/** 실시간 경매 API 한 번 호출용(자동 해석 시 itemName) — 품목명 우선 조합 */
export function deskProductPrimaryItemQueryForMafra(product: DeskProduct): string {
  const qs = deskProductItemSearchQueries(product);
  return qs[0] ?? product.name.trim() ?? product.specLabel.trim();
}
