import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { resolveMafraCodebook, type MafraCodebookResolveResponse } from "@/components/common/api/server/connectors/mafra-codebook";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraCodebookResolveResponse>>
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

  const body = (req.body ?? {}) as {
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

  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const data = await resolveMafraCodebook({
    requestId,
    appId: "admin-mafra-codebook-resolve",
    request: body,
  });
  const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

  return res.status(200).json({
    ok: true,
    data,
    message: "코드사전 해석 성공",
    meta: {
      source: "GARAK",
      requestId,
      timestamp: new Date().toISOString(),
      durationMs,
    },
  });
}
