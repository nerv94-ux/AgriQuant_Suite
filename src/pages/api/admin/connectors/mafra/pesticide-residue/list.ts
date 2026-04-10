import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { fetchMafraPesticideResidue } from "@/components/common/api/server/connectors/mafra-pesticide-residue";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { MafraPesticideResidueResponseData } from "@/components/common/api/server/connectors/mafra-pesticide-residue";

function parseNumberOrUndefined(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraPesticideResidueResponseData>>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      data: null,
      message: "METHOD_NOT_ALLOWED",
      meta: {
        source: "GARAK",
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
        source: "GARAK",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "AUTH_ERROR",
      },
    });
  }

  const result = await fetchMafraPesticideResidue({
    requestId: crypto.randomUUID(),
    appId: "admin-mafra-pesticide-residue-list",
    request: {
      SPLORE_NO: String(req.query.SPLORE_NO ?? req.query.sploreNo ?? ""),
      REGIST_DE: String(req.query.REGIST_DE ?? req.query.registDe ?? ""),
      startIndex: parseNumberOrUndefined(req.query.startIndex),
      endIndex: parseNumberOrUndefined(req.query.endIndex),
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
