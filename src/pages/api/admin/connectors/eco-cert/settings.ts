import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/components/common/auth/server/authOptions";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import { ApiErrorCategory } from "@/components/common/api/server/contracts";
import { buildError, buildSuccess } from "@/components/common/api/server/helpers/buildResponse";
import {
  getEcoCertSettingsOverview,
  saveEcoCertConfig,
  type EcoCertSettingsOverview,
} from "@/components/common/api/server/admin/providerSettings";

type SettingsBody = {
  enabled?: boolean;
  apiUrl?: string;
  pageNo?: number;
  numOfRows?: number;
  type?: "JSON" | "XML";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<EcoCertSettingsOverview>>
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
    const data = await getEcoCertSettingsOverview();
    return res.status(200).json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
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
  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
  const apiUrl = typeof body.apiUrl === "string" ? body.apiUrl.trim() : "";
  const pageNo = Number(body.pageNo);
  const numOfRows = Number(body.numOfRows);
  const type = body.type === "XML" ? "XML" : "JSON";

  if (apiUrl && !/^https?:\/\//.test(apiUrl)) {
    return res.status(400).json(
      buildError({
        message: "apiUrl은 http:// 또는 https:// 로 시작해야 합니다.",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  if (!Number.isInteger(pageNo) || pageNo < 1) {
    return res.status(400).json(
      buildError({
        message: "pageNo는 1 이상의 정수여야 합니다.",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  if (!Number.isInteger(numOfRows) || numOfRows < 1 || numOfRows > 100) {
    return res.status(400).json(
      buildError({
        message: "numOfRows는 1~100 사이 정수여야 합니다.",
        source: "SYSTEM",
        requestId,
        startedAt,
        errorCategory: ApiErrorCategory.VALIDATION_ERROR,
      })
    );
  }

  await saveEcoCertConfig({
    enabled,
    apiUrl,
    pageNo,
    numOfRows,
    type,
    updatedByEmail: session.user.email ?? null,
  });

  const data = await getEcoCertSettingsOverview();
  return res.status(200).json(buildSuccess({ data, source: "SYSTEM", requestId, startedAt }));
}
