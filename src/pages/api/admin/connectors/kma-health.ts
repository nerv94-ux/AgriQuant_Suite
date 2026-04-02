import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callKmaHealthCheck } from "@/components/common/api/server/connectors/kma";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { KmaHealthResponseData } from "@/components/common/api/server/connectors/kma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<KmaHealthResponseData>>
) {
  if (req.method !== "POST") {
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
  if (!session || session.user.role !== "ADMIN" || session.user.approvalStatus !== "APPROVED") {
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

  const result = await callKmaHealthCheck({
    requestId: crypto.randomUUID(),
    timeoutMs: 10_000,
    appId: "admin-health-check",
  });
  return res.status(result.ok ? 200 : 502).json(result);
}
