"use client";

import { useState } from "react";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T | null;
  message?: string;
};

async function readApiEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as ApiEnvelope<T>;
  }
  throw new Error("관리자 API가 JSON 응답을 반환하지 않았습니다.");
}

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (!text) continue;
    search.set(key, text);
  }
  return search.toString();
}

/**
 * 농산물 잔류농약 등 품질·안전 API — MAFRA 그리드이며 `MAFRA_API_KEY`는 도매시장 커넥터와 공유합니다.
 */
export function MafraQualitySafetyCard({ className }: { className?: string }) {
  const [sploreNo, setSploreNo] = useState("");
  const [registDe, setRegistDe] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<{ rows: number; total: number } | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function runPesticideResidue() {
    setState("loading");
    setErrorText(null);
    setNotice("");
    try {
      const query = buildQuery({
        SPLORE_NO: sploreNo,
        REGIST_DE: registDe,
        startIndex: 1,
        endIndex: 5,
      });
      const res = await fetch(`/api/admin/connectors/mafra/pesticide-residue/list?${query}`);
      const body = await readApiEnvelope<{ rows: unknown[]; totalCount: number }>(res);
      if (!body.ok || !body.data) throw new Error(body.message ?? "잔류농약 분석 조회 실패");
      setResult({ rows: body.data.rows.length, total: body.data.totalCount });
      if (typeof body.message === "string" && body.message.trim()) {
        setNotice(body.message);
      }
      setState("done");
    } catch (error) {
      setState("error");
      const message = error instanceof Error ? error.message : "잔류농약 분석 조회 실패";
      setErrorText(message);
      setNotice(message);
    }
  }

  return (
    <div className={className ?? "rounded-3xl border border-white/10 bg-black/20 p-5"}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-white">품질·안전 데이터</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            <strong className="font-medium text-zinc-300">농산물 잔류농약 분석결과</strong>{" "}
            <span className="font-mono text-[11px] text-zinc-500">(TI_NAQS_FRMREMN_AGCANALS_RESLT)</span>
            — 위 도매시장 카드와 동일한 <strong className="text-zinc-300">MAFRA_API_KEY</strong>·호스트(
            <span className="font-mono text-[10px]">211.237.50.150:7080</span>)를 씁니다. 시세·경매와{" "}
            <strong className="text-zinc-300">역할만 분리</strong>했습니다.
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={sploreNo}
            onChange={(e) => setSploreNo(e.target.value)}
            placeholder="SPLORE_NO 표본번호 (선택)"
            className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none placeholder:text-zinc-500 md:col-span-2"
          />
          <input
            value={registDe}
            onChange={(e) => setRegistDe(e.target.value)}
            placeholder="REGIST_DE 등록일자 (선택, 명세 형식에 맞게)"
            className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none placeholder:text-zinc-500 md:col-span-2"
          />
        </div>

        <button
          type="button"
          onClick={() => void runPesticideResidue()}
          disabled={state === "loading"}
          className="h-10 w-full rounded-xl border border-emerald-300/25 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-100 disabled:opacity-50"
        >
          {state === "loading" ? "조회 중…" : "잔류농약 분석결과 조회 (Grid_20161206000000000390_1)"}
        </button>

        <p className="text-xs text-zinc-300">
          결과: {result ? `${result.rows}건 / total ${result.total}` : "-"}
          {errorText ? ` (실패: ${errorText})` : ""}
        </p>

        {notice ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">{notice}</p>
        ) : null}
      </div>
    </div>
  );
}
