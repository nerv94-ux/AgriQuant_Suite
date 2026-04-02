// ─── Gemini API 요청 타입 ───────────────────────────────────────

export type GeminiRole = "user" | "model";

export interface GeminiContent {
  role: GeminiRole;
  parts: Array<{ text: string }>;
}

export interface GeminiGenerationConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

export interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySetting[];
  systemInstruction?: { parts: Array<{ text: string }> };
}

// ─── Gemini API 원본 응답 타입(Raw) ─────────────────────────────

export interface GeminiRawCandidate {
  content: GeminiContent;
  finishReason: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER";
  safetyRatings?: Array<{ category: string; probability: string }>;
}

export interface GeminiRawUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface GeminiRawResponse {
  candidates: GeminiRawCandidate[];
  usageMetadata?: GeminiRawUsageMetadata;
  modelVersion?: string;
}

// ─── 표준화된 Gemini 응답 data 타입 ─────────────────────────────

export interface GeminiResponseData {
  text: string;
  finishReason: GeminiRawCandidate["finishReason"];
  usage?: {
    promptTokens: number;
    candidateTokens: number;
    totalTokens: number;
  };
}
