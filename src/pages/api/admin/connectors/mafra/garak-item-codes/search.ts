import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { searchMafraGarakItemCodes } from "@/components/common/api/server/connectors/mafra-garak-item-code";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { MafraGarakItemCodeSearchResponseData } from "@/components/common/api/server/connectors/mafra-garak-item-code";

function parseNumberOrUndefined(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraGarakItemCodeSearchResponseData>>
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

  const result = await searchMafraGarakItemCodes({
    requestId: crypto.randomUUID(),
    appId: "admin-mafra-garak-item-codes-search",
    request: {
      garrakName: String(req.query.garrakName ?? ""),
      stanCode: String(req.query.stanCode ?? ""),
      sclassCode: String(req.query.sclassCode ?? ""),
      garrakCode: String(req.query.garrakCode ?? ""),
      startIndex: parseNumberOrUndefined(req.query.startIndex),
      endIndex: parseNumberOrUndefined(req.query.endIndex),
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
