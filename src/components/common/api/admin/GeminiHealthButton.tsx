"use client";

import { useState } from "react";

type HealthState = "idle" | "loading" | "ok" | "error";

export function GeminiHealthButton() {
  const [state, setState] = useState<HealthState>("idle");
  const [detail, setDetail] = useState<string>("");

  const run = async () => {
    setState("loading");
    setDetail("");
    try {
      const res = await fetch("/api/admin/connectors/gemini-health", {
        method: "POST",
      });
      const body = await res.json();
      if (body.ok) {
        setState("ok");
        setDetail(body.data?.text ?? "");
      } else {
        setState("error");
        setDetail(body.message ?? "오류가 발생했습니다.");
      }
    } catch {
      setState("error");
      setDetail("네트워크 오류 — 서버에 연결할 수 없습니다.");
    }
  };

  const labelMap: Record<HealthState, string> = {
    idle: "연결 테스트",
    loading: "테스트 중...",
    ok: "연결 성공",
    error: "연결 실패",
  };

  const colorMap: Record<HealthState, string> = {
    idle: "bg-zinc-700 hover:bg-zinc-600 text-zinc-100",
    loading: "bg-zinc-700 text-zinc-400 cursor-wait",
    ok: "bg-emerald-600/30 border border-emerald-300/20 text-emerald-200",
    error: "bg-rose-600/30 border border-rose-300/20 text-rose-200",
  };

  return (
    <div className="mt-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={state === "loading"}
        className={`h-9 rounded-xl px-4 text-xs font-semibold transition-colors disabled:cursor-wait ${colorMap[state]}`}
      >
        {labelMap[state]}
      </button>
      {detail ? (
        <p className="text-xs text-zinc-300 leading-relaxed break-all">{detail}</p>
      ) : null}
    </div>
  );
}
