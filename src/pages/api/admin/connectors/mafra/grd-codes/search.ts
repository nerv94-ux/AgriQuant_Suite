import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { searchMafraGrdCodes } from "@/components/common/api/server/connectors/mafra-grd-code";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { MafraGrdCodeSearchResponseData } from "@/components/common/api/server/connectors/mafra-grd-code";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraGrdCodeSearchResponseData>>
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

  const query = String(req.query.query ?? "");
  const forceSync = String(req.query.forceSync ?? "") === "1";
  const result = await searchMafraGrdCodes({
    requestId: crypto.randomUUID(),
    appId: "admin-mafra-grd-codes-search",
    query,
    forceSync,
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
