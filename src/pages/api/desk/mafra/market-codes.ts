import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import {
  listMafraMarketCodes,
  type MafraMarketCodeListResponseData,
} from "@/components/common/api/server/connectors/mafra-market-code";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraMarketCodeListResponseData> | { ok: false; message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const forceSync = String(req.query.forceSync ?? "") === "1";
  const result = await listMafraMarketCodes({
    requestId: crypto.randomUUID(),
    appId: "desk-mafra-market-codes",
    forceSync,
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
