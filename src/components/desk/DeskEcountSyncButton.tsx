"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/** 이카운트 API + DB 반영 합쳐서 길어질 수 있음 (ms) — 초과 시 요청 중단 */
const FETCH_MS = 660_000;
const FETCH_MINUTES = Math.round(FETCH_MS / 60_000);

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

export default function DeskEcountSyncButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const syncStartedAtRef = useRef<number | null>(null);
  const refreshStartedAtRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!pending && !isRefreshing) return;
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [pending, isRefreshing]);

  const syncElapsedSec =
    pending && syncStartedAtRef.current != null
      ? Math.max(0, Math.floor((Date.now() - syncStartedAtRef.current) / 1000))
      : 0;

  const refreshElapsedSec =
    !pending && isRefreshing && refreshStartedAtRef.current != null
      ? Math.max(0, Math.floor((Date.now() - refreshStartedAtRef.current) / 1000))
      : 0;

  async function onSync() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const timer = window.setTimeout(() => ac.abort(), FETCH_MS);

    syncStartedAtRef.current = Date.now();
    refreshStartedAtRef.current = null;
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/desk/ecount/sync", { method: "POST", signal: ac.signal });
      let data: { ok?: boolean; message?: string; upserted?: number };
      try {
        data = (await res.json()) as { ok?: boolean; message?: string; upserted?: number };
      } catch {
        setError(`서버 응답을 읽지 못했습니다. (HTTP ${res.status})`);
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.message ?? "동기화에 실패했습니다.");
        return;
      }

      const syncSeconds =
        syncStartedAtRef.current != null
          ? Math.max(0, Math.round((Date.now() - syncStartedAtRef.current) / 1000))
          : 0;
      const upserted = typeof data.upserted === "number" ? data.upserted : null;
      const base = data.message ?? "반영했습니다.";
      setMessage(
        upserted != null
          ? `${base} (이카운트·DB 반영 ${formatElapsed(syncSeconds)} · ${upserted}건)`
          : `${base} (이카운트·DB 반영 ${formatElapsed(syncSeconds)})`,
      );

      refreshStartedAtRef.current = Date.now();
      startRefresh(() => {
        router.refresh();
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError(
          `요청이 ${FETCH_MINUTES}분 안에 끝나지 않아 중단되었습니다. 품목이 많으면 시간이 더 걸릴 수 있으니, 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.`,
        );
        return;
      }
      setError(e instanceof Error ? `요청 실패: ${e.message}` : "요청을 보내지 못했습니다.");
    } finally {
      window.clearTimeout(timer);
      setPending(false);
      abortRef.current = null;
    }
  }

  const statusId = "desk-ecount-sync-status";

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <p className="text-right text-[11px] leading-snug text-zinc-500">
        최대 대기 약 {FETCH_MINUTES}분(자동 중단). 진행 중에는 아래 경과 시간이 올라갑니다.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => void onSync()}
        aria-busy={pending}
        aria-describedby={statusId}
        className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-500 active:scale-[0.98] active:brightness-95 disabled:cursor-wait disabled:opacity-90 disabled:active:scale-100 sm:w-auto"
      >
        {pending ? (
          <>
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
            <span>① 이카운트·DB 반영 중… {formatElapsed(syncElapsedSec)} 경과</span>
          </>
        ) : (
          "이카운트에서 품목 불러오기"
        )}
      </button>

      <div
        id={statusId}
        role="status"
        aria-live="polite"
        className="min-h-[2.75rem] space-y-1 text-right text-xs leading-snug"
      >
        {!pending && isRefreshing ? (
          <p className="font-medium text-sky-800">
            ② 목록 화면에 반영 중… {formatElapsed(refreshElapsedSec)} 경과
          </p>
        ) : null}
        {!pending && !isRefreshing && message ? (
          <p className="font-medium text-emerald-900">✓ 완료 · {message}</p>
        ) : null}
        {!pending && !isRefreshing && error ? <p className="font-medium text-red-700">{error}</p> : null}
        {pending ? (
          <p className="text-zinc-600">
            이카운트 서버에서 품목을 받아 오고, 이 PC의 DB에 저장하는 단계입니다. 끝나면
            「완료」로 바뀝니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}
