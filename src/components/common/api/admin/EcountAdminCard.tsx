"use client";

import { useEffect, useMemo, useState } from "react";
import type { EcountSettingsOverview } from "@/components/common/api/server/admin/providerSettings";

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

  throw new Error("관리자 API가 JSON 응답을 반환하지 않았습니다.");
}

export function EcountAdminCard({
  initialOverview,
  className,
  onOverviewChange,
}: {
  initialOverview: EcountSettingsOverview;
  className?: string;
  onOverviewChange?: (overview: EcountSettingsOverview) => void;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [apiCertKeyInput, setApiCertKeyInput] = useState("");
  const [config, setConfig] = useState(initialOverview.config);
  const [saveSecretState, setSaveSecretState] = useState<SaveState>("idle");
  const [saveConfigState, setSaveConfigState] = useState<SaveState>("idle");
  const [healthState, setHealthState] = useState<HealthState>("idle");
  const [notice, setNotice] = useState("");
  const [healthDetail, setHealthDetail] = useState("");

  useEffect(() => {
    setOverview(initialOverview);
  }, [initialOverview]);

  useEffect(() => {
    setConfig(overview.config);
  }, [overview]);

  const runtimeLabel = useMemo(() => {
    if (healthState === "loading") return "확인 중";
    if (overview.health.status === "healthy") return "정상 작동";
    if (overview.health.status === "unhealthy") return "작동 실패";
    return "미확인";
  }, [healthState, overview.health.status]);

  async function loadOverview() {
    const res = await fetch("/api/admin/connectors/ecount/settings");
    const body = await readApiEnvelope<EcountSettingsOverview>(res);
    if (!body.ok || !body.data) {
      throw new Error(body.message ?? "eCount 설정을 불러오지 못했습니다.");
    }

    setOverview(body.data);
    onOverviewChange?.(body.data);
    return body.data;
  }

  async function saveSecret() {
    if (!apiCertKeyInput.trim()) {
      setSaveSecretState("error");
      setNotice("API_CERT_KEY를 입력해 주세요.");
      return;
    }

    setSaveSecretState("saving");
    setNotice("");

    try {
      const res = await fetch("/api/admin/connectors/ecount/secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiCertKey: apiCertKeyInput }),
      });
      const body = await readApiEnvelope<EcountSettingsOverview>(res);

      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "API_CERT_KEY 저장에 실패했습니다.");
      }

      setOverview(body.data);
      onOverviewChange?.(body.data);
      setApiCertKeyInput("");
      setSaveSecretState("done");
      setNotice("API_CERT_KEY를 안전하게 저장했습니다.");
    } catch (error) {
      setSaveSecretState("error");
      setNotice(error instanceof Error ? error.message : "API_CERT_KEY 저장에 실패했습니다.");
    }
  }

  async function saveConfig() {
    setSaveConfigState("saving");
    setNotice("");

    try {
      const res = await fetch("/api/admin/connectors/ecount/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = await readApiEnvelope<EcountSettingsOverview>(res);
      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "eCount 설정 저장에 실패했습니다.");
      }

      setOverview(body.data);
      onOverviewChange?.(body.data);
      setSaveConfigState("done");
      setNotice("eCount 설정을 저장했습니다.");
    } catch (error) {
      setSaveConfigState("error");
      setNotice(error instanceof Error ? error.message : "eCount 설정 저장에 실패했습니다.");
    }
  }

  async function runHealthCheck() {
    setHealthState("loading");
    setHealthDetail("");
    setNotice("");

    try {
      const res = await fetch("/api/admin/connectors/ecount-health?force=1", { method: "POST" });
      const body = await readApiEnvelope<{ sessionId?: string; zone?: string }>(res);
      if (body.ok) {
        setHealthState("ok");
        setHealthDetail(
          body.data?.sessionId
            ? `Zone ${body.data.zone ?? "-"} 확인 및 로그인 성공 (SESSION_ID 발급).`
            : "eCount 연결 확인에 성공했습니다."
        );
      } else {
        setHealthState("error");
        setHealthDetail(body.message ?? "eCount 연결 확인에 실패했습니다.");
      }

      await loadOverview();
    } catch (error) {
      setHealthState("error");
      setHealthDetail(error instanceof Error ? error.message : "네트워크 오류로 연결 확인에 실패했습니다.");
    }
  }

  return (
    <div className={className ?? "rounded-3xl border border-white/10 bg-black/20 p-5"}>
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">eCount 연결 상태</p>
              <p className="mt-1 text-xs text-zinc-400">
                Zone + Login 확인 기준이며, 실패가 누적되면 자동중지 상태가 됩니다.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200">
              {runtimeLabel}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-300">
            <span>실패 누적(6h): {overview.health.recentFailureCount}</span>
            <span>자동중지: {overview.health.autoStopped ? "ON" : "OFF"}</span>
            <span>
              마지막 확인:{" "}
              {overview.health.lastCheckedAt
                ? new Date(overview.health.lastCheckedAt).toLocaleString()
                : "기록 없음"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runHealthCheck}
              disabled={healthState === "loading"}
              className="h-10 rounded-xl border border-emerald-300/20 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100 disabled:cursor-wait disabled:opacity-60"
            >
              {healthState === "loading" ? "확인 중..." : "연결 확인"}
            </button>
            <button
              type="button"
              onClick={() => {
                void loadOverview();
              }}
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-100"
            >
              상태 새로고침
            </button>
          </div>
          {healthDetail ? <p className="mt-3 text-xs text-zinc-300">{healthDetail}</p> : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">인증 키</p>
          <p className="mt-1 text-xs text-zinc-400">API_CERT_KEY는 암호화되어 저장됩니다.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="password"
              value={apiCertKeyInput}
              onChange={(event) => setApiCertKeyInput(event.target.value)}
              placeholder="API_CERT_KEY 입력"
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
          <p className="mt-3 text-xs text-zinc-400">
            마스킹: {overview.keyStatus.maskedApiCertKey ?? "미설정"}
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">기본 설정</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">COM_CODE</span>
              <input
                value={config.comCode}
                onChange={(event) => setConfig((current) => ({ ...current, comCode: event.target.value }))}
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">USER_ID</span>
              <input
                value={config.userId}
                onChange={(event) => setConfig((current) => ({ ...current, userId: event.target.value }))}
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">ZONE</span>
              <input
                value={config.zone}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, zone: event.target.value.toUpperCase() }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">LAN_TYPE</span>
              <input
                value={config.lanType}
                onChange={(event) => setConfig((current) => ({ ...current, lanType: event.target.value }))}
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">환경</span>
              <select
                value={config.envMode}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    envMode: event.target.value === "prod" ? "prod" : "test",
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              >
                <option value="test">test</option>
                <option value="prod">prod</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, enabled: event.target.checked }))
                }
                className="h-4 w-4 rounded border-white/10 bg-zinc-900"
              />
              커넥터 활성화
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

          {notice ? <p className="mt-3 text-xs text-zinc-300">{notice}</p> : null}
        </section>
      </div>
    </div>
  );
}
