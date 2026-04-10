import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getMafraApiKey, loadMafraItemCodeCache } from "../../admin/mafraItemCodeStore";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import { resolveMafraCodebook } from "../mafra-codebook";
import type {
  MafraDataClclnPrcItem,
  MafraDataClclnPrcRequest,
  MafraDataClclnPrcResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
const API_URL = "Grid_20240625000000000655_1";

function normalizeRowList(value: unknown): Record<string, unknown>[] {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

/** 숫자 코드 `01`/`1` 등 동일 취급 — LARGE·MID·SMALL 공통 */
function segmentCodesEqualApi(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (x === y) return true;
  if (x === "" || y === "") return false;
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
    try {
      return BigInt(x) === BigInt(y);
    } catch {
      return Number.parseInt(x, 10) === Number.parseInt(y, 10);
    }
  }
  return false;
}

/** SMALL 우선; 비어 있을 때만 MMCD(다른 의미일 수 있어 OR 매칭은 쓰지 않음) */
function rowSmallMatches(row: Record<string, unknown>, want: string): boolean {
  const w = want.trim();
  if (!w) return true;
  const sm = String(row.SMALL ?? row.small ?? "").trim();
  if (sm) return segmentCodesEqualApi(sm, w);
  const mm = String(row.MMCD ?? row.mmcd ?? "").trim();
  if (mm) return segmentCodesEqualApi(mm, w);
  return false;
}

function normalizeKeywordText(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function deriveKeywordTokens(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const set = new Set<string>();
  set.add(t);
  for (const part of t.split(/[\s*\/|,\[\]()]+/)) {
    const p = part.trim();
    if (p.length >= 2) set.add(p);
  }
  return [...set].map((x) => normalizeKeywordText(x)).filter((x) => x.length >= 2);
}

function rowMatchesItemKeywords(row: Record<string, unknown>, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const g = normalizeKeywordText(row.GOODNAME);
  const p = normalizeKeywordText(row.PUMNAME);
  const c = normalizeKeywordText(row.CMPGOOD);
  return tokens.some((tok) => g.includes(tok) || p.includes(tok) || c.includes(tok));
}

async function deriveCodebookItemTokens(large: string, mid: string, small: string): Promise<string[]> {
  const s = small.trim();
  if (!s) return [];
  const cache = await loadMafraItemCodeCache();
  const l = large.trim();
  const m = mid.trim();
  const tokens = new Set<string>();
  for (const item of cache.items) {
    if (!segmentCodesEqualApi(String(item.SMALL ?? "").trim(), s)) continue;
    if (l && !segmentCodesEqualApi(String(item.LARGE ?? "").trim(), l)) continue;
    if (m && !segmentCodesEqualApi(String(item.MID ?? "").trim(), m)) continue;
    for (const name of [item.GOODNAME, item.MIDNAME]) {
      const n = normalizeKeywordText(name);
      if (n.length >= 2) tokens.add(n);
    }
  }
  return [...tokens];
}

/**
 * 품목 좁히기: SMALL/MMCD + LARGE + MID를 모두 엄격히 확인.
 * 요청에 LARGE/MID가 있으면 행에도 값이 있어야 하며 정확히 일치해야 통과.
 */
function rowMatchesProductCodes(
  row: Record<string, unknown>,
  large: string,
  mid: string,
  small: string,
): boolean {
  const s = small.trim();
  if (!s) return true;
  if (!rowSmallMatches(row, s)) return false;
  const l = large.trim();
  const m = mid.trim();
  const rowL = String(row.LARGE ?? "").trim();
  const rowM = String(row.MID ?? "").trim();
  if (l && (!rowL || !segmentCodesEqualApi(rowL, l))) return false;
  if (m && (!rowM || !segmentCodesEqualApi(rowM, m))) return false;
  return true;
}

function buildDataClclnUrl(apiKey: string, startIndex: number, endIndex: number, search: URLSearchParams) {
  return `${BASE_HOST}/${encodeURIComponent(apiKey)}/json/${API_URL}/${startIndex}/${endIndex}?${search.toString()}`;
}

/** 시장·법인·일자만 넓게 받은 뒤 totalCnt 초과분 추가 페이지(상한) */
async function appendWidePages(
  apiKey: string,
  saleDate: string,
  whsalcd: string,
  cmpcd: string,
  base: { rows: MafraDataClclnPrcItem[]; totalCount: number },
): Promise<MafraDataClclnPrcItem[]> {
  const cap = Math.min(base.totalCount, 2500);
  let merged = [...base.rows];
  let nextStart = merged.length + 1;
  while (nextStart <= cap) {
    const end = Math.min(nextStart + 499, cap);
    const searchWide = new URLSearchParams({ SALEDATE: saleDate });
    if (whsalcd) searchWide.set("WHSALCD", whsalcd);
    if (cmpcd) searchWide.set("CMPCD", cmpcd);
    const url = buildDataClclnUrl(apiKey, nextStart, end, searchWide);
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    if (!res.ok || text.trim().startsWith("<")) break;
    const p = parsePayload(text);
    if (p.code !== "INFO-000" && p.code !== "INFO-200") break;
    merged.push(...p.rows);
    if (p.rows.length === 0) break;
    nextStart = end + 1;
  }
  return merged;
}

function parsePayload(rawText: string): {
  code: string;
  message: string;
  totalCount: number;
  rows: MafraDataClclnPrcItem[];
} {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const rootKey = Object.keys(parsed)[0];
  const root = (rootKey ? parsed[rootKey] : parsed) as Record<string, unknown>;
  const result = (root.result ?? {}) as Record<string, unknown>;
  const rowsRaw = normalizeRowList(root.row);
    const rows = rowsRaw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      SALEDATE: String(row.SALEDATE ?? row.saledate ?? ""),
      WHSALCD: String(row.WHSALCD ?? row.whsalcd ?? ""),
      CMPCD: String(row.CMPCD ?? row.cmpcd ?? ""),
      SEQ: String(row.SEQ ?? ""),
      NO1: String(row.NO1 ?? ""),
      NO2: String(row.NO2 ?? ""),
      MEJANG: String(row.MEJANG ?? ""),
      MMCD: String(row.MMCD ?? row.mmcd ?? ""),
      LARGE: String(row.LARGE ?? row.large ?? ""),
      MID: String(row.MID ?? row.mid ?? ""),
      SMALL: String(row.SMALL ?? row.small ?? ""),
      CMPGOOD: String(row.CMPGOOD ?? ""),
      PUMNAME: String(row.PUMNAME ?? ""),
      GOODNAME: String(row.GOODNAME ?? ""),
      DANQ: String(row.DANQ ?? ""),
      DANCD: String(row.DANCD ?? ""),
      POJCD: String(row.POJCD ?? ""),
      SIZECD: String(row.SIZECD ?? ""),
      LVCD: String(row.LVCD ?? ""),
      QTY: String(row.QTY ?? ""),
      COST: String(row.COST ?? ""),
      AMERCD: String(row.AMERCD ?? ""),
      SANCD: String(row.SANCD ?? ""),
      CMPSAN: String(row.CMPSAN ?? ""),
      SANNAME: String(row.SANNAME ?? ""),
      CHCD: String(row.CHCD ?? ""),
      SMANCD: String(row.SMANCD ?? ""),
      CHULNO: String(row.CHULNO ?? ""),
      CHULCD: String(row.CHULCD ?? ""),
      CHULNAME: String(row.CHULNAME ?? ""),
      FARMNAME: String(row.FARMNAME ?? ""),
      TOTQTY: String(row.TOTQTY ?? ""),
      TOTAMT: String(row.TOTAMT ?? ""),
      SBIDTIME: String(row.SBIDTIME ?? ""),
    }));
  const totalCount = Number(root.totalCnt ?? 0);
  return {
    code: String(result.code ?? ""),
    message: String(result.message ?? ""),
    totalCount: Number.isFinite(totalCount) ? totalCount : rows.length,
    rows,
  };
}

function toPositiveInt(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

function mapErrorCategory(code: string) {
  if (code === "INFO-100") return ApiErrorCategory.AUTH_ERROR;
  if (code === "ERROR-350") return ApiErrorCategory.RATE_LIMIT;
  if (code.startsWith("ERROR-")) return ApiErrorCategory.VALIDATION_ERROR;
  return ApiErrorCategory.UNKNOWN;
}

export async function fetchMafraDataClclnPrc(params: {
  requestId: string;
  appId?: string;
  request: MafraDataClclnPrcRequest;
}): Promise<ApiResponse<MafraDataClclnPrcResponseData>> {
  const startedAt = performance.now();
  const apiKey = await getMafraApiKey();
  if (!apiKey) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.AUTH_ERROR,
      message: "MAFRA_API_KEY가 설정되지 않았습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const saleDate = params.request.saleDate?.trim() ?? "";
  if (!/^\d{8}$/.test(saleDate)) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "saleDate는 YYYYMMDD 형식이어야 합니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const filterByProduct = params.request.filterByProductCodes === true;
  const looseSmallOnly = params.request.looseSmallMatch === true;

  let matchPolicy = "시장·법인 자동해석";

  let whsalcd = params.request.whsalcd?.trim() ?? "";
  let cmpcd = params.request.cmpcd?.trim() ?? "";
  let large = params.request.large?.trim() ?? "";
  let mid = params.request.mid?.trim() ?? "";
  let small = params.request.small?.trim() ?? "";

  const preferSaved =
    params.request.preferSavedItemCodes === true &&
    filterByProduct &&
    Boolean(large && mid && small);

  if (preferSaved) {
    matchPolicy = "저장 LARGE/MID/SMALL 고정 · 시장·법인만 자동해석";
    if (params.request.autoResolveCodes !== false && (!whsalcd || !cmpcd)) {
      const resolved = await resolveMafraCodebook({
        requestId: `${params.requestId}-resolve`,
        appId: params.appId,
        request: {
          marketName: params.request.whsalName,
          corpName: params.request.cmpName,
        },
      });
      whsalcd ||= resolved.market.code ?? "";
      cmpcd ||= resolved.corp.code ?? "";
    }
  } else if (
    params.request.autoResolveCodes !== false &&
    (!whsalcd || !cmpcd || (filterByProduct && !small))
  ) {
    matchPolicy = filterByProduct ? "품목명·코드사전 자동해석" : "시장·법인 자동해석";
    const resolved = await resolveMafraCodebook({
      requestId: `${params.requestId}-resolve`,
      appId: params.appId,
      request: {
        marketName: params.request.whsalName,
        corpName: params.request.cmpName,
        itemName: filterByProduct ? params.request.itemName : undefined,
        preferGarakItemCode: params.request.preferGarakItemCode,
        deskItemMatch: params.request.deskItemMatch === true,
      },
    });
    whsalcd ||= resolved.market.code ?? "";
    cmpcd ||= resolved.corp.code ?? "";
    if (filterByProduct) {
      small ||= resolved.item.code ?? "";
      large ||= resolved.item.largeCode ?? "";
      mid ||= resolved.item.midCode ?? "";
    }
  }

  if (filterByProduct && !small) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: params.request.itemName?.trim()
        ? "itemName을 SMALL 코드로 해석하지 못했습니다. LARGE/MID/SMALL을 직접 입력하거나 품목명을 바꿔 주세요."
        : "품목별 원천 조회에는 LARGE/MID/SMALL을 입력하거나 품목명(itemName)을 넘겨 자동 해석해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  const startIndex = toPositiveInt(params.request.startIndex, 1);
  const endIndex = Math.max(startIndex, toPositiveInt(params.request.endIndex, 100));
  if (endIndex - startIndex > 1000) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "한 번의 조회 범위는 최대 1000건입니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }

  /**
   * 그리드 655는 653과 달리 URL에 LARGE·MID까지 넣으면 0건으로 떨어지는 사례가 있어,
   * 품목 조건은 **SMALL만** 쿼리에 넣고 대·중은 응답 행으로 맞춘다(실시간 경매 SMALL-only 정책과 동일 취지).
   */
  const searchPrimary = new URLSearchParams({ SALEDATE: saleDate });
  if (whsalcd) searchPrimary.set("WHSALCD", whsalcd);
  if (cmpcd) searchPrimary.set("CMPCD", cmpcd);
  if (filterByProduct && small) searchPrimary.set("SMALL", small);

  const urlPrimary = buildDataClclnUrl(apiKey, startIndex, endIndex, searchPrimary);

  try {
    let res = await fetch(urlPrimary, { method: "GET" });
    let text = await res.text();
    if (!res.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: res.status,
        message: `원천데이터 정산가격 API 호출 실패 (HTTP ${res.status})`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    if (text.trim().startsWith("<")) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: ApiErrorCategory.UNKNOWN,
        message: "원천데이터 정산가격 API가 XML로 응답했습니다. 현재는 JSON 호출만 허용합니다.",
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    let payload = parsePayload(text);
    if (payload.code !== "INFO-000" && payload.code !== "INFO-200") {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        errorCategory: mapErrorCategory(payload.code),
        message: `${payload.code} ${payload.message}`,
      });
      await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
      return response;
    }

    let usedWideUnfiltered = false;

    if (filterByProduct && small && cmpcd && payload.rows.length === 0) {
      const searchLoose = new URLSearchParams({ SALEDATE: saleDate });
      if (whsalcd) searchLoose.set("WHSALCD", whsalcd);
      searchLoose.set("SMALL", small);
      const urlLoose = buildDataClclnUrl(apiKey, startIndex, endIndex, searchLoose);
      const res2 = await fetch(urlLoose, { method: "GET" });
      const text2 = await res2.text();
      if (res2.ok && !text2.trim().startsWith("<")) {
        const payload2 = parsePayload(text2);
        if (payload2.code === "INFO-000" || payload2.code === "INFO-200") {
          payload = payload2;
        }
      }
    }

    if (filterByProduct && small && payload.rows.length === 0) {
      /** 「모든 품목」과 동일하게 CMPCD 포함 — CMPCD 없이 넓게 조회하면 0건이거나 집합이 달라질 수 있음 */
      const searchWide = new URLSearchParams({ SALEDATE: saleDate });
      if (whsalcd) searchWide.set("WHSALCD", whsalcd);
      if (cmpcd) searchWide.set("CMPCD", cmpcd);
      const wideEnd = Math.min(1000, Math.max(endIndex, 500));
      const urlWide = buildDataClclnUrl(apiKey, 1, wideEnd, searchWide);
      const res3 = await fetch(urlWide, { method: "GET" });
      const text3 = await res3.text();
      if (res3.ok && !text3.trim().startsWith("<")) {
        const payload3 = parsePayload(text3);
        if (payload3.code === "INFO-000" || payload3.code === "INFO-200") {
          payload = payload3;
          usedWideUnfiltered = true;
        }
      }
    }

    if (usedWideUnfiltered && filterByProduct && small && payload.totalCount > payload.rows.length) {
      const merged = await appendWidePages(apiKey, saleDate, whsalcd, cmpcd, payload);
      payload = { ...payload, rows: merged };
    }

    let outRows = payload.rows;
    let matchDiagnostics: MafraDataClclnPrcResponseData["matchDiagnostics"] | undefined;
    if (filterByProduct && small) {
      const strictRows = payload.rows.filter((row) =>
        rowMatchesProductCodes(row as unknown as Record<string, unknown>, large, mid, small),
      );
      const smallRows = payload.rows.filter((row) =>
        rowSmallMatches(row as unknown as Record<string, unknown>, small),
      );
      const codebookTokens = await deriveCodebookItemTokens(large, mid, small);
      const codebookRows = smallRows.filter((row) =>
        rowMatchesItemKeywords(row as unknown as Record<string, unknown>, codebookTokens),
      );
      const itemKeywordTokens = deriveKeywordTokens(params.request.itemName ?? "");
      const keywordRows = smallRows.filter((row) =>
        rowMatchesItemKeywords(row as unknown as Record<string, unknown>, itemKeywordTokens),
      );
      const l = large.trim();
      const m = mid.trim();
      let missingLarge = 0;
      let largeMismatch = 0;
      let missingMid = 0;
      let midMismatch = 0;
      for (const row of smallRows) {
        const rec = row as unknown as Record<string, unknown>;
        const rowL = String(rec.LARGE ?? "").trim();
        const rowM = String(rec.MID ?? "").trim();
        if (l) {
          if (!rowL) missingLarge += 1;
          else if (!segmentCodesEqualApi(rowL, l)) largeMismatch += 1;
        }
        if (m) {
          if (!rowM) missingMid += 1;
          else if (!segmentCodesEqualApi(rowM, m)) midMismatch += 1;
        }
      }
      outRows = strictRows;
      const shouldCodebookFallback = outRows.length === 0 && codebookRows.length > 0 && !looseSmallOnly;
      if (shouldCodebookFallback) {
        outRows = codebookRows;
        matchPolicy = `${matchPolicy} · 코드북 품목명 보정`;
      }
      const shouldKeywordFallback =
        outRows.length === 0 && keywordRows.length > 0 && itemKeywordTokens.length > 0 && !looseSmallOnly;
      if (shouldKeywordFallback) {
        outRows = keywordRows;
        matchPolicy = `${matchPolicy} · 품목명 키워드 보정`;
      }
      const shouldLooseSmallFallback = outRows.length === 0 && payload.rows.length > 0 && looseSmallOnly;
      if (shouldLooseSmallFallback) {
        outRows = smallRows;
        matchPolicy = `${matchPolicy} · 소분류 느슨 일치`;
      }
      matchDiagnostics = {
        sourceRows: payload.rows.length,
        smallMatched: smallRows.length,
        codebookMatched: codebookRows.length,
        keywordMatched: keywordRows.length,
        strictMatched: strictRows.length,
        missingLarge,
        largeMismatch,
        missingMid,
        midMismatch,
        codebookApplied: shouldCodebookFallback,
        keywordApplied: shouldKeywordFallback,
        looseApplied: shouldLooseSmallFallback,
      };
    }

    const response = buildSuccess<MafraDataClclnPrcResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message: `원천데이터 정산가격 조회 성공 (${outRows.length}건)`,
      data: {
        totalCount: filterByProduct && small ? outRows.length : payload.totalCount,
        startIndex,
        endIndex,
        rows: outRows,
        resolved: {
          whsalcd: whsalcd || null,
          cmpcd: cmpcd || null,
          large: large || null,
          mid: mid || null,
          small: small || null,
        },
        matchPolicy,
        matchDiagnostics,
      },
    });
    await saveApiLog({ ok: true, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  } catch (error) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.NETWORK_ERROR,
      message: error instanceof Error ? error.message : "원천데이터 정산가격 API 호출 중 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
}
