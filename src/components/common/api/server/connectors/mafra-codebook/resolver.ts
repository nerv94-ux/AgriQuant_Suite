import { loadMafraCorpCodeCache, loadMafraFrmlCodeCache, loadMafraGrdCodeCache, loadMafraItemCodeCache, loadMafraMarketCodeCache, loadMafraPlorCodeCache, loadMafraUnitCodeCache } from "../../admin/mafraItemCodeStore";
import { syncMafraCorpCodes } from "../mafra-corp-code";
import { syncMafraFrmlCodes } from "../mafra-frml-code";
import { syncMafraGrdCodes } from "../mafra-grd-code";
import { syncMafraItemCodes } from "../mafra-item-code";
import { syncMafraMarketCodes } from "../mafra-market-code";
import { syncMafraPlorCodes } from "../mafra-plor-code";
import { syncMafraUnitCodes } from "../mafra-unit-code";

const CACHE_TTL_MS = 60 * 60 * 1000;

type CodeRow = { CODEID: string; CODENAME: string };
/** 품목코드 캐시 행 — 실시간 경매 등에서 상품명(긴 문자열·`*` 구분)으로 SMALL을 찾을 때 사용 */
type ItemRow = {
  LARGE?: string;
  LARGENAME?: string;
  MIDNAME: string;
  GOODNAME: string;
  MID: string;
  SMALL: string;
};

type MatchResult = {
  code: string | null;
  name: string | null;
  candidates: Array<{ code: string; name: string }>;
  /** `pickItemCandidates`가 고른 행의 대·중 코드(실시간 경매 등 조회 보조). 다른 종류 매칭에서는 비움 */
  largeCode?: string | null;
  midCode?: string | null;
};

export type MafraCodebookResolveRequest = {
  marketName?: string;
  corpName?: string;
  itemName?: string;
  originName?: string;
  unitName?: string;
  packageName?: string;
  gradeName?: string;
  preferGarakItemCode?: boolean;
  forceSync?: boolean;
  /**
   * 데스크 품목 시세용: `기타` 등 광의 소분류 가점을 줄이고, 품목명(당근 등)과 GOODNAME 일치에 가점.
   * 관리자 일반 코드북 해석에는 넣지 않음.
   */
  deskItemMatch?: boolean;
};

export type MafraCodebookResolveResponse = {
  market: MatchResult;
  corp: MatchResult;
  item: MatchResult;
  origin: MatchResult;
  unit: MatchResult;
  package: MatchResult;
  grade: MatchResult;
  cacheUpdatedAt: Record<string, string | null>;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function rankTextMatch(query: string, name: string) {
  const q = normalizeText(query);
  const n = normalizeText(name);
  if (!q || !n) return 0;
  if (q === n) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  return 0;
}

/** 상품명·품목명에 표준 품종명이 포함되는 경우(예: `국산 당근 5kg` ↔ GOODNAME `당근`) */
function rankItemNameMatch(query: string, row: ItemRow): number {
  const good = row.GOODNAME ?? "";
  const mid = row.MIDNAME ?? "";
  const large = row.LARGENAME ?? "";
  const qRaw = query.trim();
  if (!qRaw) return 0;

  let best = Math.max(
    rankTextMatch(qRaw, good),
    rankTextMatch(qRaw, mid),
    rankTextMatch(qRaw, large),
  );

  const q = normalizeText(qRaw);
  const g = normalizeText(good);
  const m = normalizeText(mid);
  const l = normalizeText(large);

  if (g.length >= 2 && q.includes(g)) best = Math.max(best, 94);
  if (m.length >= 2 && q.includes(m)) best = Math.max(best, 91);
  if (l.length >= 2 && q.includes(l)) best = Math.max(best, 87);

  const tokens = qRaw
    .split(/[\s*\/|,\[\]()]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);
  for (const tok of tokens) {
    if (g.includes(tok)) best = Math.max(best, 82);
    if (m.includes(tok)) best = Math.max(best, 80);
    if (l.includes(tok)) best = Math.max(best, 76);
  }

  return best;
}

/** 이카운트 `*` 앞 품목명, 띄어쓰기 단위 등으로 여러 후보 문장을 만들어 매칭 확률을 높임 */
function deriveItemSearchQueries(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const set = new Set<string>();
  set.add(t);
  const beforeStar = t.split("*")[0]?.trim();
  if (beforeStar) set.add(beforeStar);
  for (const part of t.split(/[\s*\/|,\[\]()]+/)) {
    const p = part.trim();
    if (p.length >= 2) set.add(p);
  }
  return [...set];
}

function pickTopCandidates(query: string | undefined, rows: CodeRow[]): MatchResult {
  const q = query?.trim() ?? "";
  if (!q) return { code: null, name: null, candidates: [] };
  const ranked = rows
    .map((row) => ({ row, score: rankTextMatch(q, row.CODENAME) }))
    .filter((it) => it.score > 0)
    .sort((a, b) => b.score - a.score || a.row.CODENAME.localeCompare(b.row.CODENAME))
    .slice(0, 5)
    .map((it) => ({ code: it.row.CODEID, name: it.row.CODENAME }));
  return {
    code: ranked[0]?.code ?? null,
    name: ranked[0]?.name ?? null,
    candidates: ranked,
  };
}

function pickItemCandidates(query: string | undefined, rows: ItemRow[]): MatchResult {
  const queries = deriveItemSearchQueries(query?.trim() ?? "");
  if (queries.length === 0) return { code: null, name: null, candidates: [] };
  const ranked = rows
    .map((row) => {
      const score = Math.max(...queries.map((q) => rankItemNameMatch(q, row)));
      const code = row.SMALL || row.MID;
      const name = row.GOODNAME || row.MIDNAME;
      return { score, row, code, name };
    })
    .filter((it) => it.score > 0 && Boolean(it.code) && Boolean(it.name))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const top = ranked[0];
  const candidates = ranked.slice(0, 5).map((it) => ({ code: it.code, name: it.name }));
  const largeRaw = top?.row.LARGE?.trim();
  const midRaw = top?.row.MID?.trim();
  return {
    code: top?.code ?? null,
    name: top?.name ?? null,
    candidates,
    largeCode: largeRaw ? largeRaw : null,
    midCode: midRaw ? midRaw : null,
  };
}

/** `기타`·미분류 등 광의 라벨 — 데스크 매칭에서 후순위 */
function isGenericMafraItemLabel(label: string): boolean {
  const t = label.trim().toLowerCase();
  if (t.length === 0) return true;
  if (t === "기타" || t.startsWith("기타(") || t.startsWith("기타 ")) return true;
  if (t.includes("기타품목") || t === "미분류" || t === "기타농산물") return true;
  return false;
}

/** 검색어에서 숫자·단위 토큰을 건너뛰고 품목 키워드(당근 등) 추출 */
function primaryCropTokenFromQuery(query: string): string {
  const parts = query
    .trim()
    .split(/[\s*\/|,\[\]()]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (/^\d+([.,]\d+)?\s*(g|kg|ml|l|m|개|입|포|장)?$/i.test(part)) continue;
    if (part.length >= 2) return part;
  }
  return parts[0] ?? "";
}

/**
 * 데스크 전용: 동일 코드사전 캐시에서 `기타` 류 가점을 줄이고, 품목 키워드와 GOODNAME 일치에 가점.
 */
function pickItemCandidatesForDesk(query: string | undefined, rows: ItemRow[]): MatchResult {
  const qRaw = query?.trim() ?? "";
  const queries = deriveItemSearchQueries(qRaw);
  if (queries.length === 0) return { code: null, name: null, candidates: [] };

  const primary = primaryCropTokenFromQuery(qRaw);
  const GENERIC_PENALTY = 50;
  const EXACT_GOOD_BOOST = 40;
  const PREFIX_GOOD_BOOST = 22;
  const SUBSTRING_GOOD_BOOST = 12;

  const scored = rows
    .map((row) => {
      let score = Math.max(...queries.map((q) => rankItemNameMatch(q, row)));
      const good = (row.GOODNAME ?? "").trim();
      const g = normalizeText(good);
      const p = normalizeText(primary);

      if (primary.length >= 2) {
        if (p && g === p) score += EXACT_GOOD_BOOST;
        else if (p && g.startsWith(p)) score += PREFIX_GOOD_BOOST;
        else if (p && g.includes(p)) score += SUBSTRING_GOOD_BOOST;
      }

      const label = good || (row.MIDNAME ?? "");
      if (isGenericMafraItemLabel(label)) {
        score = Math.max(0, score - GENERIC_PENALTY);
      }

      /** 데스크 시세: `MID`를 소분류처럼 쓰면 경매 API가 한 중분류 안의 온갖 소품목을 준다. 반드시 그리드 `SMALL`만 사용. */
      const code = (row.SMALL ?? "").trim();
      if (!code) return null;
      const name = row.GOODNAME || row.MIDNAME;
      return { score, row, code, name };
    })
    .filter((it): it is NonNullable<typeof it> => it != null)
    .filter((it) => it.score > 0 && Boolean(it.name));

  const ranked = scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  if (ranked.length === 0) {
    return { code: null, name: null, candidates: [] };
  }

  const top = ranked[0]!;
  const candidates = ranked.slice(0, 5).map((it) => ({ code: it.code, name: it.name }));
  const largeRaw = top.row.LARGE?.trim();
  const midRaw = top.row.MID?.trim();
  return {
    code: top.code ?? null,
    name: top.name ?? null,
    candidates,
    largeCode: largeRaw ? largeRaw : null,
    midCode: midRaw ? midRaw : null,
  };
}

async function ensureFresh(params: {
  forceSync?: boolean;
  updatedAt: string | null;
  sync: () => Promise<{ ok: boolean }>;
}) {
  const stale = !params.updatedAt || Date.now() - new Date(params.updatedAt).getTime() > CACHE_TTL_MS;
  if (!params.forceSync && !stale) return;
  await params.sync();
}

export async function resolveMafraCodebook(params: {
  requestId: string;
  appId?: string;
  request: MafraCodebookResolveRequest;
}): Promise<MafraCodebookResolveResponse> {
  const marketCache = await loadMafraMarketCodeCache();
  const corpCache = await loadMafraCorpCodeCache();
  const itemCache = await loadMafraItemCodeCache();
  const originCache = await loadMafraPlorCodeCache();
  const unitCache = await loadMafraUnitCodeCache();
  const packageCache = await loadMafraFrmlCodeCache();
  const gradeCache = await loadMafraGrdCodeCache();

  await Promise.all([
    ensureFresh({
      forceSync: params.request.forceSync,
      updatedAt: marketCache.updatedAt,
      sync: async () => syncMafraMarketCodes({ requestId: `${params.requestId}-market-sync`, appId: params.appId }),
    }),
    ensureFresh({
      forceSync: params.request.forceSync,
      updatedAt: corpCache.updatedAt,
      sync: async () => syncMafraCorpCodes({ requestId: `${params.requestId}-corp-sync`, appId: params.appId }),
    }),
    ensureFresh({
      forceSync: params.request.forceSync,
      updatedAt: itemCache.updatedAt,
      sync: async () => syncMafraItemCodes({ requestId: `${params.requestId}-item-sync`, appId: params.appId }),
    }),
    ensureFresh({
      forceSync: params.request.forceSync,
      updatedAt: originCache.updatedAt,
      sync: async () => syncMafraPlorCodes({ requestId: `${params.requestId}-origin-sync`, appId: params.appId }),
    }),
    ensureFresh({
      forceSync: params.request.forceSync,
      updatedAt: unitCache.updatedAt,
      sync: async () => syncMafraUnitCodes({ requestId: `${params.requestId}-unit-sync`, appId: params.appId }),
    }),
    ensureFresh({
      forceSync: params.request.forceSync,
      updatedAt: packageCache.updatedAt,
      sync: async () => syncMafraFrmlCodes({ requestId: `${params.requestId}-package-sync`, appId: params.appId }),
    }),
    ensureFresh({
      forceSync: params.request.forceSync,
      updatedAt: gradeCache.updatedAt,
      sync: async () => syncMafraGrdCodes({ requestId: `${params.requestId}-grade-sync`, appId: params.appId }),
    }),
  ]);

  const freshMarket = await loadMafraMarketCodeCache();
  const freshCorp = await loadMafraCorpCodeCache();
  const freshItem = await loadMafraItemCodeCache();
  const freshOrigin = await loadMafraPlorCodeCache();
  const freshUnit = await loadMafraUnitCodeCache();
  const freshPackage = await loadMafraFrmlCodeCache();
  const freshGrade = await loadMafraGrdCodeCache();

  const item = params.request.deskItemMatch
    ? pickItemCandidatesForDesk(params.request.itemName, freshItem.items)
    : pickItemCandidates(params.request.itemName, freshItem.items);

  return {
    market: pickTopCandidates(params.request.marketName, freshMarket.items),
    corp: pickTopCandidates(params.request.corpName, freshCorp.items),
    item,
    origin: pickTopCandidates(params.request.originName, freshOrigin.items),
    unit: pickTopCandidates(params.request.unitName, freshUnit.items),
    package: pickTopCandidates(params.request.packageName, freshPackage.items),
    grade: pickTopCandidates(params.request.gradeName, freshGrade.items),
    cacheUpdatedAt: {
      market: freshMarket.updatedAt,
      corp: freshCorp.updatedAt,
      item: freshItem.updatedAt,
      origin: freshOrigin.updatedAt,
      unit: freshUnit.updatedAt,
      package: freshPackage.updatedAt,
      grade: freshGrade.updatedAt,
    },
  };
}
