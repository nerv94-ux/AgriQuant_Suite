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
  res: NextApiResponse<ApiResponse<MafraDataClclnPrcResponseData> | { ok: false; message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const result = await fetchMafraDataClclnPrc({
    requestId: crypto.randomUUID(),
    appId: "desk-mafra-data-clcln-prc",
    request: {
      saleDate: String(req.query.saleDate ?? ""),
      whsalcd: String(req.query.whsalcd ?? ""),
      cmpcd: String(req.query.cmpcd ?? ""),
      whsalName: String(req.query.whsalName ?? ""),
      cmpName: String(req.query.cmpName ?? ""),
      large: String(req.query.large ?? ""),
      mid: String(req.query.mid ?? ""),
      small: String(req.query.small ?? ""),
      itemName: String(req.query.itemName ?? ""),
      preferGarakItemCode: String(req.query.preferGarakItemCode ?? "") === "1",
      deskItemMatch: String(req.query.deskItemMatch ?? "1") !== "0",
      filterByProductCodes: String(req.query.filterByProductCodes ?? "1") !== "0",
      preferSavedItemCodes: String(req.query.preferSavedItemCodes ?? "") === "1",
      looseSmallMatch: String(req.query.looseSmallMatch ?? "") === "1",
      startIndex: parseNumberOrUndefined(req.query.startIndex),
      endIndex: parseNumberOrUndefined(req.query.endIndex),
      autoResolveCodes: String(req.query.autoResolveCodes ?? "1") !== "0",
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
