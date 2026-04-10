import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { searchMafraFrmlCodes } from "@/components/common/api/server/connectors/mafra-frml-code";
import { searchMafraGrdCodes } from "@/components/common/api/server/connectors/mafra-grd-code";
import { searchMafraItemCodes } from "@/components/common/api/server/connectors/mafra-item-code";
import { searchMafraUnitCodes } from "@/components/common/api/server/connectors/mafra-unit-code";

const KINDS = ["item", "unit", "grd", "frml"] as const;
type Kind = (typeof KINDS)[number];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<unknown> | { ok: false; message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const kindRaw = String(req.query.kind ?? "");
  if (!KINDS.includes(kindRaw as Kind)) {
    return res.status(400).json({ ok: false, message: "kind은 item, unit, grd, frml 중 하나여야 합니다." });
  }
  const kind = kindRaw as Kind;
  const query = String(req.query.query ?? "");
  const forceSync = String(req.query.forceSync ?? "") === "1";
  const requestId = crypto.randomUUID();
  const appId = "desk-mafra-search";

  let result: ApiResponse<unknown>;
  switch (kind) {
    case "item":
      result = await searchMafraItemCodes({ requestId, appId, query, forceSync });
      break;
    case "unit":
      result = await searchMafraUnitCodes({ requestId, appId, query, forceSync });
      break;
    case "grd":
      result = await searchMafraGrdCodes({ requestId, appId, query, forceSync });
      break;
    case "frml":
      result = await searchMafraFrmlCodes({ requestId, appId, query, forceSync });
      break;
    default:
      return res.status(400).json({ ok: false, message: "INVALID_KIND" });
  }

  return res.status(result.ok ? 200 : 502).json(result);
}
