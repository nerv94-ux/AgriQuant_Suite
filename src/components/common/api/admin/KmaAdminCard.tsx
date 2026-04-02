"use client";

import { useEffect, useMemo, useState } from "react";
import type { KmaSettingsOverview } from "@/components/common/api/server/admin/providerSettings";

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

export function KmaAdminCard({
  initialOverview,
  className,
  onOverviewChange,
}: {
  initialOverview: KmaSettingsOverview;
  className?: string;
  onOverviewChange?: (overview: KmaSettingsOverview) => void;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [serviceKeyInput, setServiceKeyInput] = useState("");
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
    const res = await fetch("/api/admin/connectors/kma/settings");
    const body = await readApiEnvelope<KmaSettingsOverview>(res);
    if (!body.ok || !body.data) {
      throw new Error(body.message ?? "기상청 설정을 불러오지 못했습니다.");
    }
    setOverview(body.data);
    onOverviewChange?.(body.data);
    return body.data;
  }

  async function saveSecret() {
    if (!serviceKeyInput.trim()) {
      setSaveSecretState("error");
      setNotice("Service Key를 입력해 주세요.");
      return;
    }
    setSaveSecretState("saving");
    setNotice("");
    try {
      const res = await fetch("/api/admin/connectors/kma/secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceKey: serviceKeyInput }),
      });
      const body = await readApiEnvelope<KmaSettingsOverview>(res);
      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "Service Key 저장에 실패했습니다.");
      }
      setOverview(body.data);
      onOverviewChange?.(body.data);
      setServiceKeyInput("");
      setSaveSecretState("done");
      setNotice("Service Key를 안전하게 저장했습니다.");
    } catch (error) {
      setSaveSecretState("error");
      setNotice(error instanceof Error ? error.message : "Service Key 저장에 실패했습니다.");
    }
  }

  async function saveConfig() {
    setSaveConfigState("saving");
    setNotice("");
    try {
      const res = await fetch("/api/admin/connectors/kma/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = await readApiEnvelope<KmaSettingsOverview>(res);
      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "기상청 설정 저장에 실패했습니다.");
      }
      setOverview(body.data);
      onOverviewChange?.(body.data);
      setSaveConfigState("done");
      setNotice("기상청 설정을 저장했습니다.");
    } catch (error) {
      setSaveConfigState("error");
      setNotice(error instanceof Error ? error.message : "기상청 설정 저장에 실패했습니다.");
    }
  }

  async function runHealthCheck() {
    setHealthState("loading");
    setHealthDetail("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/connectors/kma-health", { method: "POST" });
      const body = await readApiEnvelope<{
        warningCount: number;
        forecastCount: number;
        nx: number;
        ny: number;
        baseDate: string;
        baseTime: string;
      }>(res);
      if (body.ok && body.data) {
        setHealthState("ok");
        setHealthDetail(
          `특보 ${body.data.warningCount}건, 단기예보 ${body.data.forecastCount}건 확인 (nx=${body.data.nx}, ny=${body.data.ny}, ${body.data.baseDate} ${body.data.baseTime}).`
        );
      } else {
        setHealthState("error");
        setHealthDetail(body.message ?? "기상청 연결 확인에 실패했습니다.");
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
              <p className="text-sm font-semibold text-white">기상청 연결 상태</p>
              <p className="mt-1 text-xs text-zinc-400">기상특보 + 단기예보를 동일 키로 확인합니다.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200">
              {runtimeLabel}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-300">
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
          <p className="mt-1 text-xs text-zinc-400">Service Key는 암호화되어 저장됩니다.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="password"
              value={serviceKeyInput}
              onChange={(event) => setServiceKeyInput(event.target.value)}
              placeholder="Service Key 입력"
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
            마스킹: {overview.keyStatus.maskedServiceKey ?? "미설정"}
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">기본 설정</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">NX</span>
              <input
                value={config.nx}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, nx: Number(event.target.value || 0) }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">NY</span>
              <input
                value={config.ny}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, ny: Number(event.target.value || 0) }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">BASE_TIME (HHmm)</span>
              <input
                value={config.baseTime}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, baseTime: event.target.value.replace(/\D/g, "").slice(0, 4) }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">NUM_OF_ROWS</span>
              <input
                value={config.numOfRows}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, numOfRows: Number(event.target.value || 0) }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-zinc-400">PAGE_NO</span>
              <input
                value={config.pageNo}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, pageNo: Number(event.target.value || 0) }))
                }
                className="h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 text-sm text-white outline-none"
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/70 px-4">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) => setConfig((current) => ({ ...current, enabled: event.target.checked }))}
                className="h-4 w-4 rounded border-zinc-500 bg-zinc-900 text-emerald-400"
              />
              <span className="text-sm text-zinc-200">커넥터 활성화</span>
            </label>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={saveConfig}
              disabled={saveConfigState === "saving"}
              className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveConfigState === "saving" ? "저장 중..." : "설정 저장"}
            </button>
          </div>
        </section>

        {notice ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
