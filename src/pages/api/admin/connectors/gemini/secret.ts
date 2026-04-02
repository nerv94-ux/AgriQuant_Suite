import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { ApiErrorCategory } from "@/components/common/api/server/contracts";
import { buildError, buildSuccess } from "@/components/common/api/server/helpers/buildResponse";
import {
  getGeminiSettingsOverview,
  saveGeminiSecret,
  type GeminiSettingsOverview,
} from "@/components/common/api/server/admin/providerSettings";

type SecretBody = {
  apiKey?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<GeminiSettingsOverview>>
) {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const session = await getServerSession(req, res, authOptions);

  if (req.method !== "POST") {
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

  const body = (req.body ?? {}) as SecretBody;
  const apiKey = body.apiKey?.trim();

  if (!apiKey) {
    return res.status(400).json(
      buildError({
        message: "Gemini API 키를 입력해 주세요.",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  await saveGeminiSecret({
    apiKey,
    updatedByEmail: session.user.email ?? null,
  });

  const data = await getGeminiSettingsOverview();
  return res
    .status(200)
    .json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
}
