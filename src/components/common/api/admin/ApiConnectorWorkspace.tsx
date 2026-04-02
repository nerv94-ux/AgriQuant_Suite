"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import type {
  EcoPriceSettingsOverview,
  EcountSettingsOverview,
  GeminiSettingsOverview,
  KmaSettingsOverview,
} from "@/components/common/api/server/admin/providerSettings";
import { toHealthLabel, toSetupLabel, toSetupStatus } from "./catalog";
import { EcountAdminCard } from "./EcountAdminCard";
import { EcoPriceAdminCard } from "./EcoPriceAdminCard";
import { GeminiAdminCard } from "./GeminiAdminCard";
import { KmaAdminCard } from "./KmaAdminCard";
import type { ApiConnectorSummary } from "./types";

type ApiConnectorWorkspaceProps = {
  connectors: ApiConnectorSummary[];
  geminiOverview: GeminiSettingsOverview;
  ecountOverview: EcountSettingsOverview;
  kmaOverview: KmaSettingsOverview;
  ecoPriceOverview: EcoPriceSettingsOverview;
  initialConnectorId?: string;
};

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

export function ApiConnectorWorkspace({
  connectors,
  geminiOverview,
  ecountOverview,
  kmaOverview,
  ecoPriceOverview,
  initialConnectorId,
}: ApiConnectorWorkspaceProps) {
  const pathname = usePathname() ?? "/admin/apis";
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const [geminiState, setGeminiState] = useState(geminiOverview);
  const [ecountState, setEcountState] = useState(ecountOverview);
  const [kmaState, setKmaState] = useState(kmaOverview);
  const [ecoPriceState, setEcoPriceState] = useState(ecoPriceOverview);
  const [connectorRows, setConnectorRows] = useState(connectors);
  const autoHealthStartedRef = useRef<Record<string, boolean>>({});
  const [recoveringConnectorId, setRecoveringConnectorId] = useState<string | null>(null);
  const [showDegradedDetail, setShowDegradedDetail] = useState(false);

  useEffect(() => {
    setGeminiState(geminiOverview);
    setEcountState(ecountOverview);
    setKmaState(kmaOverview);
    setEcoPriceState(ecoPriceOverview);
    setConnectorRows(connectors);
    autoHealthStartedRef.current = {};
  }, [connectors, ecoPriceOverview, ecountOverview, geminiOverview, kmaOverview]);

  const selectedId =
    safeSearchParams.get("connector") ?? initialConnectorId ?? connectorRows[0]?.id;
  const selectedConnector =
    connectorRows.find((connector) => connector.id === selectedId) ?? connectorRows[0] ?? null;

  const summary = useMemo(() => {
    const ready = connectorRows.filter((connector) => connector.setupStatus === "configured").length;
    const attention = connectorRows.filter((connector) => {
      if (connector.setupStatus !== "configured") {
        return true;
      }

      if (!connector.healthSupported) {
        return false;
      }

      return connector.healthStatus !== "healthy";
    }).length;

    return {
      total: connectorRows.length,
      ready,
      attention,
    };
  }, [connectorRows]);

  const selectedRecentLogs = useMemo(() => {
    if (!selectedConnector) return [];
    if (selectedConnector.id === "google-ai") return geminiState.recentLogs;
    if (selectedConnector.id === "ecount") return ecountState.recentLogs;
    if (selectedConnector.id === "kma-weather") return kmaState.recentLogs;
    if (selectedConnector.id === "eco-price") return ecoPriceState.recentLogs;
    return [];
  }, [ecoPriceState.recentLogs, ecountState.recentLogs, geminiState.recentLogs, kmaState.recentLogs, selectedConnector]);

  const selectedLastHealthyAt = useMemo(() => {
    const hit = selectedRecentLogs.find((log) => log.ok);
    return hit?.createdAt ?? null;
  }, [selectedRecentLogs]);
  const selectedRecentFailedLogs = useMemo(
    () => selectedRecentLogs.filter((log) => !log.ok).slice(0, 3),
    [selectedRecentLogs]
  );

  function selectConnector(id: string) {
    const params = new URLSearchParams(safeSearchParams.toString());
    params.set("connector", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setShowDegradedDetail(false);
  }

  const applyGeminiOverview = useCallback((overview: GeminiSettingsOverview) => {
    setGeminiState(overview);
    setConnectorRows((current) =>
      current.map((connector) => {
        if (connector.id !== "google-ai") {
          return connector;
        }

        const configuredKeys = overview.keyStatus.configured ? ["GEMINI_API_KEY"] : [];
        const setupStatus = toSetupStatus(connector.requiredKeys, configuredKeys);

        return {
          ...connector,
          configuredKeys,
          setupStatus,
          setupLabel: toSetupLabel(setupStatus),
          healthStatus: overview.health.status,
          healthLabel: toHealthLabel(overview.health.status),
          healthMessage: overview.health.message,
          lastCheckedAt: overview.health.lastCheckedAt,
          healthDurationMs: overview.health.durationMs,
          healthStale: overview.health.stale,
        };
      })
    );
  }, []);

  const applyEcountOverview = useCallback((overview: EcountSettingsOverview) => {
    setEcountState(overview);
    setConnectorRows((current) =>
      current.map((connector) => {
        if (connector.id !== "ecount") {
          return connector;
        }

        const configuredKeys = overview.keyStatus.configuredKeys;
        const setupStatus = toSetupStatus(connector.requiredKeys, configuredKeys);

        return {
          ...connector,
          configuredKeys,
          setupStatus,
          setupLabel: toSetupLabel(setupStatus),
          healthStatus: overview.health.status,
          healthLabel: toHealthLabel(overview.health.status),
          healthMessage: overview.health.message,
          lastCheckedAt: overview.health.lastCheckedAt,
          healthDurationMs: overview.health.durationMs,
          healthStale: overview.health.stale,
        };
      })
    );
  }, []);

  const applyKmaOverview = useCallback((overview: KmaSettingsOverview) => {
    setKmaState(overview);
    setConnectorRows((current) =>
      current.map((connector) => {
        if (connector.id !== "kma-weather") {
          return connector;
        }

        const configuredKeys = overview.keyStatus.configured ? ["KMA_SERVICE_KEY"] : [];
        const setupStatus = toSetupStatus(connector.requiredKeys, configuredKeys);

        return {
          ...connector,
          configuredKeys,
          setupStatus,
          setupLabel: toSetupLabel(setupStatus),
          healthStatus: overview.health.status,
          healthLabel: toHealthLabel(overview.health.status),
          healthMessage: overview.health.message,
          lastCheckedAt: overview.health.lastCheckedAt,
          healthDurationMs: overview.health.durationMs,
          healthStale: overview.health.stale,
        };
      })
    );
  }, []);

  const applyEcoPriceOverview = useCallback((overview: EcoPriceSettingsOverview) => {
    setEcoPriceState(overview);
    setConnectorRows((current) =>
      current.map((connector) => {
        if (connector.id !== "eco-price") {
          return connector;
        }

        const configuredKeys = overview.keyStatus.configured ? ["ECO_PRICE_SERVICE_KEY"] : [];
        const setupStatus = toSetupStatus(connector.requiredKeys, configuredKeys);

        return {
          ...connector,
          configuredKeys,
          setupStatus,
          setupLabel: toSetupLabel(setupStatus),
          healthStatus: overview.health.status,
          healthLabel: toHealthLabel(overview.health.status),
          healthMessage: overview.health.message,
          lastCheckedAt: overview.health.lastCheckedAt,
          healthDurationMs: overview.health.durationMs,
          healthStale: overview.health.stale,
        };
      })
    );
  }, []);

  const refreshGeminiOverview = useCallback(async () => {
    const res = await fetch("/api/admin/connectors/gemini/settings");
    const body = await readApiEnvelope<GeminiSettingsOverview>(res);

    if (!body.ok || !body.data) {
      throw new Error(body.message ?? "Gemini 상태를 불러오지 못했습니다.");
    }

    applyGeminiOverview(body.data);
    return body.data;
  }, [applyGeminiOverview]);

  const refreshEcountOverview = useCallback(async () => {
    const res = await fetch("/api/admin/connectors/ecount/settings");
    const body = await readApiEnvelope<EcountSettingsOverview>(res);

    if (!body.ok || !body.data) {
      throw new Error(body.message ?? "eCount 상태를 불러오지 못했습니다.");
    }

    applyEcountOverview(body.data);
    return body.data;
  }, [applyEcountOverview]);

  const refreshKmaOverview = useCallback(async () => {
    const res = await fetch("/api/admin/connectors/kma/settings");
    const body = await readApiEnvelope<KmaSettingsOverview>(res);

    if (!body.ok || !body.data) {
      throw new Error(body.message ?? "기상청 상태를 불러오지 못했습니다.");
    }

    applyKmaOverview(body.data);
    return body.data;
  }, [applyKmaOverview]);

  const refreshEcoPriceOverview = useCallback(async () => {
    const res = await fetch("/api/admin/connectors/eco-price/settings");
    const body = await readApiEnvelope<EcoPriceSettingsOverview>(res);

    if (!body.ok || !body.data) {
      throw new Error(body.message ?? "친환경 가격 API 상태를 불러오지 못했습니다.");
    }

    applyEcoPriceOverview(body.data);
    return body.data;
  }, [applyEcoPriceOverview]);

  const autoRunGeminiHealthCheck = useCallback(async () => {
    setConnectorRows((current) =>
      current.map((connector) =>
        connector.id === "google-ai"
          ? {
              ...connector,
              healthStatus: "checking",
              healthLabel: "확인 중",
              healthMessage: "관리자 화면 진입 시 자동으로 연결 상태를 확인하고 있습니다.",
            }
          : connector
      )
    );

    try {
      await fetch("/api/admin/connectors/gemini-health", { method: "POST" });
    } catch {
      setConnectorRows((current) =>
        current.map((connector) =>
          connector.id === "google-ai"
            ? {
                ...connector,
                healthStatus: "unhealthy",
                healthLabel: "작동 실패",
                healthMessage: "자동 연결 확인 중 네트워크 또는 서버 오류가 발생했습니다.",
              }
            : connector
        )
      );
    } finally {
      try {
        await refreshGeminiOverview();
      } catch {
        // 최신 오버뷰 재동기화에 실패해도 자동 확인 UI는 유지한다.
      }
    }
  }, [refreshGeminiOverview]);

  const autoRunEcountHealthCheck = useCallback(async () => {
    setConnectorRows((current) =>
      current.map((connector) =>
        connector.id === "ecount"
          ? {
              ...connector,
              healthStatus: "checking",
              healthLabel: "확인 중",
              healthMessage: "관리자 화면 진입 시 자동으로 eCount 연결 상태를 확인하고 있습니다.",
            }
          : connector
      )
    );

    try {
      await fetch("/api/admin/connectors/ecount-health", { method: "POST" });
    } catch {
      setConnectorRows((current) =>
        current.map((connector) =>
          connector.id === "ecount"
            ? {
                ...connector,
                healthStatus: "unhealthy",
                healthLabel: "작동 실패",
                healthMessage: "자동 연결 확인 중 네트워크 또는 서버 오류가 발생했습니다.",
              }
            : connector
        )
      );
    } finally {
      try {
        await refreshEcountOverview();
      } catch {
        // 최신 오버뷰 재동기화에 실패해도 자동 확인 UI는 유지한다.
      }
    }
  }, [refreshEcountOverview]);

  const autoRunKmaHealthCheck = useCallback(async () => {
    setConnectorRows((current) =>
      current.map((connector) =>
        connector.id === "kma-weather"
          ? {
              ...connector,
              healthStatus: "checking",
              healthLabel: "확인 중",
              healthMessage: "관리자 화면 진입 시 자동으로 기상청 연결 상태를 확인하고 있습니다.",
            }
          : connector
      )
    );

    try {
      await fetch("/api/admin/connectors/kma-health", { method: "POST" });
    } catch {
      setConnectorRows((current) =>
        current.map((connector) =>
          connector.id === "kma-weather"
            ? {
                ...connector,
                healthStatus: "unhealthy",
                healthLabel: "작동 실패",
                healthMessage: "자동 연결 확인 중 네트워크 또는 서버 오류가 발생했습니다.",
              }
            : connector
        )
      );
    } finally {
      try {
        await refreshKmaOverview();
      } catch {
        // 최신 오버뷰 재동기화에 실패해도 자동 확인 UI는 유지한다.
      }
    }
  }, [refreshKmaOverview]);

  const autoRunEcoPriceHealthCheck = useCallback(async () => {
    setConnectorRows((current) =>
      current.map((connector) =>
        connector.id === "eco-price"
          ? {
              ...connector,
              healthStatus: "checking",
              healthLabel: "확인 중",
              healthMessage:
                "관리자 화면 진입 시 자동으로 친환경 농산물 가격 API 연결 상태를 확인하고 있습니다.",
            }
          : connector
      )
    );

    try {
      await fetch("/api/admin/connectors/eco-price-health", { method: "POST" });
    } catch {
      setConnectorRows((current) =>
        current.map((connector) =>
          connector.id === "eco-price"
            ? {
                ...connector,
                healthStatus: "unhealthy",
                healthLabel: "작동 실패",
                healthMessage: "자동 연결 확인 중 네트워크 또는 서버 오류가 발생했습니다.",
              }
            : connector
        )
      );
    } finally {
      try {
        await refreshEcoPriceOverview();
      } catch {
        // 최신 오버뷰 재동기화에 실패해도 자동 확인 UI는 유지한다.
      }
    }
  }, [refreshEcoPriceOverview]);

  const runConnectorRecovery = useCallback(
    async (connectorId: string) => {
      const endpointMap: Record<string, string> = {
        "google-ai": "/api/admin/connectors/gemini-health",
        ecount: "/api/admin/connectors/ecount-health?force=1",
        "kma-weather": "/api/admin/connectors/kma-health",
        "eco-price": "/api/admin/connectors/eco-price-health",
      };
      const endpoint = endpointMap[connectorId];
      if (!endpoint) return;

      setRecoveringConnectorId(connectorId);
      try {
        for (let i = 0; i < 3; i += 1) {
          try {
            await fetch(endpoint, { method: "POST" });
          } catch {
            // retry by backoff
          }
          if (i < 2) {
            await new Promise((resolve) => setTimeout(resolve, 700 * (i + 1)));
          }
        }
        if (connectorId === "google-ai") await refreshGeminiOverview();
        if (connectorId === "ecount") await refreshEcountOverview();
        if (connectorId === "kma-weather") await refreshKmaOverview();
        if (connectorId === "eco-price") await refreshEcoPriceOverview();
      } finally {
        setRecoveringConnectorId(null);
      }
    },
    [refreshEcoPriceOverview, refreshEcountOverview, refreshGeminiOverview, refreshKmaOverview]
  );

  useEffect(() => {
    const geminiConnector = connectorRows.find((connector) => connector.id === "google-ai");

    if (!geminiConnector || autoHealthStartedRef.current["google-ai"]) {
      return;
    }

    if (geminiConnector.setupStatus !== "configured" || !geminiConnector.healthSupported) {
      return;
    }

    if (!geminiConnector.healthStale && geminiConnector.healthStatus !== "unknown") {
      return;
    }

    autoHealthStartedRef.current["google-ai"] = true;
    void autoRunGeminiHealthCheck();
  }, [autoRunGeminiHealthCheck, connectorRows]);

  useEffect(() => {
    const ecountConnector = connectorRows.find((connector) => connector.id === "ecount");

    if (!ecountConnector || autoHealthStartedRef.current["ecount"]) {
      return;
    }

    if (ecountConnector.setupStatus !== "configured" || !ecountConnector.healthSupported) {
      return;
    }

    if (!ecountConnector.healthStale && ecountConnector.healthStatus !== "unknown") {
      return;
    }

    autoHealthStartedRef.current["ecount"] = true;
    void autoRunEcountHealthCheck();
  }, [autoRunEcountHealthCheck, connectorRows]);

  useEffect(() => {
    const kmaConnector = connectorRows.find((connector) => connector.id === "kma-weather");

    if (!kmaConnector || autoHealthStartedRef.current["kma-weather"]) {
      return;
    }

    if (kmaConnector.setupStatus !== "configured" || !kmaConnector.healthSupported) {
      return;
    }

    if (!kmaConnector.healthStale && kmaConnector.healthStatus !== "unknown") {
      return;
    }

    autoHealthStartedRef.current["kma-weather"] = true;
    void autoRunKmaHealthCheck();
  }, [autoRunKmaHealthCheck, connectorRows]);

  useEffect(() => {
    const ecoPriceConnector = connectorRows.find((connector) => connector.id === "eco-price");

    if (!ecoPriceConnector || autoHealthStartedRef.current["eco-price"]) {
      return;
    }

    if (ecoPriceConnector.setupStatus !== "configured" || !ecoPriceConnector.healthSupported) {
      return;
    }

    if (!ecoPriceConnector.healthStale && ecoPriceConnector.healthStatus !== "unknown") {
      return;
    }

    autoHealthStartedRef.current["eco-price"] = true;
    void autoRunEcoPriceHealthCheck();
  }, [autoRunEcoPriceHealthCheck, connectorRows]);

  return (
    <section>
      <motion.div
        className="mb-7"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              API Module
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">커넥터 워크스페이스</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">
              공용 API를 리스트와 상세 패널 구조로 관리합니다. 현재는 Gemini 운영 기능을 유지하고,
              앞으로는 프로그램별 API 사용 정책까지 같은 워크스페이스에서 확장할 수 있게 정리합니다.
            </p>
          </div>
          </div>
          <div className="grid min-w-[320px] gap-3 sm:grid-cols-3 xl:col-span-4">
            <MetricCard label="연결 수" value={`${summary.total}`} />
            <MetricCard label="준비 완료" value={`${summary.ready}`} tone="emerald" />
            <MetricCard label="주의 필요" value={`${summary.attention}`} tone="amber" />
          </div>
        </div>
      </motion.div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[28px] border border-white/10 bg-zinc-900/60 p-3 backdrop-blur-xl">
          <div className="border-b border-white/10 px-3 pb-3">
            <p className="text-sm font-semibold text-white">커넥터 목록</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              준비 상태와 실제 작동 상태를 함께 표시합니다.
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {connectorRows.map((connector) => {
              const active = selectedConnector?.id === connector.id;
              return (
                <button
                  key={connector.id}
                  type="button"
                  onClick={() => selectConnector(connector.id)}
                  className={[
                    "w-full rounded-2xl border p-4 text-left transition",
                    active
                      ? "border-white/15 bg-white/10 shadow-[0_18px_40px_-28px_rgba(255,255,255,0.45)]"
                      : "border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{connector.name}</p>
                      <p className="mt-1 text-xs text-zinc-400">{connector.category}</p>
                    </div>
                    <StateDot status={connector.healthStatus} />
                  </div>

                  <p className="mt-3 truncate text-sm text-zinc-300" title={connector.description}>
                    {connector.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge kind="setup" status={connector.setupStatus} label={connector.setupLabel} />
                    <HealthBadge status={connector.healthStatus} label={connector.healthLabel} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {connector.requiredKeys.map((key) => {
                      const configured = connector.configuredKeys.includes(key);
                      return (
                        <span
                          key={key}
                          className={[
                            "rounded-lg border px-2 py-1 text-[11px]",
                            configured
                              ? "border-emerald-300/20 bg-emerald-500/15 text-emerald-100"
                              : "border-zinc-700 bg-zinc-950/70 text-zinc-400",
                          ].join(" ")}
                        >
                          {key}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                    <span>{connector.healthSupported ? "자동 확인 사용" : "자동 확인 준비 중"}</span>
                    <span>
                      {connector.lastCheckedAt
                        ? `마지막 확인 ${formatCompactDateTime(connector.lastCheckedAt)}`
                        : "확인 기록 없음"}
                    </span>
                    {connector.healthDurationMs ? <span>{connector.healthDurationMs}ms</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedConnector ? (
          <div className="rounded-[28px] border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl">
            <div className="border-b border-white/10 pb-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Detail Panel
                  </p>
                  <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-white">
                    {selectedConnector.name}
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">
                    {selectedConnector.description}
                  </p>
                </div>

              <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    kind="setup"
                    status={selectedConnector.setupStatus}
                    label={selectedConnector.setupLabel}
                  />
                  <HealthBadge status={selectedConnector.healthStatus} label={selectedConnector.healthLabel} />
                  {selectedConnector.healthStatus === "unhealthy" ? (
                    <span className="rounded-full border border-amber-300/20 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-100">
                      Degraded
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <InfoCard
                  label="설정 상태"
                  value={selectedConnector.setupLabel}
                  description={
                    selectedConnector.setupStatus === "configured"
                      ? "필수 자격증명 준비됨"
                      : "필수 키 확인 필요"
                  }
                />
                <InfoCard
                  label="작동 상태"
                  value={selectedConnector.healthLabel}
                  description={toHealthDescription(selectedConnector)}
                  tone={selectedConnector.healthStatus}
                />
                <InfoCard
                  label="마지막 확인"
                  value={
                    selectedConnector.lastCheckedAt
                      ? formatDateTime(selectedConnector.lastCheckedAt)
                      : "기록 없음"
                  }
                  description={
                    selectedConnector.healthDurationMs
                      ? `응답 시간 ${selectedConnector.healthDurationMs}ms`
                      : "최근 확인값 없음"
                  }
                />
              </div>

              <p className="mt-4 text-sm text-zinc-400">{selectedConnector.healthMessage}</p>
              {selectedConnector.healthStatus === "unhealthy" ? (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                  <p className="text-sm font-semibold text-amber-100">장애 대응 모드</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-50/90">
                    최근 연결 실패로 Degraded 상태입니다. 마지막 성공 시각을 유지하며 복구 시도를 실행할 수 있습니다.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                    <span>
                      마지막 성공: {selectedLastHealthyAt ? formatDateTime(selectedLastHealthyAt) : "기록 없음"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runConnectorRecovery(selectedConnector.id)}
                    disabled={recoveringConnectorId === selectedConnector.id}
                    className="mt-3 h-9 rounded-xl border border-amber-200/30 bg-amber-500/20 px-3 text-xs font-semibold text-amber-100 disabled:opacity-60"
                  >
                    {recoveringConnectorId === selectedConnector.id ? "복구 시도 중..." : "복구 재시도 (최대 3회)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDegradedDetail((current) => !current)}
                    className="mt-2 h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-[11px] font-semibold text-zinc-200"
                  >
                    {showDegradedDetail ? "상세 닫기" : "오류 상세 보기"}
                  </button>
                  {showDegradedDetail ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] text-zinc-300 break-all">
                        현재 메시지: {selectedConnector.healthMessage}
                      </p>
                      <div className="space-y-2">
                        {selectedRecentFailedLogs.map((log) => (
                          <div key={log.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                            <p className="text-[10px] text-zinc-500">
                              {new Date(log.createdAt).toLocaleString()}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-zinc-300 break-all">
                              {log.message ?? "메시지 없음"}
                            </p>
                          </div>
                        ))}
                        {selectedRecentFailedLogs.length === 0 ? (
                          <p className="text-[11px] text-zinc-500">실패 상세 로그가 없습니다.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                {selectedConnector.id === "google-ai" ? (
                  <GeminiAdminCard
                    initialOverview={geminiState}
                    className="rounded-[28px] border border-white/10 bg-black/20 p-5"
                    onOverviewChange={applyGeminiOverview}
                  />
                ) : selectedConnector.id === "ecount" ? (
                  <EcountAdminCard
                    initialOverview={ecountState}
                    className="rounded-[28px] border border-white/10 bg-black/20 p-5"
                    onOverviewChange={applyEcountOverview}
                  />
                ) : selectedConnector.id === "kma-weather" ? (
                  <KmaAdminCard
                    initialOverview={kmaState}
                    className="rounded-[28px] border border-white/10 bg-black/20 p-5"
                    onOverviewChange={applyKmaOverview}
                  />
                ) : selectedConnector.id === "eco-price" ? (
                  <EcoPriceAdminCard
                    initialOverview={ecoPriceState}
                    className="rounded-[28px] border border-white/10 bg-black/20 p-5"
                    onOverviewChange={applyEcoPriceOverview}
                  />
                ) : (
                  <ConnectorPlaceholderDetail connector={selectedConnector} />
                )}
              </div>

              <aside className="space-y-4">
                <SidePanelCard title="운영 적용 범위">
                  <p className="text-sm leading-relaxed text-zinc-300">{selectedConnector.usageScope}</p>
                </SidePanelCard>
                <SidePanelCard title="필수 키">
                  <div className="flex flex-wrap gap-2">
                    {selectedConnector.requiredKeys.map((key) => {
                      const configured = selectedConnector.configuredKeys.includes(key);
                      return (
                        <span
                          key={key}
                          className={[
                            "rounded-xl border px-2.5 py-1.5 text-xs break-all",
                            configured
                              ? "border-emerald-300/20 bg-emerald-500/15 text-emerald-100"
                              : "border-zinc-700 bg-zinc-950/90 text-zinc-400",
                          ].join(" ")}
                        >
                          {key}
                        </span>
                      );
                    })}
                  </div>
                </SidePanelCard>

                <SidePanelCard title="프로그램 연결 정책">
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {selectedConnector.bindingMode === "shared-default"
                      ? "현재는 공용 기본 커넥터로 운영하며, 프로그램별 정책 계층을 상단에 추가할 수 있게 설계합니다."
                      : "프로그램별로 어떤 API를 사용할지 선택 가능한 구조를 전제로 세부 정책을 확장합니다."}
                  </p>
                </SidePanelCard>

                <SidePanelCard title="다음 단계">
                  <p className="text-sm leading-relaxed text-zinc-300">{selectedConnector.nextStep}</p>
                </SidePanelCard>

                {selectedConnector.healthSupported ? (
                  <SidePanelCard title="자동 확인 정책">
                    <p className="text-sm leading-relaxed text-zinc-300">
                      API 설정 화면 진입 시 최근 상태가 오래되었으면 자동으로 연결 확인을 다시 수행합니다.
                    </p>
                  </SidePanelCard>
                ) : null}
                <SidePanelCard title="최근 로그">
                  <div className="space-y-2">
                    {selectedRecentLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-zinc-300">{new Date(log.createdAt).toLocaleString()}</span>
                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              log.ok
                                ? "border-emerald-300/20 bg-emerald-500/15 text-emerald-100"
                                : "border-rose-300/20 bg-rose-500/15 text-rose-100",
                            ].join(" ")}
                          >
                            {log.ok ? "OK" : "FAIL"}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{log.message ?? "로그 메시지 없음"}</p>
                      </div>
                    ))}
                    {selectedRecentLogs.length === 0 ? (
                      <p className="text-xs text-zinc-500">표시할 로그가 없습니다.</p>
                    ) : null}
                  </div>
                </SidePanelCard>
              </aside>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone = "zinc",
}: {
  label: string;
  value: string;
  tone?: "zinc" | "emerald" | "amber";
}) {
  const toneClassName =
    tone === "emerald"
      ? "border-emerald-300/20 bg-emerald-500/10"
      : tone === "amber"
        ? "border-amber-300/20 bg-amber-500/10"
        : "border-white/10 bg-white/5";

  return (
    <div className={`rounded-2xl border p-4 ${toneClassName}`}>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusBadge({
  kind,
  status,
  label,
}: {
  kind: "setup";
  status: ApiConnectorSummary["setupStatus"];
  label: string;
}) {
  const className =
    status === "configured"
      ? "border-emerald-300/20 bg-emerald-500/15 text-emerald-100"
      : status === "partial"
        ? "border-amber-300/20 bg-amber-500/15 text-amber-100"
        : "border-zinc-600 bg-zinc-800/80 text-zinc-300";

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{kind === "setup" ? `준비 ${label}` : label}</span>;
}

function SidePanelCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function HealthBadge({
  status,
  label,
}: {
  status: ApiConnectorSummary["healthStatus"];
  label: string;
}) {
  const className =
    status === "healthy"
      ? "border-emerald-300/20 bg-emerald-500/15 text-emerald-100"
      : status === "unhealthy"
        ? "border-rose-300/20 bg-rose-500/15 text-rose-100"
        : status === "checking"
          ? "border-amber-300/20 bg-amber-500/15 text-amber-100"
          : "border-white/10 bg-white/5 text-zinc-300";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      작동 {label}
    </span>
  );
}

function StateDot({ status }: { status: ApiConnectorSummary["healthStatus"] }) {
  const className =
    status === "healthy"
      ? "bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.14)]"
      : status === "unhealthy"
        ? "bg-rose-400 shadow-[0_0_0_6px_rgba(251,113,133,0.14)]"
        : status === "checking"
          ? "bg-amber-400 shadow-[0_0_0_6px_rgba(251,191,36,0.14)]"
          : "bg-zinc-500 shadow-[0_0_0_6px_rgba(113,113,122,0.12)]";

  return <span className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${className}`} />;
}

function InfoCard({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: string;
  description: string;
  tone?: ApiConnectorSummary["healthStatus"] | "default";
}) {
  const toneClassName =
    tone === "healthy"
      ? "border-emerald-300/20 bg-emerald-500/10"
      : tone === "unhealthy"
        ? "border-rose-300/20 bg-rose-500/10"
        : tone === "checking"
          ? "border-amber-300/20 bg-amber-500/10"
          : "border-white/10 bg-white/[0.03]";

  return (
    <div className={`rounded-2xl border p-4 ${toneClassName}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{description}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatCompactDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toHealthDescription(connector: ApiConnectorSummary) {
  if (connector.healthStatus === "healthy") {
    return "최근 자동 확인 성공";
  }

  if (connector.healthStatus === "unhealthy") {
    return "최근 자동 확인 실패";
  }

  if (connector.healthStatus === "checking") {
    return "자동 확인 진행 중";
  }

  if (connector.healthStatus === "unsupported") {
    return "자동 확인 미지원";
  }

  return "아직 자동 확인 안 됨";
}

function ConnectorPlaceholderDetail({ connector }: { connector: ApiConnectorSummary }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/10 bg-black/20 p-6">
      <p className="text-sm font-semibold text-white">모듈 준비 영역</p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300">{connector.nextStep}</p>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Future Shape
        </p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          비밀키 저장, 프로그램별 활성화 범위, 연결 테스트, 감사 로그를 같은 상세 패널 패턴으로
          붙일 수 있도록 자리를 확보해 둔 상태입니다.
        </p>
      </div>
    </div>
  );
}
