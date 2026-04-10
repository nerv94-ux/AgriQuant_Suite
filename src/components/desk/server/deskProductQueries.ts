import { DeskProductSource, type Prisma } from "@prisma/client";
import { prisma } from "@/components/common/auth/server/prisma";
import { deskProductDisplayFromStoredNameAndSpec, splitEcountProdCode } from "@/components/desk/server/ecountDeskDisplay";
import {
  attachListPrefs,
  getDeskProductUserPreferenceMap,
  sortDeskProductsForListMode,
  type DeskProductListSortMode,
  type DeskProductUserPreferenceDto,
  type DeskProductWithListPrefs,
} from "@/components/desk/server/deskProductUserPreferenceQueries";
import type { DeskProduct } from "@/types/deskProduct";

function optCode(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function mapSource(source: DeskProductSource): DeskProduct["source"] {
  return source === "ECOUNT" ? "ecount" : "manual";
}

function mapRow(r: {
  id: string;
  ecountProdCode: string | null;
  ecountCategorySuffix: string | null;
  deskEnabled: boolean;
  name: string;
  specLabel: string;
  packageUnit: string;
  mafraLarge: string | null;
  mafraMid: string | null;
  mafraSmall: string | null;
  mafraUnitCodeId: string | null;
  mafraGrdCodeId: string | null;
  mafraFrmlCodeId: string | null;
  ecoCtgryCd: string | null;
  ecoItemCd: string | null;
  ecoVrtyCd: string | null;
  ecoGrdCd: string | null;
  ecoSggCd: string | null;
  ecoMrktCd: string | null;
  source: DeskProductSource;
  hasOpenMarketMatch: boolean;
  displayLocked: boolean;
  needsSourceReview: boolean;
  updatedAt: Date;
}): DeskProduct {
  const { base: codeBase, suffix: codeSuffixFromCode } = splitEcountProdCode(r.ecountProdCode);

  /** 이카운트 동기화 품목: DB에 넣은 품목명·규격만 그대로 쓰고, `*` 뒤를 규격란으로 합치지 않음 */
  if (r.source === "ECOUNT") {
    const nameTrim = r.name.trim() || "—";
    const specTrim = r.specLabel.trim();
    const specDisplay = specTrim === "" || specTrim === "—" ? "—" : specTrim;
    return {
      id: r.id,
      ecountProdCode: r.ecountProdCode,
      ecountCodeBase: codeBase,
      ecountCodeSuffix: codeSuffixFromCode ?? r.ecountCategorySuffix,
      nameParts: nameTrim !== "—" ? [nameTrim] : [],
      deskEnabled: r.deskEnabled,
      name: nameTrim,
      specLabel: specDisplay,
      packageUnit: r.packageUnit.trim(),
      mafraLarge: optCode(r.mafraLarge),
      mafraMid: optCode(r.mafraMid),
      mafraSmall: optCode(r.mafraSmall),
      mafraUnitCodeId: optCode(r.mafraUnitCodeId),
      mafraGrdCodeId: optCode(r.mafraGrdCodeId),
      mafraFrmlCodeId: optCode(r.mafraFrmlCodeId),
      ecoCtgryCd: optCode(r.ecoCtgryCd),
      ecoItemCd: optCode(r.ecoItemCd),
      ecoVrtyCd: optCode(r.ecoVrtyCd),
      ecoGrdCd: optCode(r.ecoGrdCd),
      ecoSggCd: optCode(r.ecoSggCd),
      ecoMrktCd: optCode(r.ecoMrktCd),
      source: mapSource(r.source),
      hasOpenMarketMatch: r.hasOpenMarketMatch,
      displayLocked: r.displayLocked,
      needsSourceReview: r.needsSourceReview,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  const { name, specLabel, nameParts } = deskProductDisplayFromStoredNameAndSpec(r.name, r.specLabel);
  return {
    id: r.id,
    ecountProdCode: r.ecountProdCode,
    ecountCodeBase: codeBase,
    ecountCodeSuffix: codeSuffixFromCode ?? r.ecountCategorySuffix,
    nameParts,
    deskEnabled: r.deskEnabled,
    name,
    specLabel,
    packageUnit: r.packageUnit.trim(),
    mafraLarge: optCode(r.mafraLarge),
    mafraMid: optCode(r.mafraMid),
    mafraSmall: optCode(r.mafraSmall),
    mafraUnitCodeId: optCode(r.mafraUnitCodeId),
    mafraGrdCodeId: optCode(r.mafraGrdCodeId),
    mafraFrmlCodeId: optCode(r.mafraFrmlCodeId),
    ecoCtgryCd: optCode(r.ecoCtgryCd),
    ecoItemCd: optCode(r.ecoItemCd),
    ecoVrtyCd: optCode(r.ecoVrtyCd),
    ecoGrdCd: optCode(r.ecoGrdCd),
    ecoSggCd: optCode(r.ecoSggCd),
    ecoMrktCd: optCode(r.ecoMrktCd),
    source: mapSource(r.source),
    hasOpenMarketMatch: r.hasOpenMarketMatch,
    displayLocked: r.displayLocked,
    needsSourceReview: r.needsSourceReview,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export type DeskProductListFilter = "all" | "active" | "inactive";

const SEARCH_MAX = 100;

export type ListDeskProductsOptions = {
  /** 품목명·품목코드 부분 일치 (앞뒤 공백 제거, 최대 길이 제한) */
  q?: string;
  /** 있으면 개인 정렬·메타(즐겨찾기 등) 적용 */
  userId?: string;
  /** 기본 `my` — 개인 순서·즐겨찾기. `alpha`는 가나다만, `recent`는 최근 상세 방문 순 */
  sortMode?: DeskProductListSortMode;
};

export async function listDeskProducts(
  filter: DeskProductListFilter = "active",
  opts?: ListDeskProductsOptions,
): Promise<DeskProductWithListPrefs[]> {
  const qRaw = opts?.q?.trim().slice(0, SEARCH_MAX) ?? "";
  const parts: Prisma.DeskProductWhereInput[] = [];
  if (filter === "active") {
    parts.push({ deskEnabled: true });
  } else if (filter === "inactive") {
    parts.push({ deskEnabled: false });
  }
  if (qRaw.length > 0) {
    parts.push({
      OR: [
        { name: { contains: qRaw } },
        { specLabel: { contains: qRaw } },
        { packageUnit: { contains: qRaw } },
        { ecountProdCode: { contains: qRaw } },
        { mafraLarge: { contains: qRaw } },
        { mafraMid: { contains: qRaw } },
        { mafraSmall: { contains: qRaw } },
        { mafraUnitCodeId: { contains: qRaw } },
        { mafraGrdCodeId: { contains: qRaw } },
        { mafraFrmlCodeId: { contains: qRaw } },
      ],
    });
  }
  const where: Prisma.DeskProductWhereInput | undefined =
    parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : { AND: parts };

  /**
   * 목록만 필요한 필드만 읽음. `findMany()` 무인자는 행마다 지문·확정 메타 등까지 전부 실어
   * RSC 직렬화·메모리가 불필요하게 커짐(품목 수가 같아도 로우데이터·데스크 확장 이후 무거워진 원인之一).
   */
  const rows = await prisma.deskProduct.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      ecountProdCode: true,
      ecountCategorySuffix: true,
      deskEnabled: true,
      name: true,
      specLabel: true,
      packageUnit: true,
      mafraLarge: true,
      mafraMid: true,
      mafraSmall: true,
      mafraUnitCodeId: true,
      mafraGrdCodeId: true,
      mafraFrmlCodeId: true,
      ecoCtgryCd: true,
      ecoItemCd: true,
      ecoVrtyCd: true,
      ecoGrdCd: true,
      ecoSggCd: true,
      ecoMrktCd: true,
      source: true,
      hasOpenMarketMatch: true,
      displayLocked: true,
      needsSourceReview: true,
      updatedAt: true,
    },
  });
  const mapped = rows.map(mapRow);
  const uid = opts?.userId?.trim();
  const sortMode: DeskProductListSortMode = opts?.sortMode ?? "my";
  const emptyPrefs = new Map<string, DeskProductUserPreferenceDto>();
  if (!uid) {
    const sorted = sortDeskProductsForListMode(mapped, emptyPrefs, "alpha");
    return attachListPrefs(sorted, emptyPrefs);
  }
  const prefMap = await getDeskProductUserPreferenceMap(
    uid,
    mapped.map((p) => p.id),
  );
  const sorted = sortDeskProductsForListMode(mapped, prefMap, sortMode);
  return attachListPrefs(sorted, prefMap);
}

export async function getDeskProductById(id: string): Promise<DeskProduct | null> {
  const r = await prisma.deskProduct.findUnique({ where: { id } });
  if (!r) return null;
  return mapRow(r);
}
