import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { ApiErrorCategory } from "@/components/common/api/server/contracts";
import { buildError, buildSuccess } from "@/components/common/api/server/helpers/buildResponse";
import {
  getGeminiSettingsOverview,
  saveGeminiConfig,
  type GeminiSettingsOverview,
} from "@/components/common/api/server/admin/providerSettings";

type SettingsBody = {
  enabled?: boolean;
  defaultModel?: string;
  timeoutMs?: number;
  temperature?: number | null;
  maxOutputTokens?: number | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<GeminiSettingsOverview>>
) {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ADMIN" || session.user.approvalStatus !== "APPROVED") {
    return res.status(403).json(
      buildError({
        message: "FORBIDDEN",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.AUTH_ERROR,
      })
    );
  }

  if (req.method === "GET") {
    const data = await getGeminiSettingsOverview();
    return res
      .status(200)
      .json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
  }

  if (req.method !== "PATCH") {
    return res.status(405).json(
      buildError({
        message: "METHOD_NOT_ALLOWED",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  const body = (req.body ?? {}) as SettingsBody;
  const defaultModel = typeof body.defaultModel === "string" ? body.defaultModel : "";
  const timeoutMs = Number(body.timeoutMs);
  const temperature =
    body.temperature === null || body.temperature === undefined
      ? null
      : Number(body.temperature);
  const maxOutputTokens =
    body.maxOutputTokens === null || body.maxOutputTokens === undefined
      ? null
      : Number(body.maxOutputTokens);

  if (typeof body.enabled !== "boolean" || !defaultModel.trim() || !Number.isFinite(timeoutMs)) {
    return res.status(400).json(
      buildError({
        message: "설정값 형식이 올바르지 않습니다.",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  await saveGeminiConfig({
    enabled: body.enabled,
    defaultModel,
    timeoutMs,
    temperature,
    maxOutputTokens,
    updatedByEmail: session.user.email ?? null,
  });

  const data = await getGeminiSettingsOverview();
  return res
    .status(200)
    .json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
}
