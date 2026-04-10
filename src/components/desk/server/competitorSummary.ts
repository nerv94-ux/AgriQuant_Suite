import { callGemini } from "@/components/common/api/server/connectors/gemini/client";

type SnapshotRow = {
  id: string;
  targetId: string;
  label: string;
  source: string;
  productNo: string;
  url: string;
  price: number | null;
  optionPriceMin: number | null;
  optionPriceMax: number | null;
  soldOut: boolean | null;
  reviewCount: number | null;
  rating: number | null;
  status: "SUCCESS" | "FAILED";
  errorMessage: string;
  collectedAt: Date;
};

export type CompetitorSummaryMetrics = {
  totalSnapshots: number;
  successSnapshots: number;
  failedSnapshots: number;
  successRatePct: number;
  latestCollectedAt: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  soldOutCount: number;
  reviewCountAvg: number | null;
  ratingAvg: number | null;
};

export type CompetitorLlmSummary = {
  summary: string;
  strengths: string[];
  risks: string[];
  complaintKeywords: string[];
  evidence: string[];
};

export type CompetitorSummaryResult = {
  metrics: CompetitorSummaryMetrics;
  llmSummary: CompetitorLlmSummary;
  usedSnapshots: number;
  fallbackUsed: boolean;
};

function average(nums: number[]): number | null {
  if (nums.length < 1) return null;
  const sum = nums.reduce((acc, value) => acc + value, 0);
  return Number((sum / nums.length).toFixed(2));
}

function toMetrics(rows: SnapshotRow[]): CompetitorSummaryMetrics {
  const successRows = rows.filter((row) => row.status === "SUCCESS");
  const priceValues = successRows.map((row) => row.price).filter((v): v is number => typeof v === "number");
  const reviewValues = successRows.map((row) => row.reviewCount).filter((v): v is number => typeof v === "number");
  const ratingValues = successRows.map((row) => row.rating).filter((v): v is number => typeof v === "number");
  const soldOutCount = successRows.filter((row) => row.soldOut === true).length;
  const latestCollectedAt = rows[0]?.collectedAt?.toISOString() ?? null;
  const successRatePct = rows.length > 0 ? Number(((successRows.length / rows.length) * 100).toFixed(1)) : 0;
  return {
    totalSnapshots: rows.length,
    successSnapshots: successRows.length,
    failedSnapshots: rows.length - successRows.length,
    successRatePct,
    latestCollectedAt,
    priceMin: priceValues.length > 0 ? Math.min(...priceValues) : null,
    priceMax: priceValues.length > 0 ? Math.max(...priceValues) : null,
    priceAvg: average(priceValues),
    soldOutCount,
    reviewCountAvg: average(reviewValues),
    ratingAvg: average(ratingValues),
  };
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenceRemoved = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(fenceRemoved) as Record<string, unknown>;
  } catch {
    /* noop */
  }
  const matched = fenceRemoved.match(/\{[\s\S]*\}/);
  if (!matched) return null;
  try {
    return JSON.parse(matched[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean).slice(0, 8);
}

function buildFallbackSummary(metrics: CompetitorSummaryMetrics): CompetitorLlmSummary {
  return {
    summary: `최근 ${metrics.totalSnapshots}건 중 성공 ${metrics.successSnapshots}건, 실패 ${metrics.failedSnapshots}건입니다.`,
    strengths: metrics.successRatePct >= 70 ? ["수집 성공률이 비교적 안정적입니다."] : [],
    risks: metrics.failedSnapshots > 0 ? ["실패 스냅샷이 있어 링크/파서 점검이 필요합니다."] : [],
    complaintKeywords: [],
    evidence: [
      `성공률 ${metrics.successRatePct}%`,
      metrics.latestCollectedAt ? `최근 수집 ${metrics.latestCollectedAt}` : "최근 수집 시각 없음",
    ],
  };
}

export async function summarizeCompetitorSnapshots(params: {
  snapshots: SnapshotRow[];
  productName: string;
}): Promise<CompetitorSummaryResult> {
  const rows = params.snapshots;
  const metrics = toMetrics(rows);
  const fallback = buildFallbackSummary(metrics);
  if (rows.length < 1) {
    return { metrics, llmSummary: fallback, usedSnapshots: 0, fallbackUsed: true };
  }

  const condensed = rows.slice(0, 30).map((row) => ({
    collectedAt: row.collectedAt.toISOString(),
    targetId: row.targetId,
    label: row.label,
    source: row.source,
    status: row.status,
    price: row.price,
    optionPriceMin: row.optionPriceMin,
    optionPriceMax: row.optionPriceMax,
    soldOut: row.soldOut,
    reviewCount: row.reviewCount,
    rating: row.rating,
    errorMessage: row.errorMessage,
  }));

  const prompt = [
    "다음 데이터는 경쟁상품 수집 스냅샷이다.",
    "정량 계산은 이미 코드에서 처리하므로, 너는 정성 요약만 담당한다.",
    "반드시 JSON 객체만 출력하고 설명문은 금지한다.",
    '키는 정확히 {"summary","strengths","risks","complaintKeywords","evidence"} 만 사용한다.',
    "각 배열은 문자열 배열로 작성한다.",
    `대상 품목: ${params.productName}`,
    `정량 지표: ${JSON.stringify(metrics)}`,
    `스냅샷 데이터: ${JSON.stringify(condensed)}`,
  ].join("\n");

  const gemini = await callGemini({
    requestId: crypto.randomUUID(),
    appId: "desk-competitor-summary",
    request: {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
      },
    },
  });

  if (!gemini.ok) {
    return { metrics, llmSummary: fallback, usedSnapshots: condensed.length, fallbackUsed: true };
  }

  const obj = extractJsonObject(gemini.data.text);
  if (!obj) {
    return { metrics, llmSummary: fallback, usedSnapshots: condensed.length, fallbackUsed: true };
  }
  const llmSummary: CompetitorLlmSummary = {
    summary: String(obj.summary ?? fallback.summary).trim() || fallback.summary,
    strengths: toStringArray(obj.strengths),
    risks: toStringArray(obj.risks),
    complaintKeywords: toStringArray(obj.complaintKeywords),
    evidence: toStringArray(obj.evidence),
  };
  return { metrics, llmSummary, usedSnapshots: condensed.length, fallbackUsed: false };
}
