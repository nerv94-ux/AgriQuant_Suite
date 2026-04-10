import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { fetchMafraAgricnsmTrnd } from "@/components/common/api/server/connectors/mafra-agricnsm-trnd";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { MafraAgricnsmTrndResponseData } from "@/components/common/api/server/connectors/mafra-agricnsm-trnd";

function parseNumberOrUndefined(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraAgricnsmTrndResponseData>>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      data: null,
      message: "METHOD_NOT_ALLOWED",
      meta: {
        source: "GARAK",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "VALIDATION_ERROR",
      },
    });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "ADMIN" || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({
      ok: false,
      data: null,
      message: "FORBIDDEN",
      meta: {
        source: "GARAK",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "AUTH_ERROR",
      },
    });
  }

  const result = await fetchMafraAgricnsmTrnd({
    requestId: crypto.randomUUID(),
    appId: "admin-mafra-agricnsm-trnd-list",
    request: {
      CRTR_YEAR: String(req.query.CRTR_YEAR ?? req.query.crtrYear ?? ""),
      CRTR_MONTH: String(req.query.CRTR_MONTH ?? req.query.crtrMonth ?? ""),
      startIndex: parseNumberOrUndefined(req.query.startIndex),
      endIndex: parseNumberOrUndefined(req.query.endIndex),
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
