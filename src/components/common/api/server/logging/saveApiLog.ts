import { prisma } from "@/components/common/auth/server/prisma";
import type { BaseMeta } from "../contracts/meta";
import { trimApiLogs } from "./retention";

type SaveApiLogParams = {
  ok: boolean;
  meta: BaseMeta;
  appId?: string;
  message?: string;
};

export async function saveApiLog(params: SaveApiLogParams): Promise<void> {
  const { ok, meta, appId, message } = params;

  try {
    await prisma.apiCallLog.create({
      data: {
        requestId: meta.requestId,
        source: meta.source,
        ok,
        durationMs: meta.durationMs,
        timestamp: new Date(meta.timestamp),
        appId: appId ?? null,
        errorCategory: meta.errorCategory ?? null,
        message: message ?? null,
        extra: meta.extra ? JSON.stringify(meta.extra) : null,
      },
    });

    await trimApiLogs(meta.source);
  } catch {
    // 로그 저장 실패는 원본 응답에 영향을 주지 않도록 silent fail
    console.error("[saveApiLog] 로그 저장 실패 — requestId:", meta.requestId);
  }
}
