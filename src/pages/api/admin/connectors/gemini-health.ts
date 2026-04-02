import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callGemini } from "@/components/common/api/server/connectors/gemini";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { GeminiResponseData } from "@/components/common/api/server/connectors/gemini";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<GeminiResponseData>>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      data: null,
      message: "METHOD_NOT_ALLOWED",
      meta: {
        source: "GEMINI",
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
        source: "GEMINI",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "AUTH_ERROR",
      },
    });
  }

  const requestId = crypto.randomUUID();

  const result = await callGemini({
    requestId,
    request: {
      contents: [
        {
          role: "user",
          parts: [{ text: "헬스체크: 'ok'라고만 답해줘." }],
        },
      ],
      generationConfig: { maxOutputTokens: 10, temperature: 0 },
    },
    timeoutMs: 10_000,
    appId: "admin-health-check",
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
