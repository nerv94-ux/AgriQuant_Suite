import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callEcoCertList } from "@/components/common/api/server/connectors/eco-cert";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { EcoCertListResponseData } from "@/components/common/api/server/connectors/eco-cert";

type RequestBody = {
  pageNo?: number;
  numOfRows?: number;
  type?: "JSON" | "XML";
  chcCol?: string;
  certNo?: string;
  certSeCd?: string;
  certVldEndYmdS?: string;
  certVldEndYmdE?: string;
  prdcrGrpNm?: string;
  rprsvNm?: string;
  plorNm?: string;
  certItemNm?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<EcoCertListResponseData>>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      data: null,
      message: "METHOD_NOT_ALLOWED",
      meta: {
        source: "ECO_CERT",
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
        source: "ECO_CERT",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "AUTH_ERROR",
      },
    });
  }

  const body = (req.body ?? {}) as RequestBody;
  const result = await callEcoCertList({
    requestId: crypto.randomUUID(),
    timeoutMs: 10_000,
    appId: "admin-eco-cert-list",
    request: {
      pageNo: typeof body.pageNo === "number" ? body.pageNo : undefined,
      numOfRows: typeof body.numOfRows === "number" ? body.numOfRows : undefined,
      type: body.type === "XML" ? "XML" : "JSON",
      chcCol: typeof body.chcCol === "string" ? body.chcCol : undefined,
      certNo: typeof body.certNo === "string" ? body.certNo : undefined,
      certSeCd: typeof body.certSeCd === "string" ? body.certSeCd : undefined,
      certVldEndYmdS: typeof body.certVldEndYmdS === "string" ? body.certVldEndYmdS : undefined,
      certVldEndYmdE: typeof body.certVldEndYmdE === "string" ? body.certVldEndYmdE : undefined,
      prdcrGrpNm: typeof body.prdcrGrpNm === "string" ? body.prdcrGrpNm : undefined,
      rprsvNm: typeof body.rprsvNm === "string" ? body.rprsvNm : undefined,
      plorNm: typeof body.plorNm === "string" ? body.plorNm : undefined,
      certItemNm: typeof body.certItemNm === "string" ? body.certItemNm : undefined,
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
