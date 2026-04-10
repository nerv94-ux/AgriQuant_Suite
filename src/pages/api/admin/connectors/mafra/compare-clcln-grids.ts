import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { fetchMafraClclnPrcInfo } from "@/components/common/api/server/connectors/mafra-clcln-prc-info";
import { fetchMafraDataClclnPrc } from "@/components/common/api/server/connectors/mafra-data-clcln-prc";

function parseNumberOrUndefined(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * 정산 가격 정보(Grid_653) vs 원천(Grid_655) 동일 조건으로 건수·해석 비교(관리자·명세 검증용)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "ADMIN" || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const saleDate = String(req.query.saleDate ?? "");
  const requestId = crypto.randomUUID();

  const [info, raw] = await Promise.all([
    fetchMafraClclnPrcInfo({
      requestId: `${requestId}-653`,
      appId: "admin-compare-clcln-653",
      request: {
        saleDate,
        whsalcd: String(req.query.whsalcd ?? ""),
        cmpcd: String(req.query.cmpcd ?? ""),
        large: String(req.query.large ?? ""),
        mid: String(req.query.mid ?? ""),
        small: String(req.query.small ?? ""),
        whsalName: String(req.query.whsalName ?? ""),
        cmpName: String(req.query.cmpName ?? ""),
        itemName: String(req.query.itemName ?? ""),
        preferGarakItemCode: String(req.query.preferGarakItemCode ?? "") === "1",
        startIndex: parseNumberOrUndefined(req.query.startIndex),
        endIndex: parseNumberOrUndefined(req.query.endIndex),
        autoResolveCodes: String(req.query.autoResolveCodes ?? "1") !== "0",
      },
    }),
    fetchMafraDataClclnPrc({
      requestId: `${requestId}-655`,
      appId: "admin-compare-clcln-655",
      request: {
        saleDate,
        whsalcd: String(req.query.whsalcd ?? ""),
        cmpcd: String(req.query.cmpcd ?? ""),
        large: String(req.query.large ?? ""),
        mid: String(req.query.mid ?? ""),
        small: String(req.query.small ?? ""),
        whsalName: String(req.query.whsalName ?? ""),
        cmpName: String(req.query.cmpName ?? ""),
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
    }),
  ]);

  return res.status(200).json({
    ok: true,
    grids: { clclnPrcInfo: "Grid_20240625000000000653_1", dataClclnPrc: "Grid_20240625000000000655_1" },
    params: {
      saleDate,
      whsalName: String(req.query.whsalName ?? ""),
      cmpName: String(req.query.cmpName ?? ""),
      itemName: String(req.query.itemName ?? ""),
    },
    info653: {
      ok: info.ok,
      message: info.message,
      rowCount: info.ok && info.data ? info.data.rows.length : 0,
      resolved: info.ok && info.data ? info.data.resolved : null,
    },
    raw655: {
      ok: raw.ok,
      message: raw.message,
      rowCount: raw.ok && raw.data ? raw.data.rows.length : 0,
      resolved: raw.ok && raw.data ? raw.data.resolved : null,
      matchPolicy: raw.ok && raw.data ? raw.data.matchPolicy : undefined,
    },
  });
}
