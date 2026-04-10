/**
 * 관리자 커넥터 「전국 도매시장 경매」자동 연결 확인.
 * `fetchMafraClclnPrcWhlslMrkt`(Grid_20240625000000000656_1) 샘플만 호출합니다.
 * 단위·품목 등 다른 그리드 권한과는 별개일 수 있습니다.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { fetchMafraClclnPrcWhlslMrkt } from "@/components/common/api/server/connectors/mafra-clcln-prc-whlsl-mrkt";
import type { ApiResponse } from "@/components/common/api/server/contracts";

type MafraHealthData = {
  totalCount: number;
};

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<MafraHealthData>>
) {
  if (req.method !== "POST") {
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

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const result = await fetchMafraClclnPrcWhlslMrkt({
    requestId: crypto.randomUUID(),
    appId: "admin-health-check",
    request: {
      registDt: toYmd(yesterday),
      startIndex: 1,
      endIndex: 5,
      autoResolveCodes: false,
    },
  });

  if (!result.ok) {
    return res.status(502).json(result as ApiResponse<MafraHealthData>);
  }

  return res.status(200).json({
    ...result,
    data: {
      totalCount: result.data.totalCount,
    },
  });
}
