import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import { callGemini } from "@/components/common/api/server/connectors/gemini";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { GeminiResponseData } from "@/components/common/api/server/connectors/gemini";

type ChatBody = {
  prompt?: string;
  context?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

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
  if (!session || session.user.approvalStatus !== "APPROVED") {
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

  const body = (req.body ?? {}) as ChatBody;
  const prompt = body.prompt?.trim() ?? "";
  const context = body.context?.trim() ?? "";
  if (!prompt) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "prompt는 필수입니다.",
      meta: {
        source: "GEMINI",
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        durationMs: 0,
        errorCategory: "VALIDATION_ERROR",
      },
    });
  }

  const requestId = crypto.randomUUID();
  const result = await callGemini({
    requestId,
    appId: "main-ai-chat",
    model: body.model?.trim() || undefined,
    timeoutMs: 20_000,
    request: {
      contents: [
        {
          role: "user",
          parts: [{ text: context ? `[컨텍스트]\n${context}\n\n[질문]\n${prompt}` : prompt }],
        },
      ],
      generationConfig: {
        temperature: typeof body.temperature === "number" ? body.temperature : undefined,
        maxOutputTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
      },
    },
  });

  return res.status(result.ok ? 200 : 502).json(result);
}
