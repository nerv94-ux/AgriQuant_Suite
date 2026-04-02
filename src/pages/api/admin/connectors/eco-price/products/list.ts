import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callEcoPriceProductList } from "@/components/common/api/server/connectors/eco-price";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { EcoPriceProductListResponseData } from "@/components/common/api/server/connectors/eco-price";

type RequestBody = {
  pageNo?: number;
  numOfRows?: number;
  fromDate?: string;
  toDate?: string;
  ctgryCd?: string;
  itemCd?: string;
  vrtyCd?: string;
  grdCd?: string;
  sggCd?: string;
  mrktCd?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<EcoPriceProductListResponseData>>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      data: null,
      message: "METHOD_NOT_ALLOWED",
      meta: {
        source: "ECO_PRICE",
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
        source: "ECO_PRICE",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "AUTH_ERROR",
      },
    });
  }

  const body = (req.body ?? {}) as RequestBody;
  const requestId = crypto.randomUUID();
  const result = await callEcoPriceProductList({
    requestId,
    timeoutMs: 10_000,
    appId: "admin-eco-price-product-list",
    request: {
      pageNo: typeof body.pageNo === "number" ? body.pageNo : undefined,
      numOfRows: typeof body.numOfRows === "number" ? body.numOfRows : undefined,
      fromDate: typeof body.fromDate === "string" ? body.fromDate : "",
      toDate: typeof body.toDate === "string" ? body.toDate : "",
      ctgryCd: typeof body.ctgryCd === "string" ? body.ctgryCd : undefined,
      itemCd: typeof body.itemCd === "string" ? body.itemCd : undefined,
      vrtyCd: typeof body.vrtyCd === "string" ? body.vrtyCd : undefined,
      grdCd: typeof body.grdCd === "string" ? body.grdCd : undefined,
      sggCd: typeof body.sggCd === "string" ? body.sggCd : undefined,
      mrktCd: typeof body.mrktCd === "string" ? body.mrktCd : undefined,
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
