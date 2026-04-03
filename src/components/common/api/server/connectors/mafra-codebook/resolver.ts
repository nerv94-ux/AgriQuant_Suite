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
type ItemRow = { MIDNAME: string; GOODNAME: string; MID: string; SMALL: string };

type MatchResult = {
  code: string | null;
  name: string | null;
  candidates: Array<{ code: string; name: string }>;
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
  const q = query?.trim() ?? "";
  if (!q) return { code: null, name: null, candidates: [] };
  const ranked = rows
    .map((row) => {
      const score = Math.max(rankTextMatch(q, row.GOODNAME), rankTextMatch(q, row.MIDNAME));
      const code = row.SMALL || row.MID;
      const name = row.GOODNAME || row.MIDNAME;
      return { score, code, name };
    })
    .filter((it) => it.score > 0 && Boolean(it.code) && Boolean(it.name))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((it) => ({ code: it.code, name: it.name }));
  return {
    code: ranked[0]?.code ?? null,
    name: ranked[0]?.name ?? null,
    candidates: ranked,
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

  const item = pickItemCandidates(params.request.itemName, freshItem.items);

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
