import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callNaverDatalabShoppingInsight } from "@/components/common/api/server/connectors/naver";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { NaverDatalabShoppingInsightResponseData } from "@/components/common/api/server/connectors/naver";

type RequestBody = {
  startDate?: string;
  endDate?: string;
  timeUnit?: "date" | "week" | "month";
  category?: Array<{
    name?: string;
    param?: string[];
  }>;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<NaverDatalabShoppingInsightResponseData>>
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
  const result = await callNaverDatalabShoppingInsight({
    requestId: crypto.randomUUID(),
    timeoutMs: 10_000,
    appId: "admin-naver-datalab-shopping",
    request: {
      startDate: typeof body.startDate === "string" ? body.startDate : "",
      endDate: typeof body.endDate === "string" ? body.endDate : "",
      timeUnit: body.timeUnit === "date" || body.timeUnit === "month" ? body.timeUnit : "week",
      category: Array.isArray(body.category)
        ? body.category.map((item) => ({
            name: typeof item.name === "string" ? item.name : "",
            param: Array.isArray(item.param) ? item.param.filter((code): code is string => typeof code === "string") : [],
          }))
        : [],
    },
  });
  return res.status(result.ok ? 200 : 502).json(result);
}
