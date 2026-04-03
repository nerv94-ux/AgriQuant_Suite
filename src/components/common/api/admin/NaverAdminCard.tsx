"use client";

import { useEffect, useMemo, useState } from "react";
import type { NaverSettingsOverview } from "@/components/common/api/server/admin/providerSettings";
import type {
  NaverDatalabSearchTrendResponseData,
  NaverDatalabShoppingInsightResponseData,
  NaverSearchResponseData,
} from "@/components/common/api/server/connectors/naver";

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

type RequestState = "idle" | "loading" | "done" | "error";
type SaveState = "idle" | "saving" | "done" | "error";

export function NaverAdminCard({
  initialOverview,
  className,
  onOverviewChange,
}: {
  initialOverview: NaverSettingsOverview;
  className?: string;
  onOverviewChange?: (overview: NaverSettingsOverview) => void;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [searchQuery, setSearchQuery] = useState("농산물");
  const [searchState, setSearchState] = useState<RequestState>("idle");
  const [trendState, setTrendState] = useState<RequestState>("idle");
  const [shoppingState, setShoppingState] = useState<RequestState>("idle");
  const [healthState, setHealthState] = useState<RequestState>("idle");
  const [saveSecretState, setSaveSecretState] = useState<SaveState>("idle");
  const [clientIdInput, setClientIdInput] = useState("");
  const [clientSecretInput, setClientSecretInput] = useState("");
  const [notice, setNotice] = useState("");
  const [searchResult, setSearchResult] = useState<NaverSearchResponseData | null>(null);
  const [trendResult, setTrendResult] = useState<NaverDatalabSearchTrendResponseData | null>(null);
  const [shoppingResult, setShoppingResult] = useState<NaverDatalabShoppingInsightResponseData | null>(null);

  useEffect(() => {
    setOverview(initialOverview);
  }, [initialOverview]);

  const runtimeLabel = useMemo(() => {
    if (overview.health.status === "healthy") return "정상 작동";
    if (overview.health.status === "unhealthy") return "작동 실패";
    return "미확인";
  }, [overview.health.status]);

  async function loadOverview() {
    const res = await fetch("/api/admin/connectors/naver/settings");
    const body = await readApiEnvelope<NaverSettingsOverview>(res);
    if (!body.ok || !body.data) {
      throw new Error(body.message ?? "네이버 API 설정을 불러오지 못했습니다.");
    }
    setOverview(body.data);
    onOverviewChange?.(body.data);
    return body.data;
  }

  async function runSearch() {
    setSearchState("loading");
    setNotice("");
    try {
      const res = await fetch("/api/admin/connectors/naver/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      const body = await readApiEnvelope<NaverSearchResponseData>(res);
      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "네이버 검색 호출에 실패했습니다.");
      }
      setSearchResult(body.data);
      setSearchState("done");
      setNotice(`검색 성공: 총 ${body.data.total.toLocaleString()}건`);
    } catch (error) {
      setSearchState("error");
      setNotice(error instanceof Error ? error.message : "네이버 검색 호출에 실패했습니다.");
    } finally {
      await loadOverview().catch(() => null);
    }
  }

  async function saveSecret() {
    if (!clientIdInput.trim() || !clientSecretInput.trim()) {
      setSaveSecretState("error");
      setNotice("Client ID와 Client Secret을 모두 입력해 주세요.");
      return;
    }

    setSaveSecretState("saving");
    setNotice("");
    try {
      const res = await fetch("/api/admin/connectors/naver/secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientIdInput,
          clientSecret: clientSecretInput,
        }),
      });
      const body = await readApiEnvelope<NaverSettingsOverview>(res);
      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "네이버 키 저장에 실패했습니다.");
      }
      setOverview(body.data);
      onOverviewChange?.(body.data);
      setClientIdInput("");
      setClientSecretInput("");
      setSaveSecretState("done");
      setNotice("네이버 키를 안전하게 저장했습니다.");
    } catch (error) {
      setSaveSecretState("error");
      setNotice(error instanceof Error ? error.message : "네이버 키 저장에 실패했습니다.");
    }
  }

  async function runHealthCheck() {
    setHealthState("loading");
    setNotice("");
    try {
      const res = await fetch("/api/admin/connectors/naver-health", { method: "POST" });
      const body = await readApiEnvelope<{
        searchTotal: number;
        trendSeriesCount: number;
        shoppingSeriesCount: number;
      }>(res);
      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "네이버 연결 확인에 실패했습니다.");
      }
      setHealthState("done");
      setNotice(
        `연결 확인 성공 (검색 ${body.data.searchTotal.toLocaleString()}건, 트렌드 ${body.data.trendSeriesCount}개, 쇼핑 ${body.data.shoppingSeriesCount}개)`
      );
    } catch (error) {
      setHealthState("error");
      setNotice(error instanceof Error ? error.message : "네이버 연결 확인에 실패했습니다.");
    } finally {
      await loadOverview().catch(() => null);
    }
  }

  async function runTrend() {
    setTrendState("loading");
    setNotice("");
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const toYmd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/admin/connectors/naver/datalab/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: toYmd(start),
          endDate: toYmd(end),
          timeUnit: "week",
          keywordGroups: [{ groupName: searchQuery || "농산물", keywords: [searchQuery || "농산물"] }],
        }),
      });
      const body = await readApiEnvelope<NaverDatalabSearchTrendResponseData>(res);
      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "검색어트렌드 호출에 실패했습니다.");
      }
      setTrendResult(body.data);
      setTrendState("done");
      setNotice(`검색어트렌드 성공: 시리즈 ${body.data.results.length}개`);
    } catch (error) {
      setTrendState("error");
      setNotice(error instanceof Error ? error.message : "검색어트렌드 호출에 실패했습니다.");
    } finally {
      await loadOverview().catch(() => null);
    }
  }

  async function runShoppingInsight() {
    setShoppingState("loading");
    setNotice("");
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const toYmd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/admin/connectors/naver/datalab/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: toYmd(start),
          endDate: toYmd(end),
          timeUnit: "week",
          category: [{ name: "식품", param: ["50000006"] }],
        }),
      });
      const body = await readApiEnvelope<NaverDatalabShoppingInsightResponseData>(res);
      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "쇼핑인사이트 호출에 실패했습니다.");
      }
      setShoppingResult(body.data);
      setShoppingState("done");
      setNotice(`쇼핑인사이트 성공: 시리즈 ${body.data.results.length}개`);
    } catch (error) {
      setShoppingState("error");
      setNotice(error instanceof Error ? error.message : "쇼핑인사이트 호출에 실패했습니다.");
    } finally {
      await loadOverview().catch(() => null);
    }
  }

  return (
    <div className={className ?? "rounded-3xl border border-white/10 bg-black/20 p-5"}>
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">네이버 API 연결 상태</p>
              <p className="mt-1 text-xs text-zinc-400">검색/데이터랩(검색어트렌드·쇼핑인사이트) 비로그인 방식</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200">
              {runtimeLabel}
            </span>
          </div>
          <p className="mt-3 text-xs text-zinc-300">
            마지막 확인: {overview.health.lastCheckedAt ? new Date(overview.health.lastCheckedAt).toLocaleString() : "기록 없음"}
          </p>
          <p className="mt-2 text-xs text-zinc-400">키 소스: {overview.keyStatus.source}</p>
          <p className="mt-2 text-xs text-zinc-400">Client ID: {overview.keyStatus.maskedClientId ?? "미설정"}</p>
          <p className="mt-1 text-xs text-zinc-400">Client Secret: {overview.keyStatus.maskedClientSecret ?? "미설정"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runHealthCheck()}
              disabled={healthState === "loading"}
              className="h-9 rounded-xl border border-emerald-300/20 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-100 disabled:opacity-60"
            >
              {healthState === "loading" ? "확인 중..." : "연결 확인"}
            </button>
            <button
              type="button"
              onClick={() => {
                void loadOverview();
              }}
              className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-zinc-200"
            >
              상태 새로고침
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">인증 키</p>
          <p className="mt-1 text-xs text-zinc-400">다른 커넥터와 동일하게 암호화 저장됩니다.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input
              type="text"
              value={clientIdInput}
              onChange={(event) => setClientIdInput(event.target.value)}
              placeholder="NAVER_CLIENT_ID 입력"
              className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <input
              type="password"
              value={clientSecretInput}
              onChange={(event) => setClientSecretInput(event.target.value)}
              placeholder="NAVER_CLIENT_SECRET 입력"
              className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => void saveSecret()}
              disabled={saveSecretState === "saving"}
              className="h-10 rounded-xl bg-white px-3 text-xs font-semibold text-black disabled:opacity-60"
            >
              {saveSecretState === "saving" ? "저장 중..." : "키 저장"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">실행 테스트</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="검색어 (예: 농산물)"
              className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={searchState === "loading"}
              className="h-10 rounded-xl border border-emerald-300/20 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-100 disabled:opacity-60"
            >
              {searchState === "loading" ? "검색 중..." : "검색"}
            </button>
            <button
              type="button"
              onClick={() => void runTrend()}
              disabled={trendState === "loading"}
              className="h-10 rounded-xl border border-sky-300/20 bg-sky-500/15 px-3 text-xs font-semibold text-sky-100 disabled:opacity-60"
            >
              {trendState === "loading" ? "호출 중..." : "트렌드"}
            </button>
            <button
              type="button"
              onClick={() => void runShoppingInsight()}
              disabled={shoppingState === "loading"}
              className="h-10 rounded-xl border border-violet-300/20 bg-violet-500/15 px-3 text-xs font-semibold text-violet-100 disabled:opacity-60"
            >
              {shoppingState === "loading" ? "호출 중..." : "쇼핑인사이트"}
            </button>
          </div>
          {notice ? <p className="mt-3 text-xs text-zinc-300">{notice}</p> : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">최근 테스트 결과</p>
          <div className="mt-3 grid gap-2 text-xs text-zinc-300">
            <p>검색: {searchResult ? `${searchResult.total.toLocaleString()}건` : "-"}</p>
            <p>검색어트렌드: {trendResult ? `${trendResult.results.length}개 시리즈` : "-"}</p>
            <p>쇼핑인사이트: {shoppingResult ? `${shoppingResult.results.length}개 시리즈` : "-"}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
