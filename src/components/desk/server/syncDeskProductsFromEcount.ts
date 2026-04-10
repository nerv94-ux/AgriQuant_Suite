import type { EcountProductListRequest } from "@/components/common/api/server/connectors/ecount";
import { callEcountGetBasicProductsList } from "@/components/common/api/server/connectors/ecount";
import {
  computeDeskProductApiFingerprint,
  deskSyncDisplayFromEcountApi,
  pickEcountDeskNameFromRaw,
  pickEcountDeskSpecFromRaw,
  splitEcountProdCode,
} from "@/components/desk/server/ecountDeskDisplay";
import type { Prisma } from "@prisma/client";
import { DeskProductSource } from "@prisma/client";
import { prisma } from "@/components/common/auth/server/prisma";

export const DESK_SEED_IDS = ["deskseed_carrot", "deskseed_cabbage", "deskseed_manual"] as const;

/** 품목코드 범위·유형: 재고 API 대신 품목기본(GetBasicProductsList) 조건 */
function deskEcountListRequest(): EcountProductListRequest {
  const prodType = process.env.ECOUNT_DESK_PROD_TYPE?.trim();
  if (prodType && prodType.length <= 20) {
    return { prodType };
  }
  const fromCd = (process.env.ECOUNT_DESK_FROM_PROD_CD?.trim() || "0").slice(0, 20);
  const toCd = (process.env.ECOUNT_DESK_TO_PROD_CD?.trim() || "zzzzzzzzzzzzzzzzzzzz").slice(0, 20);
  return { fromProdCd: fromCd, toProdCd: toCd };
}

export type SyncDeskProductsFromEcountResult =
  | { ok: true; message: string; upserted: number }
  | { ok: false; message: string };

/** prefetch `IN (...)` / `NOT IN (...)` 시 SQLite 바인딩 한도(999) 아래로 분할 */
const CODE_IN_OR_NOT_IN_CHUNK = 800;
/** 품목 한 건씩 await 하면 수백~수천 번 왕복되어 CPU·디스크가 한꺼번에 밀림 → 배치 트랜잭션 */
const SYNC_TX_BATCH = 45;
const DELETE_STALE_IN_CHUNK = 300;

async function findDeskProductsForSyncPrefetch(codeList: string[]): Promise<
  Array<{
    ecountProdCode: string | null;
    displayLocked: boolean;
    lockedAtFingerprint: string | null;
    lastApiFingerprint: string | null;
  }>
> {
  const out: Array<{
    ecountProdCode: string | null;
    displayLocked: boolean;
    lockedAtFingerprint: string | null;
    lastApiFingerprint: string | null;
  }> = [];
  for (let i = 0; i < codeList.length; i += CODE_IN_OR_NOT_IN_CHUNK) {
    const slice = codeList.slice(i, i + CODE_IN_OR_NOT_IN_CHUNK);
    const batch = await prisma.deskProduct.findMany({
      where: { ecountProdCode: { in: slice } },
      select: {
        ecountProdCode: true,
        displayLocked: true,
        lockedAtFingerprint: true,
        lastApiFingerprint: true,
      },
    });
    out.push(...batch);
  }
  return out;
}

function needsReviewAfterSync(prev: {
  displayLocked: boolean;
  lockedAtFingerprint: string | null;
  lastApiFingerprint: string | null;
}, newFp: string): boolean {
  if (!prev.displayLocked) return false;
  if (prev.lockedAtFingerprint != null) {
    return prev.lockedAtFingerprint !== newFp;
  }
  if (prev.lastApiFingerprint != null) {
    return prev.lastApiFingerprint !== newFp;
  }
  return false;
}

/**
 * 이카운트 품목기본 API `GetBasicProductsList`로 품목을 가져와 DeskProduct에 반영합니다.
 *
 * 동기화 시 **품목코드·구분·품목명(API)** 만 반영하고, **규격(specLabel)** 은 `—`로 두며 실무자가 입력합니다.
 *
 * `displayLocked` 인 행은 품목명·규격(name/specLabel)을 덮어쓰지 않고, API 지문만 갱신합니다.
 * 확정 이후 이카운트 원문이 바뀌면 `needsSourceReview` 를 올립니다.
 *
 * 예전에는 행마다 자동 커밋이라 왕복이 너무 많아져 체감이 매우 무거웠음.
 * 짧은 배치 트랜잭션으로 묶어 왕복·fsync 횟수를 줄임.
 */
async function flushSyncBatch(batch: Prisma.PrismaPromise<unknown>[]): Promise<void> {
  if (batch.length === 0) return;
  await prisma.$transaction(batch);
  batch.length = 0;
}

export async function syncDeskProductsFromEcount(): Promise<SyncDeskProductsFromEcountResult> {
  const requestId = crypto.randomUUID();
  const listRequest = deskEcountListRequest();

  const result = await callEcountGetBasicProductsList({
    requestId,
    timeoutMs: 300_000,
    appId: "desk-ecount-product-sync",
    request: listRequest,
  });

  if (!result.ok || !result.data) {
    let msg = result.message ?? "이카운트 동기화에 실패했습니다.";
    if (msg.includes("인증되지 않은 API")) {
      msg +=
        " 품목기본(GetBasicProductsList) 권한이 없으면 이카운트 관리자에서 OpenAPI 사용 API를 활성화해야 합니다.";
    }
    return { ok: false, message: msg };
  }

  const products = result.data.products;
  if (products.length === 0) {
    const hint = listRequest.prodType
      ? "품목유형에 해당하는 품목이 없습니다."
      : "품목코드 범위에 해당하는 품목이 없습니다. .env.local 에 ECOUNT_DESK_FROM_PROD_CD / ECOUNT_DESK_TO_PROD_CD 또는 ECOUNT_DESK_PROD_TYPE 을 회사 품목코드 규칙에 맞게 조정해 보세요.";
    return {
      ok: false,
      message: `이카운트에서 가져온 품목이 0건입니다. ${hint}`,
    };
  }

  const codes = new Set<string>();
  const rows: Array<{ code: string; raw: Record<string, unknown> }> = [];
  for (const raw of products) {
    const code = String(raw.PROD_CD ?? (raw as { prod_cd?: string }).prod_cd ?? "").trim();
    if (!code) continue;
    codes.add(code);
    rows.push({ code, raw });
  }

  if (codes.size === 0) {
    return {
      ok: false,
      message: "이카운트 응답에 유효한 품목코드(PROD_CD)가 없습니다.",
    };
  }

  const codeList = [...codes];
  const existingRows = await findDeskProductsForSyncPrefetch(codeList);
  const byCode = new Map(
    existingRows
      .filter((r): r is typeof r & { ecountProdCode: string } => typeof r.ecountProdCode === "string")
      .map((r) => [r.ecountProdCode, r]),
  );

  const txBatch: Prisma.PrismaPromise<unknown>[] = [];

  for (const { code, raw } of rows) {
    const fullName = pickEcountDeskNameFromRaw(raw, code);
    const apiSpec = pickEcountDeskSpecFromRaw(raw);
    const fp = computeDeskProductApiFingerprint(code, fullName, apiSpec);
    const { name, specLabel } = deskSyncDisplayFromEcountApi(fullName, code);
    const { suffix: codeSuffix } = splitEcountProdCode(code);
    const prev = byCode.get(code);

    if (!prev) {
      txBatch.push(
        prisma.deskProduct.create({
          data: {
            ecountProdCode: code,
            ecountCategorySuffix: codeSuffix,
            lastApiFingerprint: fp,
            needsSourceReview: false,
            deskEnabled: true,
            name,
            specLabel,
            packageUnit: "",
            source: DeskProductSource.ECOUNT,
            hasOpenMarketMatch: false,
          },
        }),
      );
    } else if (prev.displayLocked) {
      const review = needsReviewAfterSync(prev, fp);
      txBatch.push(
        prisma.deskProduct.update({
          where: { ecountProdCode: code },
          data: {
            ecountCategorySuffix: codeSuffix,
            lastApiFingerprint: fp,
            needsSourceReview: review,
          },
        }),
      );
    } else {
      txBatch.push(
        prisma.deskProduct.update({
          where: { ecountProdCode: code },
          data: {
            ecountCategorySuffix: codeSuffix,
            lastApiFingerprint: fp,
            needsSourceReview: false,
            name,
            specLabel,
            source: DeskProductSource.ECOUNT,
          },
        }),
      );
    }

    if (txBatch.length >= SYNC_TX_BATCH) {
      await flushSyncBatch(txBatch);
    }
  }

  await flushSyncBatch(txBatch);

  const codeArray = [...codes];
  const syncedSet = new Set(codes);
  if (codeArray.length > 0) {
    if (codeArray.length <= CODE_IN_OR_NOT_IN_CHUNK) {
      await prisma.deskProduct.deleteMany({
        where: { ecountProdCode: { notIn: codeArray } },
      });
    } else {
      const allEcountRows = await prisma.deskProduct.findMany({
        where: { ecountProdCode: { not: null } },
        select: { ecountProdCode: true },
      });
      const staleCodes = [
        ...new Set(
          allEcountRows
            .map((r) => r.ecountProdCode)
            .filter((c): c is string => typeof c === "string" && c.length > 0)
            .filter((c) => !syncedSet.has(c)),
        ),
      ];
      for (let i = 0; i < staleCodes.length; i += DELETE_STALE_IN_CHUNK) {
        const chunk = staleCodes.slice(i, i + DELETE_STALE_IN_CHUNK);
        await prisma.deskProduct.deleteMany({
          where: { ecountProdCode: { in: chunk } },
        });
      }
    }
  }

  await prisma.deskProduct.deleteMany({
    where: { id: { in: [...DESK_SEED_IDS] } },
  });

  return {
    ok: true,
    message: `이카운트 품목 ${codes.size}건 반영했습니다.`,
    upserted: codes.size,
  };
}
