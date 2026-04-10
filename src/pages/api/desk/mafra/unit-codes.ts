import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import {
  listMafraUnitCodes,
  type MafraUnitCodeListResponseData,
} from "@/components/common/api/server/connectors/mafra-unit-code";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraUnitCodeListResponseData> | { ok: false; message: string }>,
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
  const result = await listMafraUnitCodes({
    requestId: crypto.randomUUID(),
    appId: "desk-mafra-unit-codes",
    forceSync,
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
