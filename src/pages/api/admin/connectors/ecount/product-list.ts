import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callEcountGetBasicProductsList } from "@/components/common/api/server/connectors/ecount";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { EcountProductListResponseData } from "@/components/common/api/server/connectors/ecount";

type RequestBody = {
  prodCode?: string;
  commaFlag?: "Y" | "N";
  prodType?: string;
  fromProdCd?: string;
  toProdCd?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<EcountProductListResponseData>>
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
  if (!session || session.user.role !== "ADMIN" || session.user.approvalStatus !== "APPROVED") {
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
  const requestId = crypto.randomUUID();
  const forceManualCheck = req.query.force === "1";

  const result = await callEcountGetBasicProductsList({
    requestId,
    timeoutMs: 10_000,
    appId: "admin-product-list",
    ignoreAutoStop: forceManualCheck,
    request: {
      prodCode: typeof body.prodCode === "string" ? body.prodCode : undefined,
      commaFlag: body.commaFlag === "Y" || body.commaFlag === "N" ? body.commaFlag : undefined,
      prodType: typeof body.prodType === "string" ? body.prodType : undefined,
      fromProdCd: typeof body.fromProdCd === "string" ? body.fromProdCd : undefined,
      toProdCd: typeof body.toProdCd === "string" ? body.toProdCd : undefined,
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
