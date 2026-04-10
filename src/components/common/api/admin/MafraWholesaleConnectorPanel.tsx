"use client";

import { MafraAdminCard } from "./MafraAdminCard";
import { MafraQualitySafetyCard } from "./MafraQualitySafetyCard";

/**
 * 전국 도매시장 경매 커넥터: 시세·코드(가격/거래)와 품질·안전(잔류농약)을 같은 MAFRA 키로 구분 배치합니다.
 */
export function MafraWholesaleConnectorPanel() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="border-b border-white/10 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">도매시장 · 시세 · 코드</p>
          <p className="mt-0.5 text-xs text-zinc-400">실시간 경락, 정산가격, 소매가격, 코드사전 등</p>
        </div>
        <MafraAdminCard className="rounded-2xl border border-white/10 bg-black/20 p-5" />
      </section>

      <section className="space-y-3">
        <div className="border-b border-white/10 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">품질 · 안전</p>
          <p className="mt-0.5 text-xs text-zinc-400">잔류농약 분석 등 — 인증키는 위와 동일, API 그리드만 다름</p>
        </div>
        <MafraQualitySafetyCard className="rounded-2xl border border-white/10 bg-black/20 p-5" />
      </section>
    </div>
  );
}
