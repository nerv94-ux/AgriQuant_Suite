import { ApiErrorCategory } from "../../contracts/errors";
import type { ApiResponse } from "../../contracts/response";
import { getMafraApiKey } from "../../admin/mafraItemCodeStore";
import { buildError, buildSuccess } from "../../helpers/buildResponse";
import { saveApiLog } from "../../logging/saveApiLog";
import { mafraSmallCodesMatch } from "@/components/common/api/server/connectors/mafra/normalizeMafraSmallMatch";
import { resolveMafraCodebook } from "../mafra-codebook";
import type {
  MafraRealtimeAuctionItem,
  MafraRealtimeAuctionRequest,
  MafraRealtimeAuctionResponseData,
} from "./types";

const SOURCE = "GARAK" as const;
const BASE_HOST = "http://211.237.50.150:7080/openapi";
/** 명세: `도매시장 실시간 경락 정보.xls` — 파라미터·길이 요약은 `docs/mafra-openapi-notes.md` */
const API_URL = "Grid_20240625000000000654_1";

function parsePayload(rawText: string): {
  code: string;
  message: string;
  totalCount: number;
  rows: MafraRealtimeAuctionItem[];
} {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const rootKey = Object.keys(parsed)[0];
  const root = (rootKey ? parsed[rootKey] : parsed) as Record<string, unknown>;
  const result = (root.result ?? {}) as Record<string, unknown>;
  const raw = root.row ?? root.Row ?? root.rows ?? root.data ?? root.list;
  const rowsRaw = !raw ? [] : Array.isArray(raw) ? raw : [raw];
  const str = (row: Record<string, unknown>, ...keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };
  const rows = rowsRaw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      SALEDATE: str(row, "SALEDATE", "saledate"),
      WHSALCD: str(row, "WHSALCD", "whsalcd"),
      WHSALNAME: str(row, "WHSALNAME", "whsalname"),
      CMPCD: str(row, "CMPCD", "cmpcd"),
      CMPNAME: str(row, "CMPNAME", "cmpname"),
      LARGE: str(row, "LARGE", "large"),
      LARGENAME: str(row, "LARGENAME", "largename"),
      MID: str(row, "MID", "mid"),
      MIDNAME: str(row, "MIDNAME", "midname"),
      SMALL: str(row, "SMALL", "small"),
      SMALLNAME: str(row, "SMALLNAME", "smallname"),
      SANCD: str(row, "SANCD", "sancd"),
      SANNAME: str(row, "SANNAME", "sanname"),
      COST: str(row, "COST", "cost"),
      QTY: str(row, "QTY", "qty"),
      STD: str(row, "STD", "std"),
      SBIDTIME: str(row, "SBIDTIME", "sbidtime"),
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

export async function fetchMafraRealtimeAuctionInfo(params: {
  requestId: string;
  appId?: string;
  request: MafraRealtimeAuctionRequest;
}): Promise<ApiResponse<MafraRealtimeAuctionResponseData>> {
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

  let whsalcd = params.request.whsalcd?.trim() ?? "";
  let cmpcd = params.request.cmpcd?.trim() ?? "";
  let small = params.request.small?.trim() ?? "";

  if (params.request.autoResolveCodes !== false && (!whsalcd || !cmpcd || !small)) {
    const resolved = await resolveMafraCodebook({
      requestId: `${params.requestId}-resolve`,
      appId: params.appId,
      request: {
        marketName: params.request.whsalName,
        corpName: params.request.cmpName,
        itemName: params.request.itemName,
        preferGarakItemCode: params.request.preferGarakItemCode,
        deskItemMatch: params.request.deskItemMatch,
      },
    });
    whsalcd ||= resolved.market.code ?? "";
    cmpcd ||= resolved.corp.code ?? "";
    small ||= resolved.item.code ?? "";
  }

  if (!whsalcd) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "whsalcd가 필요합니다. 직접 입력하거나 whsalName으로 자동해석해 주세요.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
  if (params.request.itemName?.trim() && !small) {
    const response = buildError({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      message: "itemName을 SMALL 코드로 해석하지 못했습니다. itemName을 바꾸거나 small 코드를 직접 입력해 주세요.",
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

  function buildSearchParams(includeLargeMid: boolean): URLSearchParams {
    const search = new URLSearchParams({
      SALEDATE: saleDate,
      WHSALCD: whsalcd,
    });
    if (cmpcd) search.set("CMPCD", cmpcd);
    if (includeLargeMid) {
      if (params.request.large?.trim()) search.set("LARGE", params.request.large.trim());
      if (params.request.mid?.trim()) search.set("MID", params.request.mid.trim());
    }
    if (small) search.set("SMALL", small);
    return search;
  }

  const hadLargeMid = Boolean(params.request.large?.trim() || params.request.mid?.trim());

  try {
    const runOnce = async (includeLargeMid: boolean) => {
      const qs = buildSearchParams(includeLargeMid).toString();
      const requestUrl = `${BASE_HOST}/${encodeURIComponent(apiKey)}/json/${API_URL}/${startIndex}/${endIndex}?${qs}`;
      const res = await fetch(requestUrl, { method: "GET" });
      const text = await res.text();
      return { res, text };
    };

    let { res, text } = await runOnce(true);
    if (!res.ok) {
      const response = buildError({
        source: SOURCE,
        requestId: params.requestId,
        startedAt,
        httpStatus: res.status,
        message: `실시간 경락 정보 API 호출 실패 (HTTP ${res.status})`,
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
        message: "실시간 경락 정보 API가 XML로 응답했습니다. 현재는 JSON 호출만 허용합니다.",
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

    let usedRelaxedLargeMid = false;
    if (payload.rows.length === 0 && hadLargeMid) {
      const second = await runOnce(false);
      if (!second.res.ok) {
        const response = buildError({
          source: SOURCE,
          requestId: params.requestId,
          startedAt,
          httpStatus: second.res.status,
          message: `실시간 경락 정보 API 재조회 실패 (HTTP ${second.res.status})`,
        });
        await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
        return response;
      }
      if (second.text.trim().startsWith("<")) {
        const response = buildError({
          source: SOURCE,
          requestId: params.requestId,
          startedAt,
          errorCategory: ApiErrorCategory.UNKNOWN,
          message: "실시간 경락 정보 API 재조회가 XML로 응답했습니다.",
        });
        await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
        return response;
      }
      const payload2 = parsePayload(second.text);
      if (payload2.code !== "INFO-000" && payload2.code !== "INFO-200") {
        const response = buildError({
          source: SOURCE,
          requestId: params.requestId,
          startedAt,
          errorCategory: mapErrorCategory(payload2.code),
          message: `${payload2.code} ${payload2.message}`,
        });
        await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
        return response;
      }
      payload = payload2;
      usedRelaxedLargeMid = true;
    }

    const strict = params.request.deskStrictItem;
    const strictSmall = strict?.small?.trim();
    let rowsOut = payload.rows;
    let deskSmallFilteredCount = 0;
    if (strictSmall) {
      const before = rowsOut.length;
      const L = strict?.large?.trim();
      const M = strict?.mid?.trim();
      rowsOut = rowsOut.filter((r) => {
        if (!mafraSmallCodesMatch(strictSmall, r.SMALL)) return false;
        if (L && String(r.LARGE ?? "").trim() !== L) return false;
        if (M && String(r.MID ?? "").trim() !== M) return false;
        return true;
      });
      deskSmallFilteredCount = before - rowsOut.length;
    }

    let message: string;
    if (rowsOut.length > 0) {
      message = `실시간 경락 정보 조회 성공 (${rowsOut.length}건)`;
      if (usedRelaxedLargeMid) {
        message +=
          ". 저장된 대·중 품목코드까지 맞추면 0건이어서, 소(SMALL)만 적용해 다시 조회했습니다. 목록의 품목이 기대와 다르면 상단 실무 코드의 대·중·소를 다시 맞춰 보세요.";
      }
      if (deskSmallFilteredCount > 0) {
        const lms = [strict?.large?.trim(), strict?.mid?.trim(), strictSmall].filter(Boolean).join(" / ");
        message += ` 데스크 기준 품목(${lms})과 불일치 응답 ${deskSmallFilteredCount}건 제거.`;
      }
    } else {
      message = "실시간 경락 정보 조회 성공 (0건).";
      if (usedRelaxedLargeMid) {
        message +=
          " 대·중 코드를 빼고 소(SMALL)만으로도 0건입니다. 기준일(휴일·미거래), 법인, 품목(SMALL), 또는 다른 시장·법인 조합을 확인해 보세요.";
      } else {
        message +=
          " 해당 일자·시장·법인·품목 조건에 맞는 경락이 없을 수 있습니다. 기준일을 바꾸거나, 저장된 대·중·소가 경락 분류와 다르면 0건이 될 수 있습니다.";
      }
      if (strictSmall && deskSmallFilteredCount > 0) {
        message += ` (원본 ${payload.rows.length}건 중 저장 품목과 일치하는 행 없음)`;
      }
    }

    const response = buildSuccess<MafraRealtimeAuctionResponseData>({
      source: SOURCE,
      requestId: params.requestId,
      startedAt,
      message,
      data: {
        totalCount: strictSmall ? rowsOut.length : payload.totalCount,
        startIndex,
        endIndex,
        rows: rowsOut,
        resolved: {
          whsalcd: whsalcd || null,
          cmpcd: cmpcd || null,
          small: small || null,
        },
        usedRelaxedLargeMid: usedRelaxedLargeMid || undefined,
        deskSmallFilteredCount: deskSmallFilteredCount > 0 ? deskSmallFilteredCount : undefined,
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
      message: error instanceof Error ? error.message : "실시간 경락 정보 API 호출 중 오류가 발생했습니다.",
    });
    await saveApiLog({ ok: false, meta: response.meta, appId: params.appId, message: response.message });
    return response;
  }
}
