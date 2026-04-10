import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { fetchMafraClclnPrcWhlslMrkt } from "@/components/common/api/server/connectors/mafra-clcln-prc-whlsl-mrkt";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { MafraClclnPrcWhlslMrktResponseData } from "@/components/common/api/server/connectors/mafra-clcln-prc-whlsl-mrkt";

function parseNumberOrUndefined(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraClclnPrcWhlslMrktResponseData> | { ok: false; message: string }>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json({ ok: false, message: "FORBIDDEN" });
  }

  const result = await fetchMafraClclnPrcWhlslMrkt({
    requestId: crypto.randomUUID(),
    appId: "desk-mafra-clcln-prc-whlsl-mrkt",
    request: {
      registDt: String(req.query.registDt ?? ""),
      whsalcd: String(req.query.whsalcd ?? ""),
      whsalName: String(req.query.whsalName ?? ""),
      startIndex: parseNumberOrUndefined(req.query.startIndex),
      endIndex: parseNumberOrUndefined(req.query.endIndex),
      autoResolveCodes: String(req.query.autoResolveCodes ?? "1") !== "0",
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
