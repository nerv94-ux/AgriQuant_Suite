import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { getKmaRuntimeConfig } from "@/components/common/api/server/admin/providerSettings";
import { callKmaShortForecast } from "@/components/common/api/server/connectors/kma";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { KmaForecastResponseData } from "@/components/common/api/server/connectors/kma";

type RequestBody = {
  baseDate?: string;
  baseTime?: string;
  nx?: number;
  ny?: number;
  pageNo?: number;
  numOfRows?: number;
};

function todayYmd() {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<KmaForecastResponseData>>
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      data: null,
      message: "METHOD_NOT_ALLOWED",
      meta: {
        source: "KMA",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "VALIDATION_ERROR",
      },
    });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({
      ok: false,
      data: null,
      message: "FORBIDDEN",
      meta: {
        source: "KMA",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "AUTH_ERROR",
      },
    });
  }

  const runtime = await getKmaRuntimeConfig();
  const body = (req.body ?? {}) as RequestBody;

  const baseDateRaw = typeof req.query.baseDate === "string" ? req.query.baseDate : body.baseDate;
  const baseTimeRaw = typeof req.query.baseTime === "string" ? req.query.baseTime : body.baseTime;
  const nxRaw =
    typeof req.query.nx === "string" ? Number(req.query.nx) : typeof body.nx === "number" ? body.nx : undefined;
  const nyRaw =
    typeof req.query.ny === "string" ? Number(req.query.ny) : typeof body.ny === "number" ? body.ny : undefined;
  const pageNoRaw =
    typeof req.query.pageNo === "string"
      ? Number(req.query.pageNo)
      : typeof body.pageNo === "number"
        ? body.pageNo
        : undefined;
  const numOfRowsRaw =
    typeof req.query.numOfRows === "string"
      ? Number(req.query.numOfRows)
      : typeof body.numOfRows === "number"
        ? body.numOfRows
        : undefined;

  const baseDate = baseDateRaw?.trim() || todayYmd();
  const baseTime = baseTimeRaw?.trim() || runtime.baseTime;
  const nx = Number.isFinite(nxRaw) ? Math.round(nxRaw as number) : runtime.nx;
  const ny = Number.isFinite(nyRaw) ? Math.round(nyRaw as number) : runtime.ny;
  const pageNo = Number.isFinite(pageNoRaw) ? Math.round(pageNoRaw as number) : runtime.pageNo;
  const numOfRows = Number.isFinite(numOfRowsRaw)
    ? Math.round(numOfRowsRaw as number)
    : runtime.numOfRows;

  if (!/^\d{8}$/.test(baseDate) || !/^\d{4}$/.test(baseTime)) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "baseDate(YYYYMMDD), baseTime(HHmm) 형식을 확인해 주세요.",
      meta: {
        source: "KMA",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "VALIDATION_ERROR",
      },
    });
  }

  const requestId = crypto.randomUUID();
  const result = await callKmaShortForecast({
    requestId,
    timeoutMs: 10_000,
    appId: "weather-forecast",
    request: {
      baseDate,
      baseTime,
      nx,
      ny,
      pageNo,
      numOfRows,
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
