import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { syncMafraItemCodes } from "@/components/common/api/server/connectors/mafra-item-code";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { MafraItemCodeSyncResponseData } from "@/components/common/api/server/connectors/mafra-item-code";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraItemCodeSyncResponseData>>
) {
  if (req.method !== "POST") {
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

  const result = await syncMafraItemCodes({
    requestId: crypto.randomUUID(),
    appId: "admin-mafra-item-codes-sync",
    updatedByEmail: session.user.email ?? null,
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
