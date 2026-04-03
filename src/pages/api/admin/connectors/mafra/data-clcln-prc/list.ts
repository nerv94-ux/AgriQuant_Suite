import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { fetchMafraDataClclnPrc } from "@/components/common/api/server/connectors/mafra-data-clcln-prc";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { MafraDataClclnPrcResponseData } from "@/components/common/api/server/connectors/mafra-data-clcln-prc";

function parseNumberOrUndefined(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraDataClclnPrcResponseData>>
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

  const result = await fetchMafraDataClclnPrc({
    requestId: crypto.randomUUID(),
    appId: "admin-mafra-data-clcln-prc-list",
    request: {
      saleDate: String(req.query.saleDate ?? ""),
      whsalcd: String(req.query.whsalcd ?? ""),
      cmpcd: String(req.query.cmpcd ?? ""),
      whsalName: String(req.query.whsalName ?? ""),
      cmpName: String(req.query.cmpName ?? ""),
      startIndex: parseNumberOrUndefined(req.query.startIndex),
      endIndex: parseNumberOrUndefined(req.query.endIndex),
      autoResolveCodes: String(req.query.autoResolveCodes ?? "1") !== "0",
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
