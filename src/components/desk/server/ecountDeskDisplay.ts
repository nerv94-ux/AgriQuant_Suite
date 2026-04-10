import { createHash } from "node:crypto";

/** 이카운트 품목코드 `본문*구분` — 첫 `*` 기준 분리 */
export function splitEcountProdCode(code: string | null | undefined): {
  base: string | null;
  suffix: string | null;
} {
  if (code == null || code === "") {
    return { base: null, suffix: null };
  }
  const i = code.indexOf("*");
  if (i === -1) {
    return { base: code, suffix: null };
  }
  const base = code.slice(0, i).trim() || null;
  const suffix = code.slice(i + 1).trim() || null;
  return { base, suffix };
}

/** 동기화·지문 계산용 — GetBasicProductsList 행에서 품목명 후보 */
export function pickEcountDeskNameFromRaw(raw: Record<string, unknown>, prodCode: string): string {
  const v =
    String(raw.PROD_DES ?? raw.PROD_NM ?? raw.PROD_NAME ?? raw.ITEM_NM ?? "").trim() ||
    String(raw.prod_des ?? "").trim();
  return v || prodCode;
}

/** 동기화·지문 계산용 — 규격 필드 후보 */
export function pickEcountDeskSpecFromRaw(raw: Record<string, unknown>): string {
  const v = String(
    raw.PROD_SIZE_DES ?? raw.SIZE_DES ?? raw.SPEC_DES ?? raw.STD_DES ?? raw.prod_size_des ?? ""
  ).trim();
  return v || "—";
}

/** 이카운트에서 넘어온 품목명·규격 원문 기준 지문(동기화 덮어쓰기·검토 감지) */
export function computeDeskProductApiFingerprint(code: string, fullName: string, apiSpec: string): string {
  return createHash("sha256").update(`${code}\n${fullName}\n${apiSpec}`, "utf8").digest("hex").slice(0, 40);
}

/** 표시명 확정(`displayLocked`) 시 `lockedAtFingerprint` — API 지문이 있으면 그걸 고정 기준으로 삼음 */
export function resolveDeskProductLockFingerprint(p: {
  ecountProdCode: string | null;
  name: string;
  specLabel: string;
  lastApiFingerprint: string | null;
}): string {
  if (p.lastApiFingerprint) {
    return p.lastApiFingerprint;
  }
  const code = p.ecountProdCode ?? "";
  return computeDeskProductApiFingerprint(code, p.name, p.specLabel);
}

/** 품목명 `*` 구분 세그먼트 (이카운트 입력 형태 표시용) */
export function splitDeskProductNameParts(name: string): string[] {
  if (!name.trim()) {
    return [];
  }
  return name
    .split("*")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 이카운트 동기화 전용: **코드·구분·품목명**만 반영하고 **규격은 넣지 않음**(실무자 입력).
 * 품목명은 API 품목명 필드(`PROD_DES` 등) 문자열 그대로 `name`에 둔다.
 */
export function deskSyncDisplayFromEcountApi(fullName: string, prodCode: string): { name: string; specLabel: string } {
  const name = fullName.trim() || prodCode;
  return { name, specLabel: "—" };
}

/**
 * 이카운트 `PROD_DES` 등은 `*`로 품목·용도·규격 입력 단위가 이어진 경우가 많음.
 * DB에는 첫 세그먼트만 품목명으로 두고, 나머지는 규격 문자열에 합친다.
 * @deprecated 동기화에는 `deskSyncDisplayFromEcountApi` 사용 — 규격은 실무 입력
 */
export function persistDeskNameSpecFromEcount(fullName: string, apiSpec: string): {
  name: string;
  specLabel: string;
} {
  const segments = splitDeskProductNameParts(fullName);
  if (segments.length === 0) {
    return { name: fullName.trim() || "—", specLabel: apiSpec };
  }
  if (segments.length === 1) {
    return { name: segments[0]!, specLabel: apiSpec };
  }
  const primary = segments[0]!;
  const rest = segments.slice(1).join(" · ");
  const specLabel =
    !apiSpec.trim() || apiSpec.trim() === "—" ? rest || "—" : `${apiSpec.trim()} · ${rest}`;
  return { name: primary, specLabel };
}

/**
 * 목록·상세 표시용: 예전 동기화(전체 문자열을 name에 넣은 경우)도 첫 `*` 앞을 품목명으로,
 * 나머지는 규격과 합쳐 보여 준다.
 */
export function deskProductDisplayFromStoredNameAndSpec(
  storedName: string,
  storedSpecLabel: string,
): { name: string; specLabel: string; nameParts: string[] } {
  const segments = splitDeskProductNameParts(storedName);
  const primaryName = segments.length > 0 ? segments[0]! : storedName.trim();
  const tailFromName = segments.length > 1 ? segments.slice(1).join(" · ") : "";

  const dbSpec = storedSpecLabel?.trim() ?? "";
  const hasDbSpec = dbSpec !== "" && dbSpec !== "—";

  let specLabel: string;
  if (hasDbSpec && tailFromName) {
    specLabel = `${dbSpec} · ${tailFromName}`;
  } else if (hasDbSpec) {
    specLabel = dbSpec;
  } else {
    specLabel = tailFromName || "—";
  }

  const nameParts = primaryName ? [primaryName] : [];
  return { name: primaryName, specLabel, nameParts };
}
