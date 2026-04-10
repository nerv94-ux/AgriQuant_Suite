"use client";

import { useEffect, useState } from "react";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T | null;
  message?: string;
};

type MafraOverview = {
  configured: boolean;
  source: "DB" | "ENV" | "NONE";
};

type TestState = "idle" | "loading" | "done" | "error";
type QueryResult = { rows: number; total: number } | null;
type CodeCandidate = { code: string; name: string };

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

/** 소매가격 API 명세 예시 조사일 — 관리자 테스트에서 첫 조회가 0건일 때 재시도 */
const MAFRA_RTLSAL_SAMPLE_EXAMIN_DE = "20150401";

export function MafraAdminCard({ className }: { className?: string }) {
  const [overview, setOverview] = useState<MafraOverview>({ configured: false, source: "NONE" });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [notice, setNotice] = useState("");

  const [saleDate, setSaleDate] = useState("20240506");
  const [registDt, setRegistDt] = useState("20240506");
  const [whsalName, setWhsalName] = useState("서울가락");
  const [cmpName, setCmpName] = useState("한국청과");
  const [itemName, setItemName] = useState("파프리카");
  const [smallCode, setSmallCode] = useState("");
  /** 소비 트렌드 결합 API — 명세 XML 샘플(2021년 1월)과 동일하게 기본값 */
  const [agricnsmYear, setAgricnsmYear] = useState("2021");
  const [agricnsmMonth, setAgricnsmMonth] = useState("1");

  const [rltmState, setRltmState] = useState<TestState>("idle");
  const [dataState, setDataState] = useState<TestState>("idle");
  const [infoState, setInfoState] = useState<TestState>("idle");
  const [periodState, setPeriodState] = useState<TestState>("idle");
  const [rtlsalState, setRtlsalState] = useState<TestState>("idle");
  const [agricnsmState, setAgricnsmState] = useState<TestState>("idle");
  const [resolveState, setResolveState] = useState<TestState>("idle");
  const [syncState, setSyncState] = useState<TestState>("idle");

  const [rltmResult, setRltmResult] = useState<QueryResult>(null);
  const [dataResult, setDataResult] = useState<QueryResult>(null);
  const [infoResult, setInfoResult] = useState<QueryResult>(null);
  const [periodResult, setPeriodResult] = useState<QueryResult>(null);
  const [rtlsalResult, setRtlsalResult] = useState<QueryResult>(null);
  const [agricnsmResult, setAgricnsmResult] = useState<QueryResult>(null);
  const [rltmError, setRltmError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [rtlsalError, setRtlsalError] = useState<string | null>(null);
  const [agricnsmError, setAgricnsmError] = useState<string | null>(null);
  const [resolvedCodes, setResolvedCodes] = useState<string>("-");
  const [itemCandidates, setItemCandidates] = useState<CodeCandidate[]>([]);

  async function loadOverview() {
    const res = await fetch("/api/admin/connectors/mafra/settings");
    const body = await readApiEnvelope<MafraOverview>(res);
    if (!body.ok || !body.data) {
      throw new Error(body.message ?? "MAFRA 설정을 불러오지 못했습니다.");
    }
    setOverview(body.data);
  }

  useEffect(() => {
    void loadOverview().catch(() => null);
  }, []);

  async function saveApiKey() {
    if (!apiKeyInput.trim()) {
      setNotice("MAFRA API Key를 입력해 주세요.");
      return;
    }
    setNotice("");
    try {
      const res = await fetch("/api/admin/connectors/mafra/secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      const body = await readApiEnvelope<MafraOverview>(res);
      if (!body.ok || !body.data) {
        throw new Error(body.message ?? "MAFRA API Key 저장에 실패했습니다.");
      }
      setOverview(body.data);
      setApiKeyInput("");
      setNotice("MAFRA API Key 저장 완료");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "MAFRA API Key 저장에 실패했습니다.");
    }
  }

  async function runCodeResolve() {
    setResolveState("loading");
    try {
      const res = await fetch("/api/admin/connectors/mafra/codebook/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketName: whsalName,
          corpName: cmpName,
          itemName,
          preferGarakItemCode: false,
          forceSync: false,
        }),
      });
      const body = await readApiEnvelope<{
        market: { code: string | null };
        corp: { code: string | null };
        item: { code: string | null; candidates: CodeCandidate[] };
      }>(res);
      if (!body.ok || !body.data) throw new Error(body.message ?? "코드 해석 실패");
      setResolvedCodes(
        `시장=${body.data.market.code ?? "-"}, 법인=${body.data.corp.code ?? "-"}, 품목=${body.data.item.code ?? "-"}`
      );
      setItemCandidates(body.data.item.candidates ?? []);
      if (!smallCode && body.data.item.code) {
        setSmallCode(body.data.item.code);
      }
      setResolveState("done");
    } catch (error) {
      setResolveState("error");
      setItemCandidates([]);
      setNotice(error instanceof Error ? error.message : "코드 해석 실패");
    }
  }

  async function runCodebookSync() {
    setSyncState("loading");
    setNotice("");
    try {
      const syncEndpoints = [
        "/api/admin/connectors/mafra/item-codes/sync",
        "/api/admin/connectors/mafra/market-codes/sync",
        "/api/admin/connectors/mafra/corp-codes/sync",
        "/api/admin/connectors/mafra/unit-codes/sync",
        "/api/admin/connectors/mafra/frml-codes/sync",
        "/api/admin/connectors/mafra/grd-codes/sync",
        "/api/admin/connectors/mafra/plor-codes/sync",
      ];
      for (const endpoint of syncEndpoints) {
        const res = await fetch(endpoint, { method: "POST" });
        const body = await readApiEnvelope<{ syncedCount?: number }>(res);
        if (!body.ok) {
          throw new Error(body.message ?? `동기화 실패: ${endpoint}`);
        }
      }
      setSyncState("done");
      setNotice("코드사전 동기화 완료");
    } catch (error) {
      setSyncState("error");
      setNotice(error instanceof Error ? error.message : "코드사전 동기화 실패");
    }
  }

  async function runRltm() {
    setRltmState("loading");
    setRltmError(null);
    try {
      const query = buildQuery({
        saleDate,
        whsalName,
        cmpName,
        itemName,
        small: smallCode,
        autoResolveCodes: 1,
        startIndex: 1,
        endIndex: 50,
      });
      const res = await fetch(`/api/admin/connectors/mafra/rltm-auc-info/list?${query}`);
      const body = await readApiEnvelope<{ rows: unknown[]; totalCount: number }>(res);
      if (!body.ok || !body.data) throw new Error(body.message ?? "실시간 경락 조회 실패");
      setRltmResult({ rows: body.data.rows.length, total: body.data.totalCount });
      setRltmState("done");
    } catch (error) {
      setRltmState("error");
      const message = error instanceof Error ? error.message : "실시간 경락 조회 실패";
      setRltmError(message);
      setNotice(message);
    }
  }

  async function runDataClcln() {
    setDataState("loading");
    setDataError(null);
    try {
      const query = buildQuery({
        saleDate,
        whsalName,
        cmpName,
        autoResolveCodes: 1,
        startIndex: 1,
        endIndex: 50,
      });
      const res = await fetch(`/api/admin/connectors/mafra/data-clcln-prc/list?${query}`);
      const body = await readApiEnvelope<{ rows: unknown[]; totalCount: number }>(res);
      if (!body.ok || !body.data) throw new Error(body.message ?? "원천 정산가격 조회 실패");
      setDataResult({ rows: body.data.rows.length, total: body.data.totalCount });
      setDataState("done");
    } catch (error) {
      setDataState("error");
      const message = error instanceof Error ? error.message : "원천 정산가격 조회 실패";
      setDataError(message);
      setNotice(message);
    }
  }

  async function runClclnInfo() {
    setInfoState("loading");
    setInfoError(null);
    try {
      const query = buildQuery({
        saleDate,
        whsalName,
        cmpName,
        itemName,
        small: smallCode,
        autoResolveCodes: 1,
        startIndex: 1,
        endIndex: 50,
      });
      const res = await fetch(`/api/admin/connectors/mafra/clcln-prc-info/list?${query}`);
      const body = await readApiEnvelope<{ rows: unknown[]; totalCount: number }>(res);
      if (!body.ok || !body.data) throw new Error(body.message ?? "정산가격 정보 조회 실패");
      setInfoResult({ rows: body.data.rows.length, total: body.data.totalCount });
      setInfoState("done");
    } catch (error) {
      setInfoState("error");
      const message = error instanceof Error ? error.message : "정산가격 정보 조회 실패";
      setInfoError(message);
      setNotice(message);
    }
  }

  async function runPeriodSummary() {
    setPeriodState("loading");
    setPeriodError(null);
    try {
      const query = buildQuery({
        registDt,
        whsalName,
        autoResolveCodes: 1,
        startIndex: 1,
        endIndex: 50,
      });
      const res = await fetch(`/api/admin/connectors/mafra/clcln-prc-whlsl-mrkt/list?${query}`);
      const body = await readApiEnvelope<{ rows: unknown[]; totalCount: number }>(res);
      if (!body.ok || !body.data) throw new Error(body.message ?? "기간별 집계 조회 실패");
      setPeriodResult({ rows: body.data.rows.length, total: body.data.totalCount });
      setPeriodState("done");
    } catch (error) {
      setPeriodState("error");
      const message = error instanceof Error ? error.message : "기간별 집계 조회 실패";
      setPeriodError(message);
      setNotice(message);
    }
  }

  async function runRtlsal() {
    setRtlsalState("loading");
    setRtlsalError(null);
    try {
      const base = {
        startIndex: 1,
        /** 명세: 샘플 키는 1~5건 구간만 허용하는 경우가 있음 */
        endIndex: 5,
      };

      const runFetch = async (examinDe: string) => {
        const query = buildQuery({ examinDe, ...base });
        const res = await fetch(`/api/admin/connectors/mafra/rtlsal-price/list?${query}`);
        return readApiEnvelope<{ rows: unknown[]; totalCount: number }>(res);
      };

      const primaryDe = saleDate.trim() || MAFRA_RTLSAL_SAMPLE_EXAMIN_DE;
      let body = await runFetch(primaryDe);
      if (!body.ok || !body.data) throw new Error(body.message ?? "소매가격 조회 실패");

      let rows = body.data.rows.length;
      let total = body.data.totalCount;
      let noticeText = typeof body.message === "string" ? body.message.trim() : "";

      if (rows === 0 && primaryDe !== MAFRA_RTLSAL_SAMPLE_EXAMIN_DE) {
        const fallback = await runFetch(MAFRA_RTLSAL_SAMPLE_EXAMIN_DE);
        if (!fallback.ok || !fallback.data) {
          throw new Error(fallback.message ?? "명세 샘플 일자로 재조회하지 못했습니다.");
        }
        if (fallback.data.rows.length > 0) {
          rows = fallback.data.rows.length;
          total = fallback.data.totalCount;
          noticeText = [
            `조사일 ${primaryDe}는 0건입니다.`,
            `명세 샘플 일자(${MAFRA_RTLSAL_SAMPLE_EXAMIN_DE})로 재조회해 ${rows}건을 받았습니다. API 연동은 정상으로 보입니다.`,
            typeof fallback.message === "string" ? fallback.message.trim() : "",
          ]
            .filter(Boolean)
            .join(" ");
        } else {
          noticeText = [
            noticeText || `조사일 ${primaryDe}: 0건.`,
            `샘플 일자(${MAFRA_RTLSAL_SAMPLE_EXAMIN_DE})로도 0건입니다. 키 권한·서비스 상태를 확인해 주세요.`,
          ].join(" ");
        }
      } else if (rows > 0) {
        noticeText = noticeText || `소매가격 ${rows}건 조회됨 (조사일 ${primaryDe}).`;
      }

      setRtlsalResult({ rows, total });
      if (noticeText) setNotice(noticeText);
      setRtlsalState("done");
    } catch (error) {
      setRtlsalState("error");
      const message = error instanceof Error ? error.message : "소매가격 조회 실패";
      setRtlsalError(message);
      setNotice(message);
    }
  }

  async function runAgricnsmTrnd() {
    setAgricnsmState("loading");
    setAgricnsmError(null);
    try {
      const query = buildQuery({
        CRTR_YEAR: agricnsmYear.trim(),
        CRTR_MONTH: agricnsmMonth.trim(),
        startIndex: 1,
        endIndex: 5,
      });
      const res = await fetch(`/api/admin/connectors/mafra/agricnsm-trnd/list?${query}`);
      const body = await readApiEnvelope<{ rows: unknown[]; totalCount: number }>(res);
      if (!body.ok || !body.data) throw new Error(body.message ?? "소비 트렌드 결합 조회 실패");
      setAgricnsmResult({ rows: body.data.rows.length, total: body.data.totalCount });
      if (typeof body.message === "string" && body.message.trim()) {
        setNotice(body.message);
      }
      setAgricnsmState("done");
    } catch (error) {
      setAgricnsmState("error");
      const message = error instanceof Error ? error.message : "소비 트렌드 결합 조회 실패";
      setAgricnsmError(message);
      setNotice(message);
    }
  }

  return (
    <div className={className ?? "rounded-3xl border border-white/10 bg-black/20 p-5"}>
      <div className="space-y-5">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">MAFRA 도매시장 API 상태</p>
              <p className="mt-1 text-xs text-zinc-400">실시간 경락·정산·기간 집계·소매가격·소비 트렌드 결합을 같은 MAFRA 키로 테스트합니다.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200">
              키 소스 {overview.source}
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-300">키 설정: {overview.configured ? "완료" : "필요"}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder="MAFRA_API_KEY 입력"
              className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => void saveApiKey()}
              className="h-10 rounded-xl bg-white px-3 text-xs font-semibold text-black"
            >
              키 저장
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">공통 테스트 파라미터</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              placeholder="saleDate / 소매가격 조사일 EXAMIN_DE (YYYYMMDD)"
              className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none"
            />
            <input value={registDt} onChange={(e) => setRegistDt(e.target.value)} placeholder="registDt (YYYYMMDD)" className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none" />
            <input value={whsalName} onChange={(e) => setWhsalName(e.target.value)} placeholder="시장명 (예: 서울가락)" className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none" />
            <input value={cmpName} onChange={(e) => setCmpName(e.target.value)} placeholder="법인명 (예: 한국청과)" className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none" />
            <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="품목명 (예: 파프리카)" className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none md:col-span-2" />
            <input value={smallCode} onChange={(e) => setSmallCode(e.target.value)} placeholder="SMALL 코드 직접 입력 (선택)" className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none md:col-span-2" />
            <input
              value={agricnsmYear}
              onChange={(e) => setAgricnsmYear(e.target.value)}
              placeholder="트렌드 결합 CRTR_YEAR (예: 2021)"
              className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none"
            />
            <input
              value={agricnsmMonth}
              onChange={(e) => setAgricnsmMonth(e.target.value)}
              placeholder="트렌드 결합 CRTR_MONTH (1~12)"
              className="h-10 rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-white outline-none"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void runCodeResolve()} className="h-9 rounded-xl border border-sky-300/20 bg-sky-500/15 px-3 text-xs font-semibold text-sky-100">
              {resolveState === "loading" ? "해석 중..." : "코드 해석"}
            </button>
            <button type="button" onClick={() => void runCodebookSync()} className="h-9 rounded-xl border border-violet-300/20 bg-violet-500/15 px-3 text-xs font-semibold text-violet-100">
              {syncState === "loading" ? "동기화 중..." : "코드사전 동기화"}
            </button>
            <span className="self-center text-xs text-zinc-300">{resolvedCodes}</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            단위(중량·수량 단위 CODEID)는 위 해석 결과에 포함되지 않습니다. 시장·법인·품목과 별도 그리드이며,{" "}
            <strong className="font-semibold text-zinc-400">데스크 → 품목 상세 → 「시세·가격비교용 코드」</strong>에서 단위
            목록을 고르거나 CODEID를 직접 입력합니다.
          </p>
          {itemCandidates.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-xs text-zinc-400">품목 코드 후보 (클릭 시 SMALL 코드 입력)</p>
              <div className="flex flex-wrap gap-2">
                {itemCandidates.map((candidate) => (
                  <button
                    key={`${candidate.code}-${candidate.name}`}
                    type="button"
                    onClick={() => setSmallCode(candidate.code)}
                    className={[
                      "rounded-lg border px-2.5 py-1 text-xs",
                      smallCode === candidate.code
                        ? "border-emerald-300/20 bg-emerald-500/15 text-emerald-100"
                        : "border-white/10 bg-white/5 text-zinc-200",
                    ].join(" ")}
                  >
                    {candidate.name} ({candidate.code})
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">메인 API 실행 테스트</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <button type="button" onClick={() => void runRltm()} className="h-10 rounded-xl border border-emerald-300/20 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-100">
              {rltmState === "loading" ? "실행 중..." : "실시간 경락 정보"}
            </button>
            <button type="button" onClick={() => void runDataClcln()} className="h-10 rounded-xl border border-violet-300/20 bg-violet-500/15 px-3 text-xs font-semibold text-violet-100">
              {dataState === "loading" ? "실행 중..." : "원천데이터 정산가격"}
            </button>
            <button type="button" onClick={() => void runClclnInfo()} className="h-10 rounded-xl border border-amber-300/20 bg-amber-500/15 px-3 text-xs font-semibold text-amber-100">
              {infoState === "loading" ? "실행 중..." : "정산가격 정보"}
            </button>
            <button type="button" onClick={() => void runPeriodSummary()} className="h-10 rounded-xl border border-cyan-300/20 bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-100">
              {periodState === "loading" ? "실행 중..." : "기간별 시장 집계"}
            </button>
            <button type="button" onClick={() => void runRtlsal()} className="h-10 rounded-xl border border-rose-300/20 bg-rose-500/15 px-3 text-xs font-semibold text-rose-100 md:col-span-2">
              {rtlsalState === "loading" ? "실행 중..." : "농수축산물 소매가격 (Grid 소매)"}
            </button>
            <button
              type="button"
              onClick={() => void runAgricnsmTrnd()}
              className="h-10 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/15 px-3 text-xs font-semibold text-fuchsia-100 md:col-span-2"
            >
              {agricnsmState === "loading" ? "실행 중..." : "소매가격·소비 트렌드 결합 (W_DI_AGRICNSMTRND)"}
            </button>
          </div>
          <div className="mt-3 grid gap-1 text-xs text-zinc-300">
            <p>
              실시간 경락 결과: {rltmResult ? `${rltmResult.rows} / total ${rltmResult.total}` : "-"}
              {rltmError ? ` (실패: ${rltmError})` : ""}
            </p>
            <p>
              원천 정산가격 결과: {dataResult ? `${dataResult.rows} / total ${dataResult.total}` : "-"}
              {dataError ? ` (실패: ${dataError})` : ""}
            </p>
            <p>
              정산가격 정보 결과: {infoResult ? `${infoResult.rows} / total ${infoResult.total}` : "-"}
              {infoError ? ` (실패: ${infoError})` : ""}
            </p>
            <p>
              기간별 집계 결과: {periodResult ? `${periodResult.rows} / total ${periodResult.total}` : "-"}
              {periodError ? ` (실패: ${periodError})` : ""}
            </p>
            <p>
              소매가격 결과: {rtlsalResult ? `${rtlsalResult.rows} / total ${rtlsalResult.total}` : "-"}
              {rtlsalError ? ` (실패: ${rtlsalError})` : ""}
            </p>
            <p>
              소비 트렌드 결합 결과: {agricnsmResult ? `${agricnsmResult.rows} / total ${agricnsmResult.total}` : "-"}
              {agricnsmError ? ` (실패: ${agricnsmError})` : ""}
            </p>
          </div>
        </section>

        {notice ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">{notice}</p>
        ) : null}
      </div>
    </div>
  );
}
