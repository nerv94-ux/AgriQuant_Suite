import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callEcountGetPurchasesOrderList } from "@/components/common/api/server/connectors/ecount";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { EcountPurchasesOrderListResponseData } from "@/components/common/api/server/connectors/ecount";

type RequestBody = {
  prodCode?: string;
  custCode?: string;
  pageCurrent?: number;
  pageSize?: number;
  baseDateFrom?: string;
  baseDateTo?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<EcountPurchasesOrderListResponseData>>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      data: null,
      message: "METHOD_NOT_ALLOWED",
      meta: {
        source: "ECOUNT",
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
        source: "ECOUNT",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "AUTH_ERROR",
      },
    });
  }
  const body = (req.body ?? {}) as RequestBody;
  const baseDateFrom = typeof body.baseDateFrom === "string" ? body.baseDateFrom.trim() : "";
  const baseDateTo = typeof body.baseDateTo === "string" ? body.baseDateTo.trim() : "";
  if (!baseDateFrom || !baseDateTo) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "baseDateFrom과 baseDateTo는 필수입니다.",
      meta: {
        source: "ECOUNT",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "VALIDATION_ERROR",
      },
    });
  }
  const result = await callEcountGetPurchasesOrderList({
    requestId: crypto.randomUUID(),
    timeoutMs: 15_000,
    appId: "main-erp-purchases-orders-list",
    request: {
      prodCode: typeof body.prodCode === "string" ? body.prodCode : undefined,
      custCode: typeof body.custCode === "string" ? body.custCode : undefined,
      pageCurrent: typeof body.pageCurrent === "number" ? body.pageCurrent : undefined,
      pageSize: typeof body.pageSize === "number" ? body.pageSize : undefined,
      baseDateFrom,
      baseDateTo,
    },
  });
  return res.status(result.ok ? 200 : 502).json(result);
}
