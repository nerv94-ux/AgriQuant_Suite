import type { GeminiRawResponse, GeminiResponseData } from "./types";

export function transformGeminiResponse(raw: GeminiRawResponse): GeminiResponseData {
  const candidate = raw.candidates?.[0];

  if (!candidate) {
    throw new Error("Gemini 응답에 candidate가 없습니다.");
  }

  const text = candidate.content.parts.map((p) => p.text).join("");

  return {
    text,
    finishReason: candidate.finishReason,
    usage: raw.usageMetadata
      ? {
          promptTokens: raw.usageMetadata.promptTokenCount,
          candidateTokens: raw.usageMetadata.candidatesTokenCount,
          totalTokens: raw.usageMetadata.totalTokenCount,
        }
      : undefined,
  };
}
