"use client";

import { useState } from "react";
import {
  useAiChat,
  useErpInventoryList,
  useWeatherForecast,
} from "@/components/common/api/client";

/**
 * Experimental sandbox for quick end-to-end checks.
 * Remove cleanly by:
 * 1) deleting this file
 * 2) removing import/render from `src/app/admin/apis/page.tsx`
 */
export function AdminApiTrialSandbox() {
  const ai = useAiChat();
  const inventory = useErpInventoryList();
  const forecast = useWeatherForecast();

  const [aiPrompt, setAiPrompt] = useState("오늘 농산물 출하 리스크를 3줄로 요약해줘.");
  const [baseDate, setBaseDate] = useState(todayYmd());
  const [prodCode, setProdCode] = useState("");

  async function runAiSample() {
    await ai.execute({ prompt: aiPrompt });
  }

  async function runInventorySample() {
    await inventory.execute({
      baseDate,
      prodCode: prodCode.trim() || undefined,
    });
  }

  async function runForecastSample() {
    await forecast.execute({});
  }

  return (
    <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-500/[0.05] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
            Experimental
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">Main API Trial Sandbox</h3>
          <p className="mt-1 text-sm text-zinc-300">
            메인 프로그램 라우트(`/api/ai`, `/api/erp`, `/api/weather`)를 관리자에서 빠르게 시범 호출합니다.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
          나중에 제거 가능
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">AI Chat</p>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="mt-3 h-24 w-full rounded-xl border border-white/10 bg-zinc-950/80 p-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={() => void runAiSample()}
            disabled={ai.loading}
            className="mt-3 h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-60"
          >
            {ai.loading ? "호출 중..." : "호출"}
          </button>
          {ai.error ? <p className="mt-2 text-xs text-rose-300">{ai.error}</p> : null}
          {ai.data ? <p className="mt-2 text-xs text-zinc-300 line-clamp-4">{ai.data.text}</p> : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">ERP Inventory List</p>
          <input
            value={baseDate}
            onChange={(e) => setBaseDate(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="YYYYMMDD"
            className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none"
          />
          <input
            value={prodCode}
            onChange={(e) => setProdCode(e.target.value)}
            placeholder="품목코드(선택)"
            className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={() => void runInventorySample()}
            disabled={inventory.loading}
            className="mt-3 h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-60"
          >
            {inventory.loading ? "조회 중..." : "조회"}
          </button>
          {inventory.error ? <p className="mt-2 text-xs text-rose-300">{inventory.error}</p> : null}
          {inventory.data ? (
            <p className="mt-2 text-xs text-zinc-300">
              totalCount: {inventory.data.totalCount}, items: {inventory.data.items.length}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">Weather Forecast</p>
          <p className="mt-3 text-xs text-zinc-400">
            관리자에 저장된 NX/NY/BASE_TIME 기본값으로 단기예보 호출
          </p>
          <button
            type="button"
            onClick={() => void runForecastSample()}
            disabled={forecast.loading}
            className="mt-3 h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-60"
          >
            {forecast.loading ? "조회 중..." : "조회"}
          </button>
          {forecast.error ? <p className="mt-2 text-xs text-rose-300">{forecast.error}</p> : null}
          {forecast.data ? (
            <p className="mt-2 text-xs text-zinc-300">
              totalCount: {forecast.data.totalCount}, items: {forecast.data.items.length}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function todayYmd() {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
