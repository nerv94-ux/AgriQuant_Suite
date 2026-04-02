import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callEcountViewBasicProduct } from "@/components/common/api/server/connectors/ecount";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { EcountProductSingleResponseData } from "@/components/common/api/server/connectors/ecount";

type RequestBody = {
  prodCode?: string;
  prodType?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<EcountProductSingleResponseData>>
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
  const prodCode = typeof body.prodCode === "string" ? body.prodCode.trim() : "";
  if (!prodCode) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "prodCode는 필수입니다.",
      meta: {
        source: "ECOUNT",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "VALIDATION_ERROR",
      },
    });
  }

  const result = await callEcountViewBasicProduct({
    requestId: crypto.randomUUID(),
    timeoutMs: 15_000,
    appId: "main-erp-products-get",
    request: {
      prodCode,
      prodType: typeof body.prodType === "string" ? body.prodType : undefined,
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
