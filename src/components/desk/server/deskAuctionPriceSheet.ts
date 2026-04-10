import type { ApiResponse } from "@/components/common/api/server/contracts";
import { buildError, buildSuccess } from "@/components/common/api/server/helpers/buildResponse";
import { resolveMafraCodebook } from "@/components/common/api/server/connectors/mafra-codebook";
import { listMafraMarketCodes } from "@/components/common/api/server/connectors/mafra-market-code";
import type { MafraMarketCode } from "@/components/common/api/server/connectors/mafra-market-code/types";
import { fetchMafraRealtimeAuctionInfo } from "@/components/common/api/server/connectors/mafra-rltm-auc-info";
import type { MafraRealtimeAuctionItem } from "@/components/common/api/server/connectors/mafra-rltm-auc-info/types";
import { filterRealtimeAuctionRowsByDeskItem } from "@/components/desk/server/filterMafraRealtimeRowsByItem";
import {
  deskProductItemSearchQueries,
  deskProductNameTokensForPlausibility,
} from "@/components/desk/server/deskProductMafraItemQuery";
import { getDeskProductById } from "@/components/desk/server/deskProductQueries";
import type { DeskProduct } from "@/types/deskProduct";
import {
  DESK_AUCTION_DEFAULT_MAX_MARKETS,
  DESK_AUCTION_MAX_ROWS_PER_MARKET,
  type DeskAuctionPriceSheetData,
  type DeskAuctionPriceSheetDetailRow,
  type DeskAuctionPriceSheetMarketRow,
} from "@/types/deskAuctionPriceSheet";

const SOURCE = "GARAK" as const;

export const DEFAULT_DESK_AUCTION_MAX_MARKETS = DESK_AUCTION_DEFAULT_MAX_MARKETS;
const ROWS_PER_MARKET = DESK_AUCTION_MAX_ROWS_PER_MARKET;
const PARALLEL_MARKETS = 4;

function parseCost(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/** 코드사전에만 나오는 광의 소분류명 — 자동 매칭으로는 채택하지 않음(수동 저장 허용) */
function isGenericMafraMatchedName(name: string | null): boolean {
  if (!name?.trim()) return false;
  const t = name.trim().toLowerCase();
  if (t === "기타" || t.startsWith("기타(") || t.startsWith("기타 ")) return true;
  if (t.includes("기타품목") || t === "미분류" || t === "기타농산물") return true;
  return false;
}

function isGarakMarket(name: string): boolean {
  return /가락/.test(name);
}

function sortMarketsGarakFirst(items: MafraMarketCode[]): MafraMarketCode[] {
  return [...items].sort((a, b) => {
    const ga = isGarakMarket(a.CODENAME) ? 0 : 1;
    const gb = isGarakMarket(b.CODENAME) ? 0 : 1;
    if (ga !== gb) return ga - gb;
    return a.CODENAME.localeCompare(b.CODENAME, "ko");
  });
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  }
  const poolSize = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));
  return results;
}

/** 코드사전 품목명이 데스크 품목과 같은 계열인지(토큰 겹침 또는 짧은 품목명 포함 관계) */
function isCodebookMatchPlausible(product: DeskProduct, matchedItemName: string | null): boolean {
  if (!matchedItemName?.trim()) return true;
  const tokens = deskProductNameTokensForPlausibility(product);
  const lower = matchedItemName.toLowerCase();
  const nameCore = (product.name.split("*")[0] ?? product.name).trim().toLowerCase();
  if (tokens.length === 0) return true;
  if (tokens.some((t) => lower.includes(t.toLowerCase()))) return true;
  if (nameCore.length >= 2 && lower.includes(nameCore)) return true;
  return false;
}

async function resolveMafraItemForDeskProduct(
  product: DeskProduct,
  requestId: string,
): Promise<{
  small: string;
  large: string;
  mid: string;
  fromCodebook: boolean;
  itemResolutionSource: "db" | "codebook";
  codebookMatchedQuery: string | null;
  codebookMatchedItemName: string | null;
  codebookPlausibilitySkipped: boolean;
} | null> {
  const dbSmall = product.mafraSmall?.trim();
  if (dbSmall) {
    return {
      small: dbSmall,
      large: product.mafraLarge?.trim() ?? "",
      mid: product.mafraMid?.trim() ?? "",
      fromCodebook: false,
      itemResolutionSource: "db",
      codebookMatchedQuery: null,
      codebookMatchedItemName: null,
      codebookPlausibilitySkipped: false,
    };
  }

  const queries = deskProductItemSearchQueries(product);
  if (queries.length === 0) {
    return null;
  }

  async function tryResolve(
    requirePlausible: boolean,
    phase: string,
  ): Promise<{
    small: string;
    large: string;
    mid: string;
    codebookMatchedQuery: string;
    codebookMatchedItemName: string | null;
  } | null> {
    for (let i = 0; i < queries.length; i++) {
      const itemName = queries[i]!;
      const resolved = await resolveMafraCodebook({
        requestId: `${requestId}-${phase}-${i}`,
        appId: "desk-auction-price-sheet",
        request: { itemName, preferGarakItemCode: true, deskItemMatch: true },
      });
      const small = resolved.item.code?.trim() ?? "";
      const candName = resolved.item.name ?? null;
      if (!small) continue;
      if (isGenericMafraMatchedName(candName)) continue;
      if (requirePlausible && !isCodebookMatchPlausible(product, candName)) continue;
      return {
        small,
        large: resolved.item.largeCode?.trim() ?? product.mafraLarge?.trim() ?? "",
        mid: resolved.item.midCode?.trim() ?? product.mafraMid?.trim() ?? "",
        codebookMatchedQuery: itemName,
        codebookMatchedItemName: candName,
      };
    }
    return null;
  }

  const strict = await tryResolve(true, "strict");
  if (strict) {
    return {
      ...strict,
      fromCodebook: true,
      itemResolutionSource: "codebook",
      codebookPlausibilitySkipped: false,
    };
  }

  const relaxed = await tryResolve(false, "relaxed");
  if (relaxed) {
    return {
      ...relaxed,
      fromCodebook: true,
      itemResolutionSource: "codebook",
      codebookPlausibilitySkipped: true,
    };
  }

  return null;
}

function mapAuctionDetailRow(r: MafraRealtimeAuctionItem): DeskAuctionPriceSheetDetailRow {
  return {
    cost: r.COST,
    qty: r.QTY,
    std: r.STD,
    sbidtime: r.SBIDTIME,
    cmpName: r.CMPNAME,
    smallCode: r.SMALL,
    smallName: r.SMALLNAME,
    midName: r.MIDNAME,
    sanName: r.SANNAME,
  };
}

function statsFromRows(costs: number[]): Pick<
  DeskAuctionPriceSheetMarketRow,
  "avgCost" | "minCost" | "maxCost" | "firstCost"
> {
  if (costs.length === 0) {
    return { avgCost: null, minCost: null, maxCost: null, firstCost: null };
  }
  const sum = costs.reduce((a, b) => a + b, 0);
  return {
    avgCost: Math.round((sum / costs.length) * 100) / 100,
    minCost: Math.min(...costs),
    maxCost: Math.max(...costs),
    firstCost: costs[0] ?? null,
  };
}

export async function fetchDeskAuctionPriceSheet(params: {
  requestId: string;
  deskProductId: string;
  saleDate: string;
  maxMarkets?: number;
}): Promise<ApiResponse<DeskAuctionPriceSheetData>> {
  const startedAt = performance.now();
  const saleDate = params.saleDate.trim();
  if (!/^\d{8}$/.test(saleDate)) {
    return buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: "saleDate는 YYYYMMDD 형식이어야 합니다.",
    });
  }

  const cap = Math.max(1, Math.min(80, params.maxMarkets ?? DESK_AUCTION_DEFAULT_MAX_MARKETS));

  const product = await getDeskProductById(params.deskProductId);
  if (!product) {
    return buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: "품목을 찾을 수 없습니다.",
    });
  }

  const resolvedItem = await resolveMafraItemForDeskProduct(product, params.requestId);
  if (!resolvedItem) {
    return buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message:
        "품목명·규격으로 농식품 품목코드를 찾지 못했습니다. 품목명·규격을 코드사전과 비슷하게 맞추거나, 고급 메뉴에서 대·중·소를 직접 저장해 주세요.",
    });
  }

  const {
    small,
    large: largeResolved,
    mid: midResolved,
    fromCodebook: smallResolvedFromCodebook,
    itemResolutionSource,
    codebookMatchedQuery,
    codebookMatchedItemName,
    codebookPlausibilitySkipped,
  } = resolvedItem;
  const large = largeResolved;
  const mid = midResolved;

  const marketsListed = await listMafraMarketCodes({
    requestId: `${params.requestId}-markets`,
    appId: "desk-auction-price-sheet",
    forceSync: false,
  });
  if (!marketsListed.ok || !marketsListed.data) {
    return buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: marketsListed.ok === false ? marketsListed.message : "도매시장 목록을 불러오지 못했습니다.",
    });
  }

  const ordered = sortMarketsGarakFirst(marketsListed.data.items).slice(0, cap);

  let totalSmallMismatchDropped = 0;

  const markets = await mapPool(ordered, PARALLEL_MARKETS, async (m) => {
    const row: DeskAuctionPriceSheetMarketRow = {
      whsalcd: m.CODEID,
      marketName: m.CODENAME,
      apiWhsalName: null,
      apiTotalCount: null,
      rowCount: 0,
      avgCost: null,
      minCost: null,
      maxCost: null,
      firstCost: null,
      isGarak: isGarakMarket(m.CODENAME),
      detailRows: [],
    };

    // 짧은 SMALL(예: 01)만 API에 넣으면 품목이 유일하지 않아 여러 품목이 섞일 수 있음.
    // DB에 대·중·소가 모두 있으면 API에도 세 값을 함께 넣는다. 없으면 SMALL만.
    const hasFullTriplet = Boolean(large?.trim() && mid?.trim() && small?.trim());
    const auction = await fetchMafraRealtimeAuctionInfo({
      requestId: `${params.requestId}-m-${m.CODEID}`,
      appId: "desk-auction-price-sheet",
      request: {
        saleDate,
        whsalcd: m.CODEID,
        large: hasFullTriplet ? large : "",
        mid: hasFullTriplet ? mid : "",
        small,
        deskStrictItem: {
          small,
          ...(large?.trim() ? { large: large.trim() } : {}),
          ...(mid?.trim() ? { mid: mid.trim() } : {}),
        },
        startIndex: 1,
        endIndex: ROWS_PER_MARKET,
        autoResolveCodes: false,
      },
    });

    if (!auction.ok || !auction.data) {
      return {
        ...row,
        error: auction.ok === false ? auction.message : "경매 조회에 실패했습니다.",
      };
    }

    const rawRows = auction.data.rows;
    const beforeFilter = rawRows.length;
    const apiRows = filterRealtimeAuctionRowsByDeskItem(rawRows, { small, large, mid });
    const droppedHere = beforeFilter - apiRows.length;
    if (droppedHere > 0) totalSmallMismatchDropped += droppedHere;
    const costs = apiRows.map((r) => parseCost(r.COST)).filter((n): n is number => n != null);
    const firstName = apiRows[0]?.WHSALNAME?.trim();
    const totalCnt = auction.data.totalCount;
    return {
      ...row,
      apiWhsalName: firstName ? firstName : null,
      apiTotalCount: Number.isFinite(totalCnt) ? totalCnt : null,
      rowCount: apiRows.length,
      detailRows: apiRows.map(mapAuctionDetailRow),
      ...statsFromRows(costs),
    };
  });

  const sheetMessage =
    totalSmallMismatchDropped > 0
      ? `전국 도매시장 실시간 경매 ${markets.length}곳 · 조회는 소(SMALL)만 · 불일치 행 ${totalSmallMismatchDropped}건 제외`
      : `전국 도매시장 실시간 경매 ${markets.length}곳 · 조회는 소(SMALL)만(시장별 대·중 불일치 방지)`;

  return buildSuccess<DeskAuctionPriceSheetData>({
    source: SOURCE,
    requestId: params.requestId,
    startedAt,
    message: sheetMessage,
    data: {
      productId: product.id,
      productName: product.name,
      specLabel: product.specLabel,
      packageUnit: product.packageUnit,
      saleDate,
      mafraLarge: large ? large : null,
      mafraMid: mid ? mid : null,
      mafraSmall: small,
      mafraGrdCodeId: product.mafraGrdCodeId ?? null,
      smallResolvedFromCodebook,
      itemResolutionSource,
      codebookMatchedQuery,
      codebookMatchedItemName,
      codebookPlausibilitySkipped,
      marketsInCache: marketsListed.data.total,
      marketsQueried: markets.length,
      maxMarketsCap: cap,
      rowsSampledPerMarket: ROWS_PER_MARKET,
      marketCodesUpdatedAt: marketsListed.data.updatedAt ?? null,
      markets,
    },
  });
}
