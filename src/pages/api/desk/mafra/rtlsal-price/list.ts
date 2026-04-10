import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { fetchMafraRetailSalPrice } from "@/components/common/api/server/connectors/mafra-rtlsal-price";
import type { MafraRetailSalPriceResponseData } from "@/components/common/api/server/connectors/mafra-rtlsal-price";

function parseNumberOrUndefined(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraRetailSalPriceResponseData> | { ok: false; message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const result = await fetchMafraRetailSalPrice({
    requestId: crypto.randomUUID(),
    appId: "desk-mafra-rtlsal-price-list",
    request: {
      examinDe: String(req.query.examinDe ?? ""),
      FRMPRD_CATGORY_CD: String(req.query.FRMPRD_CATGORY_CD ?? req.query.frmprdCatgoryCd ?? ""),
      PRDLST_CD: String(req.query.PRDLST_CD ?? req.query.prdlstCd ?? ""),
      SPCIES_CD: String(req.query.SPCIES_CD ?? req.query.speciesCd ?? ""),
      GRAD_CD: String(req.query.GRAD_CD ?? req.query.gradCd ?? ""),
      AREA_CD: String(req.query.AREA_CD ?? req.query.areaCd ?? ""),
      MRKT_CD: String(req.query.MRKT_CD ?? req.query.mrktCd ?? ""),
      startIndex: parseNumberOrUndefined(req.query.startIndex),
      endIndex: parseNumberOrUndefined(req.query.endIndex),
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}

