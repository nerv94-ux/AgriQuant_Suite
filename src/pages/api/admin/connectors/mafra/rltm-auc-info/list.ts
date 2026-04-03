import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { fetchMafraRealtimeAuctionInfo } from "@/components/common/api/server/connectors/mafra-rltm-auc-info";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { MafraRealtimeAuctionResponseData } from "@/components/common/api/server/connectors/mafra-rltm-auc-info";

function parseNumberOrUndefined(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraRealtimeAuctionResponseData>>
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

  const result = await fetchMafraRealtimeAuctionInfo({
    requestId: crypto.randomUUID(),
    appId: "admin-mafra-rltm-auc-info-list",
    request: {
      saleDate: String(req.query.saleDate ?? ""),
      whsalcd: String(req.query.whsalcd ?? ""),
      cmpcd: String(req.query.cmpcd ?? ""),
      large: String(req.query.large ?? ""),
      mid: String(req.query.mid ?? ""),
      small: String(req.query.small ?? ""),
      whsalName: String(req.query.whsalName ?? ""),
      cmpName: String(req.query.cmpName ?? ""),
      itemName: String(req.query.itemName ?? ""),
      startIndex: parseNumberOrUndefined(req.query.startIndex),
      endIndex: parseNumberOrUndefined(req.query.endIndex),
      autoResolveCodes: String(req.query.autoResolveCodes ?? "1") !== "0",
      preferGarakItemCode: String(req.query.preferGarakItemCode ?? "") === "1",
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
