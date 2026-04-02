"use client";

import { useEffect, useMemo, useState } from "react";
import type { GeminiSettingsOverview } from "@/components/common/api/server/admin/providerSettings";

type SaveState = "idle" | "saving" | "done" | "error";
type HealthState = "idle" | "loading" | "ok" | "error";

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

  const text = await res.text();
  throw new Error(
    text.startsWith("<!DOCTYPE")
      ? "서버가 JSON 대신 HTML 응답을 반환했습니다. 관리자 인증 또는 서버 오류를 확인해 주세요."
      : text || "서버 응답을 해석하지 못했습니다."
  );
}

export function GeminiAdminCard({
  initialOverview,
  className,
  onOverviewChange,
}: {
  initialOverview: GeminiSettingsOverview;
  className?: string;
  onOverviewChange?: (overview: GeminiSettingsOverview) => void;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saveSecretState, setSaveSecretState] = useState<SaveState>("idle");
  const [saveConfigState, setSaveConfigState] = useState<SaveState>("idle");
  const [healthState, setHealthState] = useState<HealthState>("idle");
  const [notice, setNotice] = useState("");
  const [healthDetail, setHealthDetail] = useState("");
  const [config, setConfig] = useState(initialOverview.config);

  useEffect(() => {
    setConfig(overview.config);
  }, [overview]);

  useEffect(() => {
    setOverview(initialOverview);
  }, [initialOverview]);

  const keySourceLabel = useMemo(() => {
    if (overview.keyStatus.source === "DB") return "관리자 저장값 사용 중";
    if (overview.keyStatus.source === "ENV") return "환경 변수 사용 중";
    return "키 미설정";
  }, [overview.keyStatus.source]);

  const runtimeStatusLabel = useMemo(() => {
    if (healthState === "loading") return "자동 확인 중";
    if (overview.health.status === "healthy") return "정상 작동";
    if (overview.health.status === "unhealthy") return "작동 실패";
    return "미확인";
  }, [healthState, overview.health.status]);

  const runtimeStatusClassName = useMemo(() => {
    if (healthState === "loading") {
      return "border-amber-300/20 bg-amber-500/15 text-amber-100";
    }

    if (overview.health.status === "healthy") {
      return "border-emerald-300/20 bg-emerald-500/15 text-emerald-100";
    }

    if (overview.health.status === "unhealthy") {
      return "border-rose-300/20 bg-rose-500/15 text-rose-100";
    }

    return "border-white/10 bg-white/5 text-zinc-300";
  }, [healthState, overview.health.status]);

  async function loadOverview() {
    const res = await fetch("/api/admin/connectors/gemini/settings");
    const body = await readApiEnvelope<GeminiSettingsOverview>(res);
    if (!body.ok || !body.data) {
      throw new Error(body.message ?? "Gemini 설정을 불러오지 못했습니다.");
    }

    setOverview(body.data);
    onOverviewChange?.(body.data);
    return body.data;
  }

  async function saveSecret() {
    if (!apiKeyInput.trim()) {
      setSaveSecretState("error");
      setNotice("Gemini API 키를 입력해 주세요.");
      return;
    }

    setSaveSecretState("saving");
    setNotice("");

    try {
      const res = await fetch("/api/admin/connectors/gemini/secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      const body = await readApiEnvelope<GeminiSettingsOverview>(res);

      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "Gemini 키 저장에 실패했습니다.");
      }

      setOverview(body.data);
      onOverviewChange?.(body.data);
      setApiKeyInput("");
      setSaveSecretState("done");
      setNotice("Gemini API 키를 안전하게 저장했습니다.");
    } catch (error) {
      setSaveSecretState("error");
      setNotice(error instanceof Error ? error.message : "Gemini 키 저장에 실패했습니다.");
    }
  }

  async function saveConfig() {
    setSaveConfigState("saving");
    setNotice("");

    try {
      const res = await fetch("/api/admin/connectors/gemini/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = await readApiEnvelope<GeminiSettingsOverview>(res);

      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "Gemini 설정 저장에 실패했습니다.");
      }

      setOverview(body.data);
      onOverviewChange?.(body.data);
      setSaveConfigState("done");
      setNotice("Gemini 운영 설정을 저장했습니다.");
    } catch (error) {
      setSaveConfigState("error");
      setNotice(error instanceof Error ? error.message : "Gemini 설정 저장에 실패했습니다.");
    }
  }

  async function runHealthCheck() {
    setHealthState("loading");
    setHealthDetail("");
    setNotice("");

    try {
      const res = await fetch("/api/admin/connectors/gemini-health", {
        method: "POST",
      });
      const body = await readApiEnvelope<{ text?: string }>(res);

      if (body.ok) {
        setHealthState("ok");
        setHealthDetail(body.data?.text ?? "정상 응답을 확인했습니다.");
      } else {
        setHealthState("error");
        setHealthDetail(body.message ?? "Gemini 연결 테스트에 실패했습니다.");
      }

      await loadOverview();
    } catch (error) {
      setHealthState("error");
      setHealthDetail(
        error instanceof Error ? error.message : "네트워크 오류로 테스트에 실패했습니다."
      );
    }
  }

  return (
    <div className={className ?? "mt-5 rounded-2xl border border-white/10 bg-black/20 p-4"}>
      <div className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Runtime Status
              </p>
              <h4 className="mt-2 text-xl font-semibold text-white">Gemini 운영 상태</h4>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                관리자 화면 진입 시 자동 확인된 최근 연결 상태를 표시합니다. 필요하면 즉시 재검사할 수
                있습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${runtimeStatusClassName}`}>
                {runtimeStatusLabel}
              </span>
              <button
                type="button"
                onClick={runHealthCheck}
                disabled={healthState === "loading"}
                className="h-10 rounded-xl border border-emerald-300/20 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100 disabled:cursor-wait disabled:opacity-60"
              >
                {healthState === "loading" ? "자동 확인 중..." : "지금 다시 확인"}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <SummaryCard
              label="키 상태"
              value={overview.keyStatus.configured ? "준비 완료" : "미설정"}
              description={keySourceLabel}
            />
            <SummaryCard
              label="마지막 연결 확인"
              value={overview.health.lastCheckedAt ? formatDateTime(overview.health.lastCheckedAt) : "기록 없음"}
              description={
                overview.health.durationMs
                  ? `응답 시간 ${overview.health.durationMs}ms`
                  : "자동 연결 확인 기록이 아직 없습니다."
              }
            />
            <SummaryCard
              label="최근 상태 설명"
              value={overview.health.message || "메시지 없음"}
              description={overview.health.requestId ? `requestId ${overview.health.requestId}` : "requestId 없음"}
            />
          </div>

          {notice ? <p className="mt-4 text-xs text-zinc-300">{notice}</p> : null}
          {healthDetail ? (
            <p className="mt-2 text-xs leading-relaxed text-zinc-300">{healthDetail}</p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Gemini API 키</p>
              <p className="mt-1 text-xs text-zinc-400">
                관리자 저장값 또는 환경 변수 중 실제 런타임에서 사용 중인 키를 기준으로 표시합니다.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
              {keySourceLabel}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder="Gemini API 키를 입력하세요"
              className="h-11 rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={saveSecret}
              disabled={saveSecretState === "saving"}
              className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveSecretState === "saving" ? "저장 중..." : "키 저장"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
              상태: {overview.keyStatus.configured ? "설정됨" : "미설정"}
            </span>
            <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
              마스킹: {overview.keyStatus.maskedValue ?? "-"}
            </span>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">운영 설정</p>
              <p className="mt-1 text-xs text-zinc-400">
                기본 모델, timeout, 토큰 수를 저장하면 모든 Gemini 호출에 공통 적용됩니다.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, enabled: event.target.checked }))
                }
                className="h-4 w-4 rounded border-white/10 bg-zinc-900"
              />
              활성화
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">기본 모델</span>
              <input
                value={config.defaultModel}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, defaultModel: event.target.value }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">Timeout(ms)</span>
              <input
                type="number"
                min={1000}
                step={1000}
                value={config.timeoutMs}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    timeoutMs: Number(event.target.value),
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">Temperature</span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={config.temperature ?? ""}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    temperature:
                      event.target.value.trim() === "" ? null : Number(event.target.value),
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">
                Max Output Tokens
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={config.maxOutputTokens ?? ""}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    maxOutputTokens:
                      event.target.value.trim() === "" ? null : Number(event.target.value),
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveConfig}
              disabled={saveConfigState === "saving"}
              className="h-10 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveConfigState === "saving" ? "저장 중..." : "설정 저장"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">최근 호출 로그</p>
              <p className="mt-1 text-xs text-zinc-400">
                최근 10개를 표시하며, 로그는 30일 또는 provider별 500개 기준으로 정리됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadOverview();
              }}
              className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-zinc-200"
            >
              새로고침
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {overview.recentLogs.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-zinc-400">
                아직 Gemini 호출 로그가 없습니다.
              </div>
            ) : (
              overview.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "rounded-full px-2 py-1 text-[11px] font-semibold",
                            log.ok
                              ? "bg-emerald-500/20 text-emerald-200"
                              : "bg-rose-500/20 text-rose-200",
                          ].join(" ")}
                        >
                          {log.ok ? "성공" : "실패"}
                        </span>
                        <span
                          className={[
                            "rounded-full border px-2 py-1 text-[11px] font-semibold",
                            log.appId === "admin-health-check"
                              ? "border-sky-300/20 bg-sky-500/15 text-sky-100"
                              : "border-white/10 bg-white/5 text-zinc-300",
                          ].join(" ")}
                        >
                          {log.appId === "admin-health-check" ? "자동 확인" : "일반 호출"}
                        </span>
                      </div>
                      <p
                        className="mt-3 truncate text-sm text-zinc-300"
                        title={log.message ?? "메시지 없음"}
                      >
                        {log.message ?? "메시지 없음"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 text-[11px] text-zinc-500">
                      <span>{formatCompactDateTime(log.createdAt)}</span>
                      <span>{log.durationMs}ms</span>
                      <span>{log.errorCategory ?? "-"}</span>
                      <span className="font-mono text-zinc-600">{shortRequestId(log.requestId)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">{description}</p>
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

function shortRequestId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
