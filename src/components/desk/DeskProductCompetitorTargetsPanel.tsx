"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { autoFillCompetitorTarget, type CompetitorSource, type CompetitorSyncLog } from "@/components/desk/competitorTargets";

type CompetitorTarget = {
  id: string;
  label: string;
  url: string;
  productNo: string;
  enabled: boolean;
  createdAt: string;
  source: CompetitorSource;
  canonicalUrl: string;
  needsManualReview: boolean;
  lastSyncLog: CompetitorSyncLog | null;
};

type Props = {
  productId: string;
  productName: string;
};

function newTarget(seedName: string): CompetitorTarget {
  return {
    id: crypto.randomUUID(),
    label: seedName,
    url: "",
    productNo: "",
    enabled: true,
    createdAt: new Date().toISOString(),
    source: "UNKNOWN",
    canonicalUrl: "",
    needsManualReview: false,
    lastSyncLog: null,
  };
}

type SaveState = "idle" | "saving" | "saved" | "error";
type CollectSummary = {
  totalTargets: number;
  enabledTargets: number;
  collectedTargets: number;
  success: number;
  failed: number;
  retryUsed: number;
  latestCollectedAt: string | null;
  recentSuccess: number;
  recentFailed: number;
};

type LlmSummary = {
  summary: string;
  strengths: string[];
  risks: string[];
  complaintKeywords: string[];
  evidence: string[];
};

type SummaryMetrics = {
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

type SummaryResult = {
  metrics: SummaryMetrics;
  llmSummary: LlmSummary;
  usedSnapshots: number;
  fallbackUsed: boolean;
};

function savableTargets(rows: CompetitorTarget[]): CompetitorTarget[] {
  return rows
    .map((row) => autoFillCompetitorTarget(row))
    .filter((row) => Boolean(row.id.trim()) && Boolean(row.url.trim() || row.productNo.trim()));
}

function targetHash(rows: CompetitorTarget[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      id: row.id,
      label: row.label,
      url: row.url,
      productNo: row.productNo,
      enabled: row.enabled,
      createdAt: row.createdAt,
      source: row.source,
      canonicalUrl: row.canonicalUrl,
      needsManualReview: row.needsManualReview,
    })),
  );
}

export default function DeskProductCompetitorTargetsPanel({ productId, productName }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [targets, setTargets] = useState<CompetitorTarget[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [syncing, setSyncing] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [saveInfo, setSaveInfo] = useState<string | null>(null);
  const [collectInfo, setCollectInfo] = useState<string | null>(null);
  const [collectSummary, setCollectSummary] = useState<CollectSummary | null>(null);
  const [collectFailures, setCollectFailures] = useState<Array<{ label: string; source: string; errorMessage: string }>>([]);
  const [summaryInfo, setSummaryInfo] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const readyRef = useRef(false);
  const lastSavedHashRef = useRef("");

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setSaveInfo(null);
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/competitor-targets`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; targets?: CompetitorTarget[] };
      if (!res.ok || json.ok !== true || !Array.isArray(json.targets)) {
        setErr(typeof json.message === "string" ? json.message : "경쟁상품 목록을 불러오지 못했습니다.");
        return;
      }
      const loaded = json.targets.map((row) => autoFillCompetitorTarget(row));
      setTargets(loaded);
      lastSavedHashRef.current = targetHash(loaded);
      readyRef.current = true;
      setSaveState("saved");
      setSaveInfo("저장된 최신 목록입니다.");
      setCollectInfo(null);
    } catch {
      setErr("네트워크 오류로 경쟁상품 목록을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upsertRow = useCallback((id: string, patch: Partial<CompetitorTarget>) => {
    setTargets((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const merged = { ...row, ...patch };
        return autoFillCompetitorTarget(merged);
      }),
    );
  }, []);

  const removeRow = useCallback((id: string) => {
    setTargets((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const addRow = useCallback(() => {
    setTargets((prev) => [...prev, newTarget(productName)]);
  }, [productName]);

  const saveNow = useCallback(async (rows: CompetitorTarget[]) => {
    const normalized = savableTargets(rows);
    const hash = targetHash(normalized);
    if (hash === lastSavedHashRef.current) return true;
    if (normalized.length < 1) {
      lastSavedHashRef.current = hash;
      return true;
    }
    setSaveState("saving");
    setErr(null);
    setSaveInfo("자동 저장 중...");
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/competitor-targets`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: normalized }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; targets?: CompetitorTarget[] };
      if (!res.ok || json.ok !== true || !Array.isArray(json.targets)) {
        setSaveState("error");
        setErr(typeof json.message === "string" ? json.message : "경쟁상품 저장에 실패했습니다.");
        setSaveInfo("저장 실패. 재시도해 주세요.");
        return false;
      }
      lastSavedHashRef.current = hash;
      setSaveState("saved");
      setSaveInfo("자동 저장되었습니다.");
      return true;
    } catch {
      setSaveState("error");
      setErr("네트워크 오류로 경쟁상품 저장에 실패했습니다.");
      setSaveInfo("네트워크 오류. 재시도해 주세요.");
      return false;
    }
  }, [productId]);

  useEffect(() => {
    if (!readyRef.current) return;
    const hash = targetHash(targets);
    if (hash === lastSavedHashRef.current) return;
    const timer = setTimeout(() => {
      void saveNow(targets);
    }, 1000);
    return () => clearTimeout(timer);
  }, [saveNow, targets]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setErr(null);
    setSaveInfo("링크 점검/복구 실행 중...");
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/competitor-targets?action=sync`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        targets?: CompetitorTarget[];
        sync?: { checked: number; repaired: number; manualReview: number; failed: number };
      };
      if (!res.ok || json.ok !== true || !Array.isArray(json.targets)) {
        setErr(typeof json.message === "string" ? json.message : "링크 점검/복구에 실패했습니다.");
        return;
      }
      const synced = json.targets.map((row) => autoFillCompetitorTarget(row));
      setTargets(synced);
      lastSavedHashRef.current = targetHash(synced);
      const summary = json.sync;
      setSaveState("saved");
      setSaveInfo(
        summary
          ? `점검 ${summary.checked}건 · 복구 ${summary.repaired}건 · 수동확인 ${summary.manualReview}건`
          : "링크 점검/복구를 완료했습니다.",
      );
    } catch {
      setErr("네트워크 오류로 링크 점검/복구에 실패했습니다.");
    } finally {
      setSyncing(false);
    }
  }, [productId]);

  const runCollect = useCallback(async () => {
    setCollecting(true);
    setErr(null);
    setCollectInfo("경쟁상품 수집 실행 중...");
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/competitor-collect`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        summary?: CollectSummary;
        snapshots?: Array<{ status: "SUCCESS" | "FAILED"; label: string; source: string; errorMessage: string }>;
      };
      if (!res.ok || json.ok !== true || !json.summary) {
        setErr(typeof json.message === "string" ? json.message : "경쟁상품 수집 실행에 실패했습니다.");
        return;
      }
      setCollectSummary(json.summary);
      const failures = (json.snapshots ?? [])
        .filter((row) => row.status === "FAILED")
        .map((row) => ({
          label: row.label || "라벨없음",
          source: row.source || "UNKNOWN",
          errorMessage: row.errorMessage || "UNKNOWN",
        }));
      setCollectFailures(failures.slice(0, 6));
      setCollectInfo(
        `수집 ${json.summary.collectedTargets}건 · 성공 ${json.summary.success}건 · 실패 ${json.summary.failed}건`,
      );
    } catch {
      setErr("네트워크 오류로 경쟁상품 수집 실행에 실패했습니다.");
    } finally {
      setCollecting(false);
    }
  }, [productId]);

  const runSummary = useCallback(async () => {
    setSummarizing(true);
    setErr(null);
    setSummaryInfo("Gemini 요약 생성 중...");
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/competitor-summary`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windowSize: 30 }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; summary?: SummaryResult };
      if (!res.ok || json.ok !== true || !json.summary) {
        setErr(typeof json.message === "string" ? json.message : "Gemini 요약 생성에 실패했습니다.");
        setSummaryInfo("요약 생성 실패");
        return;
      }
      setSummaryResult(json.summary);
      setSummaryInfo(json.summary.fallbackUsed ? "요약 생성 완료(코드 기반 요약)" : "요약 생성 완료");
    } catch {
      setErr("네트워크 오류로 Gemini 요약 생성에 실패했습니다.");
      setSummaryInfo("요약 생성 실패");
    } finally {
      setSummarizing(false);
    }
  }, [productId]);

  const enabledCount = useMemo(() => targets.filter((row) => row.enabled).length, [targets]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-green-200/80 bg-green-50/50 px-3 py-2 text-[11px] leading-relaxed text-green-950">
        경쟁상품 링크/상품번호를 등록해 두면, 다음 단계에서 수집기(가격/옵션/품절/리뷰)와 Gemini 요약 파이프라인에 바로 연결할 수
        있습니다.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          경쟁상품 추가
        </button>
        <button
          type="button"
          onClick={() => void runSync()}
          disabled={syncing}
          className="rounded-xl bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {syncing ? "점검 중…" : "링크 점검/복구"}
        </button>
        <button
          type="button"
          onClick={() => void runCollect()}
          disabled={collecting}
          className="rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {collecting ? "수집 중…" : "수집 실행"}
        </button>
        <button
          type="button"
          onClick={() => void runSummary()}
          disabled={summarizing}
          className="rounded-xl bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
        >
          {summarizing ? "요약 중…" : "Gemini 요약"}
        </button>
        {saveState === "error" ? (
          <button
            type="button"
            onClick={() => void saveNow(targets)}
            className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
          >
            저장 재시도
          </button>
        ) : null}
        <span className="text-[11px] text-zinc-600">
          전체 {targets.length}개 · 사용 {enabledCount}개
        </span>
      </div>
      {saveInfo ? <p className="text-[11px] text-zinc-600">{saveInfo}</p> : null}
      {collectInfo ? <p className="text-[11px] text-zinc-600">{collectInfo}</p> : null}
      {collectSummary ? (
        <p className="text-[11px] text-zinc-600">
          최근 집계: 성공 {collectSummary.recentSuccess}건 · 실패 {collectSummary.recentFailed}건
          {collectSummary.latestCollectedAt ? ` · 마지막 수집 ${collectSummary.latestCollectedAt}` : ""}
        </p>
      ) : null}
      {collectFailures.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-[11px] text-amber-950">
          <p className="font-semibold">실패 라벨/원인</p>
          <ul className="mt-1 space-y-1">
            {collectFailures.map((row, idx) => (
              <li key={`${row.label}-${idx}`}>
                {row.label} ({row.source}) · {row.errorMessage}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-amber-800">
            HTTP_429가 반복되면 플랫폼 차단 상태일 수 있어 잠시 후 다시 시도하거나 대상 수를 줄여 주세요.
          </p>
        </div>
      ) : null}
      {summaryInfo ? <p className="text-[11px] text-zinc-600">{summaryInfo}</p> : null}
      {summaryResult ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 text-xs text-violet-950">
          <p className="font-semibold">요약</p>
          <p className="mt-1 leading-relaxed">{summaryResult.llmSummary.summary}</p>
          <p className="mt-2 text-[11px] text-violet-800">
            사용 스냅샷 {summaryResult.usedSnapshots}건 · 성공률 {summaryResult.metrics.successRatePct}%
            {summaryResult.metrics.latestCollectedAt ? ` · 최근 ${summaryResult.metrics.latestCollectedAt}` : ""}
          </p>
          {summaryResult.llmSummary.strengths.length > 0 ? (
            <p className="mt-2">강점: {summaryResult.llmSummary.strengths.join(" / ")}</p>
          ) : null}
          {summaryResult.llmSummary.risks.length > 0 ? (
            <p className="mt-1">리스크: {summaryResult.llmSummary.risks.join(" / ")}</p>
          ) : null}
          {summaryResult.llmSummary.complaintKeywords.length > 0 ? (
            <p className="mt-1">불만 키워드: {summaryResult.llmSummary.complaintKeywords.join(", ")}</p>
          ) : null}
          {summaryResult.llmSummary.evidence.length > 0 ? (
            <p className="mt-1">근거: {summaryResult.llmSummary.evidence.join(" | ")}</p>
          ) : null}
        </div>
      ) : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {busy ? (
        <p className="text-[11px] text-zinc-500">불러오는 중…</p>
      ) : targets.length > 0 ? (
        <div className="space-y-2">
          {targets.map((row, idx) => (
            <div key={row.id} className="rounded-xl border border-zinc-200 bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-6">
                <label className="block text-[11px] font-medium text-zinc-700 sm:col-span-2">
                  라벨
                  <input
                    value={row.label}
                    onChange={(e) => upsertRow(row.id, { label: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs"
                    placeholder={`경쟁상품 ${idx + 1}`}
                  />
                </label>
                <label className="block text-[11px] font-medium text-zinc-700 sm:col-span-3">
                  상품 URL
                  <input
                    value={row.url}
                    onChange={(e) => upsertRow(row.id, { url: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs"
                    placeholder="https://.../products/12345"
                  />
                </label>
                <label className="block text-[11px] font-medium text-zinc-700">
                  상품번호(선택)
                  <input
                    value={row.productNo}
                    onChange={(e) => upsertRow(row.id, { productNo: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs"
                    placeholder="1234567890"
                  />
                </label>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-6">
                <label className="block text-[11px] font-medium text-zinc-700">
                  출처
                  <select
                    value={row.source}
                    onChange={(e) => upsertRow(row.id, { source: e.target.value as CompetitorSource })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs"
                  >
                    <option value="UNKNOWN">자동(미확정)</option>
                    <option value="NAVER">네이버</option>
                    <option value="COUPANG">쿠팡</option>
                    <option value="GMARKET">지마켓</option>
                    <option value="ELEVENST">11번가</option>
                  </select>
                </label>
                <label className="block text-[11px] font-medium text-zinc-700 sm:col-span-5">
                  정규 링크(자동)
                  <input
                    value={row.canonicalUrl}
                    readOnly
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-700"
                    placeholder="출처+상품번호로 자동 생성"
                  />
                </label>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => upsertRow(row.id, { enabled: e.target.checked })}
                    className="rounded border-zinc-300"
                  />
                  사용 대상 포함
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500">
                    자동 인식: {row.source} / {row.productNo || "번호없음"}
                  </span>
                  {row.needsManualReview ? (
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      수동 확인 필요
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => upsertRow(row.id, autoFillCompetitorTarget(row))}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50"
                  >
                    자동채움
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="rounded-lg border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-zinc-500">아직 등록된 경쟁상품이 없습니다. 「경쟁상품 추가」로 시작하세요.</p>
      )}
    </div>
  );
}

