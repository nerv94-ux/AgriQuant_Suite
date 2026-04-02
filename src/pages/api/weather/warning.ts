import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callKmaWeatherWarning } from "@/components/common/api/server/connectors/kma";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { KmaWarningResponseData } from "@/components/common/api/server/connectors/kma";

type RequestBody = {
  stnId?: string;
  fromTm?: string;
  toTm?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<KmaWarningResponseData>>
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

  const body = (req.body ?? {}) as RequestBody;
  const stnIdRaw = typeof req.query.stnId === "string" ? req.query.stnId : body.stnId;
  const fromTmRaw = typeof req.query.fromTm === "string" ? req.query.fromTm : body.fromTm;
  const toTmRaw = typeof req.query.toTm === "string" ? req.query.toTm : body.toTm;

  const stnId = stnIdRaw?.trim() || undefined;
  const fromTm = fromTmRaw?.trim() || undefined;
  const toTm = toTmRaw?.trim() || undefined;

  const requestId = crypto.randomUUID();
  const result = await callKmaWeatherWarning({
    requestId,
    timeoutMs: 10_000,
    appId: "weather-warning",
    request: {
      stnId,
      fromTm,
      toTm,
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
