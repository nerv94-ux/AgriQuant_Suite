import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callNaverSearch } from "@/components/common/api/server/connectors/naver";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { NaverSearchResponseData } from "@/components/common/api/server/connectors/naver";

type RequestBody = {
  query?: string;
  display?: number;
  start?: number;
  sort?: "sim" | "date";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<NaverSearchResponseData>>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      data: null,
      message: "METHOD_NOT_ALLOWED",
      meta: {
        source: "NAVER",
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
        source: "NAVER",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "AUTH_ERROR",
      },
    });
  }

  const body = (req.body ?? {}) as RequestBody;
  const result = await callNaverSearch({
    requestId: crypto.randomUUID(),
    timeoutMs: 10_000,
    appId: "admin-naver-search",
    query: typeof body.query === "string" ? body.query : "",
    display: typeof body.display === "number" ? body.display : undefined,
    start: typeof body.start === "number" ? body.start : undefined,
    sort: body.sort === "date" ? "date" : "sim",
  });
  return res.status(result.ok ? 200 : 502).json(result);
}
