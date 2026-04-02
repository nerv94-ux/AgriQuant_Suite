import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callEcountViewInventoryBalanceStatusByLocation } from "@/components/common/api/server/connectors/ecount";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { EcountInventoryBalanceByLocationResponseData } from "@/components/common/api/server/connectors/ecount";

type RequestBody = {
  baseDate?: string;
  prodCode?: string;
  whCd?: string;
  balFlag?: "Y" | "N";
  delGubun?: "Y" | "N";
  delLocationYn?: "Y" | "N";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<EcountInventoryBalanceByLocationResponseData>>
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
  const baseDate = typeof body.baseDate === "string" ? body.baseDate.trim() : "";
  const prodCode = typeof body.prodCode === "string" ? body.prodCode.trim() : "";
  if (!baseDate || !prodCode) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "BASE_DATE와 PROD_CD는 필수입니다.",
      meta: {
        source: "ECOUNT",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "VALIDATION_ERROR",
      },
    });
  }

  const requestId = crypto.randomUUID();
  const forceManualCheck = req.query.force === "1";
  const result = await callEcountViewInventoryBalanceStatusByLocation({
    requestId,
    timeoutMs: 10_000,
    appId: "admin-inventory-balance-by-location",
    ignoreAutoStop: forceManualCheck,
    request: {
      baseDate,
      prodCode,
      whCd: typeof body.whCd === "string" ? body.whCd : undefined,
      balFlag: body.balFlag,
      delGubun: body.delGubun,
      delLocationYn: body.delLocationYn,
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
