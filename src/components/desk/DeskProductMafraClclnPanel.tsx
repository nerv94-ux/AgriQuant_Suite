"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "info" | "raw" | "market";
type RawMatchDiagnostics = {
  sourceRows: number;
  smallMatched: number;
  codebookMatched: number;
  keywordMatched: number;
  strictMatched: number;
  missingLarge: number;
  largeMismatch: number;
  missingMid: number;
  midMismatch: number;
  codebookApplied: boolean;
  keywordApplied: boolean;
  looseApplied: boolean;
};

function todayYmd(): string {
  const d = new Date();
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function ymdToDateValue(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return "";
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function dateValueToYmd(v: string): string {
  return v.replace(/-/g, "");
}

function collectKeys(rows: Record<string, unknown>[], maxCols: number): string[] {
  const s = new Set<string>();
  for (const row of rows.slice(0, 40)) {
    for (const k of Object.keys(row)) s.add(k);
  }
  return [...s].slice(0, maxCols);
}

/** 정산·원천 그리드에서 숫자로 보이는 측정값(천 단위 구분) */
const NUMERIC_MEASURE_KEYS = new Set([
  "TOTQTY",
  "TOTAMT",
  "QTY",
  "COST",
  "MINAMT",
  "MAXAMT",
  "AVGAMT",
]);

function formatYmdDisplay(t: string): string | null {
  if (/^\d{8}$/.test(t)) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  return null;
}

function formatMafraCell(column: string, v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  const t = String(v).trim();
  if (t === "") return "—";

  const col = column.toUpperCase();
  if (col === "REGIST_DT" || col === "SALEDATE") {
    const y = formatYmdDisplay(t);
    if (y) return y;
  }

  if (NUMERIC_MEASURE_KEYS.has(col)) {
    const n = Number(t.replace(/,/g, ""));
    if (Number.isFinite(n)) {
      const isQty = col === "TOTQTY" || col === "QTY";
      return new Intl.NumberFormat("ko-KR", {
        maximumFractionDigits: isQty ? 4 : 0,
        minimumFractionDigits: 0,
      }).format(n);
    }
  }

  return t;
}

function normalizeLooseText(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function rowHasProductKeyword(row: Record<string, unknown>, name: string): boolean {
  const k = normalizeLooseText(name);
  if (k.length < 2) return true;
  const g = normalizeLooseText(row.GOODNAME);
  const p = normalizeLooseText(row.PUMNAME);
  const c = normalizeLooseText(row.CMPGOOD);
  return g.includes(k) || p.includes(k) || c.includes(k);
}

type DeskProductMafraClclnPanelProps = {
  productName: string;
  savedMafraLarge: string | null;
  savedMafraMid: string | null;
  savedMafraSmall: string | null;
};

export default function DeskProductMafraClclnPanel({
  productName,
  savedMafraLarge,
  savedMafraMid,
  savedMafraSmall,
}: DeskProductMafraClclnPanelProps) {
  const [tab, setTab] = useState<Tab>("info");
  const [saleDate, setSaleDate] = useState(() => todayYmd());
  const [registDt, setRegistDt] = useState(() => todayYmd());
  /** 짧은 키워드(예: 가락)가 코드사전 CODENAME과 부분 일치하기 쉽습니다. */
  const [whsalName, setWhsalName] = useState("가락");
  /** 비우면 이름으로 자동 해석. 알면 입력해 오류를 피할 수 있습니다. */
  const [whsalCd, setWhsalCd] = useState("");
  const [cmpCd, setCmpCd] = useState("");
  const [cmpName, setCmpName] = useState("");
  const [large, setLarge] = useState(savedMafraLarge ?? "");
  const [mid, setMid] = useState(savedMafraMid ?? "");
  const [small, setSmall] = useState(savedMafraSmall ?? "");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [resolvedHint, setResolvedHint] = useState<string | null>(null);
  const [matchPolicyLine, setMatchPolicyLine] = useState<string | null>(null);
  const [matchDiagLine, setMatchDiagLine] = useState<string | null>(null);
  /** 조회 성공인데 rows가 0건일 때(진짜 미매칭) 안내용 — 단일 `row` 파싱 버그와 구분 */
  const [lastFetchEmptyOk, setLastFetchEmptyOk] = useState(false);
  /** false면 정산과 동일 품목(LARGE/MID/SMALL)으로 원천 조회 — true면 시장·일자만(전 품목) */
  const [rawAllProducts, setRawAllProducts] = useState(false);
  /** 원천: 서버 소분류 느슨 일치(과포함 가능) */
  const [rawLooseSmall, setRawLooseSmall] = useState(false);
  /** 원천: 표만 GOODNAME/PUMNAME에 품목명 포함 행으로 제한 */
  const [rawKeywordOnly, setRawKeywordOnly] = useState(false);

  useEffect(() => {
    setLarge(savedMafraLarge ?? "");
    setMid(savedMafraMid ?? "");
    setSmall(savedMafraSmall ?? "");
  }, [savedMafraLarge, savedMafraMid, savedMafraSmall]);

  useEffect(() => {
    setRows([]);
    setErr(null);
    setMetaMsg(null);
    setResolvedHint(null);
    setMatchPolicyLine(null);
    setMatchDiagLine(null);
    setLastFetchEmptyOk(false);
  }, [tab]);

  const displayRows = useMemo(() => {
    if (tab !== "raw" || !rawKeywordOnly || !productName.trim()) return rows;
    return rows.filter((r) => rowHasProductKeyword(r, productName));
  }, [tab, rawKeywordOnly, rows, productName]);

  const columns = useMemo(() => {
    const source = displayRows.length > 0 ? displayRows : rows;
    return collectKeys(source, 24);
  }, [displayRows, rows]);

  const runFetch = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setMetaMsg(null);
    setResolvedHint(null);
    setMatchPolicyLine(null);
    setMatchDiagLine(null);
    setLastFetchEmptyOk(false);
    setRows([]);
    try {
      const path =
        tab === "info"
          ? "/api/desk/mafra/clcln-prc-info"
          : tab === "raw"
            ? "/api/desk/mafra/data-clcln-prc"
            : "/api/desk/mafra/clcln-prc-whlsl-mrkt";
      const u = new URL(path, window.location.origin);
      if (tab === "info") {
        u.searchParams.set("saleDate", saleDate);
        u.searchParams.set("whsalName", whsalName.trim());
        u.searchParams.set("cmpName", cmpName.trim());
        u.searchParams.set("large", large.trim());
        u.searchParams.set("mid", mid.trim());
        u.searchParams.set("small", small.trim());
        u.searchParams.set("itemName", productName.trim());
        u.searchParams.set("preferGarakItemCode", "1");
        u.searchParams.set("startIndex", "1");
        u.searchParams.set("endIndex", "80");
      } else if (tab === "raw") {
        u.searchParams.set("saleDate", saleDate);
        u.searchParams.set("whsalName", whsalName.trim());
        u.searchParams.set("cmpName", cmpName.trim());
        u.searchParams.set("startIndex", "1");
        u.searchParams.set("endIndex", "80");
        u.searchParams.set("deskItemMatch", "1");
        if (!rawAllProducts) {
          u.searchParams.set("large", large.trim());
          u.searchParams.set("mid", mid.trim());
          u.searchParams.set("small", small.trim());
          u.searchParams.set("itemName", productName.trim());
          u.searchParams.set("preferGarakItemCode", "1");
          u.searchParams.set("filterByProductCodes", "1");
          if (large.trim() && mid.trim() && small.trim()) {
            u.searchParams.set("preferSavedItemCodes", "1");
          }
          if (rawLooseSmall) u.searchParams.set("looseSmallMatch", "1");
        } else {
          u.searchParams.set("filterByProductCodes", "0");
        }
      } else {
        u.searchParams.set("registDt", registDt);
        u.searchParams.set("whsalName", whsalName.trim());
        u.searchParams.set("startIndex", "1");
        u.searchParams.set("endIndex", "80");
      }

      const wcd = whsalCd.trim();
      const ccd = cmpCd.trim();
      if (wcd) u.searchParams.set("whsalcd", wcd);
      if (ccd) u.searchParams.set("cmpcd", ccd);

      const res = await fetch(u.toString(), { credentials: "same-origin" });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          rows?: Record<string, unknown>[];
          resolved?: Record<string, string | null>;
          matchPolicy?: string;
          matchDiagnostics?: RawMatchDiagnostics;
        };
      };
      if (!res.ok || json.ok !== true || !json.data) {
        setErr(typeof json.message === "string" ? json.message : "조회에 실패했습니다.");
        setLastFetchEmptyOk(false);
        return;
      }
      const list = Array.isArray(json.data.rows) ? json.data.rows : [];
      setRows(list);
      setLastFetchEmptyOk(list.length === 0);
      if (typeof json.message === "string" && json.message.length > 0) {
        setMetaMsg(json.message);
      }
      const r = json.data.resolved;
      if (r && typeof r === "object") {
        const parts = Object.entries(r)
          .filter(([, v]) => v != null && String(v).trim() !== "")
          .map(([k, v]) => `${k}: ${v}`);
        if (parts.length) setResolvedHint(parts.join(" · "));
      }
      if (tab === "raw" && typeof json.data.matchPolicy === "string" && json.data.matchPolicy.trim() !== "") {
        setMatchPolicyLine(json.data.matchPolicy);
      }
      if (tab === "raw" && json.data.matchDiagnostics) {
        const d = json.data.matchDiagnostics;
        setMatchDiagLine(
          [
            `원본:${d.sourceRows}`,
            `SMALL일치:${d.smallMatched}`,
            `코드북일치:${d.codebookMatched}`,
            `키워드일치:${d.keywordMatched}`,
            `엄격일치:${d.strictMatched}`,
            `LARGE누락:${d.missingLarge}`,
            `LARGE불일치:${d.largeMismatch}`,
            `MID누락:${d.missingMid}`,
            `MID불일치:${d.midMismatch}`,
            `코드북보정:${d.codebookApplied ? "Y" : "N"}`,
            `키워드보정:${d.keywordApplied ? "Y" : "N"}`,
            `느슨폴백:${d.looseApplied ? "Y" : "N"}`,
          ].join(" · "),
        );
      }
    } catch {
      setErr("네트워크 오류로 조회하지 못했습니다.");
      setLastFetchEmptyOk(false);
    } finally {
      setBusy(false);
    }
  }, [tab, saleDate, registDt, whsalName, whsalCd, cmpCd, cmpName, large, mid, small, productName, rawAllProducts, rawLooseSmall]);

  return (
    <details
      id="desk-section-mafra-clcln"
      className="scroll-mt-28 rounded-2xl border border-amber-200/90 bg-amber-50/20 shadow-sm"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-amber-950 marker:content-none [&::-webkit-details-marker]:hidden">
        MAFRA 정산·원천 데이터{" "}
        <span className="font-normal text-amber-800/90">— 도매 산정 보조 · 실시간 경매와 별도</span>
      </summary>
      <div className="space-y-3 border-t border-amber-100 px-4 pb-4 pt-3">
        <p className="text-[11px] leading-relaxed text-amber-950/90">
          가락 OpenAPI <strong>정산 가격 정보</strong>·<strong>원천(정산)</strong>·<strong>도매시장 집계</strong>를 그대로
          불러와 확인합니다. 수치 정의는 명세를 함께 보세요. 조회 후 화면·필터는 피드백에 맞춰 다듬을 수 있습니다.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["info", "정산 가격 정보"],
              ["raw", "원천 데이터"],
              ["market", "도매시장 집계"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={[
                "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                tab === k ? "bg-amber-700 text-white" : "bg-white text-amber-900 ring-1 ring-amber-200 hover:bg-amber-50",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {tab === "market" ? (
            <label className="block text-[11px] font-medium text-zinc-700">
              등록일(registDt)
              <input
                type="date"
                value={ymdToDateValue(registDt)}
                onChange={(e) => setRegistDt(dateValueToYmd(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              />
            </label>
          ) : (
            <label className="block text-[11px] font-medium text-zinc-700">
              경매일(saleDate)
              <input
                type="date"
                value={ymdToDateValue(saleDate)}
                onChange={(e) => setSaleDate(dateValueToYmd(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              />
            </label>
          )}
          <label className="block text-[11px] font-medium text-zinc-700 sm:col-span-2">
            도매시장명 (자동 코드 해석)
            <input
              value={whsalName}
              onChange={(e) => setWhsalName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              placeholder="가락 · 서울가락 등 짧게"
            />
          </label>
          <label className="block text-[11px] font-medium text-zinc-700 sm:col-span-2">
            법인명 (선택)
            <input
              value={cmpName}
              onChange={(e) => setCmpName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              placeholder="비우면 자동 해석 또는 전체"
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-[11px] font-medium text-zinc-700">
            WHSALCD (선택 · 직접 입력)
            <input
              value={whsalCd}
              onChange={(e) => setWhsalCd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs"
              placeholder="이름 해석이 안 될 때 시장 코드"
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <label className="block text-[11px] font-medium text-zinc-700">
            CMPCD (선택)
            <input
              value={cmpCd}
              onChange={(e) => setCmpCd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs"
              placeholder="법인 코드가 필요할 때"
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <p className="sm:col-span-2 text-[10px] leading-relaxed text-zinc-500">
            코드사전의 시장명과 입력 문자열이 다르면 <code className="rounded bg-zinc-100 px-0.5">whsalcd</code>가 비어
            오류가 납니다. 위에 짧은 키워드(예: 가락)를 쓰거나, 시장 코드를 직접 넣으세요. 목록은 데스크 API{" "}
            <code className="rounded bg-zinc-100 px-0.5">GET /api/desk/mafra/market-codes</code>로 확인할 수 있습니다.
          </p>
        </div>

        {tab === "raw" ? (
          <div className="space-y-2 rounded-xl border border-amber-100 bg-white/80 px-3 py-2.5">
            <p className="text-[10px] leading-relaxed text-zinc-700">
              기본은 <strong>정산 가격 정보와 같은 LARGE·MID·SMALL</strong>로 OpenAPI에 넘기고, 응답도 한 번 더 맞춰 해당
              품목 행만 남깁니다. 전체 시장 원천이 필요하면 아래 체크를 켜세요.
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700">
              <input
                type="checkbox"
                checked={rawAllProducts}
                onChange={(e) => setRawAllProducts(e.target.checked)}
                className="rounded border-zinc-300"
              />
              모든 품목 조회 (시장·일자만 — 품목 필터 없음)
            </label>
            {!rawAllProducts ? (
              <>
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700">
                  <input
                    type="checkbox"
                    checked={rawLooseSmall}
                    onChange={(e) => setRawLooseSmall(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  소분류 느슨 일치 (0건일 때만 의미 — 대·중 없이 SMALL/MMCD만 맞춤, 섞일 수 있음)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700">
                  <input
                    type="checkbox"
                    checked={rawKeywordOnly}
                    onChange={(e) => setRawKeywordOnly(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  표시만: GOODNAME/PUMNAME/CMPGOOD에「{productName}」포함 행
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        {tab === "info" || tab === "raw" ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-[11px] font-medium text-zinc-700">
              LARGE
              <input
                value={large}
                onChange={(e) => setLarge(e.target.value)}
                disabled={tab === "raw" && rawAllProducts}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs disabled:bg-zinc-100 disabled:text-zinc-500"
              />
            </label>
            <label className="block text-[11px] font-medium text-zinc-700">
              MID
              <input
                value={mid}
                onChange={(e) => setMid(e.target.value)}
                disabled={tab === "raw" && rawAllProducts}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs disabled:bg-zinc-100 disabled:text-zinc-500"
              />
            </label>
            <label className="block text-[11px] font-medium text-zinc-700">
              SMALL
              <input
                value={small}
                onChange={(e) => setSmall(e.target.value)}
                disabled={tab === "raw" && rawAllProducts}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs disabled:bg-zinc-100 disabled:text-zinc-500"
              />
            </label>
            <p className="sm:col-span-3 text-[10px] text-zinc-500">
              품목명「{productName}」로 SMALL 코드를 보조 해석합니다. 필요 시 직접 수정하세요.
              {tab === "raw" && !rawAllProducts ? (
                <span>
                  {" "}
                  LARGE·MID·SMALL이 모두 있으면 품목명 재해석 없이 저장 코드만 씁니다.
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runFetch()}
            className="rounded-xl bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 disabled:opacity-60"
          >
            {busy ? "조회 중…" : "데이터 조회"}
          </button>
          {metaMsg ? <span className="text-[11px] text-zinc-600">{metaMsg}</span> : null}
        </div>
        {resolvedHint ? (
          <p className="font-mono text-[10px] text-zinc-600">해석: {resolvedHint}</p>
        ) : null}
        {matchPolicyLine ? (
          <p className="text-[10px] text-zinc-600">원천 매칭: {matchPolicyLine}</p>
        ) : null}
        {matchDiagLine ? <p className="font-mono text-[10px] text-zinc-500">원천 진단: {matchDiagLine}</p> : null}
        {err ? <p className="text-sm text-red-600">{err}</p> : null}

        {tab === "market" ? (
          <div className="rounded-xl border border-amber-100 bg-white/80 px-3 py-2.5 text-[10px] leading-relaxed text-zinc-700">
            <p className="font-medium text-zinc-800">도매시장 집계가 의미하는 것</p>
            <p className="mt-1">
              이 그리드에는 품목(LARGE/MID/SMALL) 열이 <strong>없습니다</strong>. OpenAPI도 시장·등록일만 받습니다. 따라서
              TOTQTY·TOTAMT는 <strong>해당 도매시장 전체</strong>(명세상 집계 범위의 모든 농산물 등)에 대한 총물량·총금액으로
              보시면 됩니다. <strong>특정 품목(당근 등)만의 금액이 아닙니다.</strong>
            </p>
            <p className="mt-1.5 text-zinc-600">
              <strong>활용 예:</strong> 그날 시장 거래 규모·흐름을 참고할 때. 품목별 단가·품목별 원천 행은{" "}
              <strong>정산 가격 정보</strong>·<strong>원천</strong> 탭(기본: 품목 코드 동일)을 쓰세요.
            </p>
            {rows.length > 0 ? (
              <p className="mt-1.5 text-zinc-600">
                아래 숫자는 <strong>총물량(TOTQTY)</strong>·<strong>총금액(TOTAMT, 원)</strong>을 읽기 쉽게 끊어 표시한 것입니다.
              </p>
            ) : null}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="max-h-[420px] overflow-auto rounded-xl border border-zinc-200 bg-white">
            {tab === "raw" && rawKeywordOnly && productName.trim() && displayRows.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-amber-900">
                조회 {rows.length}건 중 GOODNAME/PUMNAME/CMPGOOD에「{productName.trim()}」가 포함된 행이 없습니다.
                체크를 해제하세요.
              </p>
            ) : null}
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-2 py-1.5 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {displayRows.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-50/80">
                    {columns.map((c) => (
                      <td key={c} className="whitespace-nowrap px-2 py-1 text-zinc-800 tabular-nums">
                        {formatMafraCell(c, row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !busy && !err ? (
          <p className="text-[11px] text-zinc-500">
            {lastFetchEmptyOk
              ? tab === "market"
                ? "조회는 완료되었으나 해당 등록일·시장에 맞는 행이 없습니다. 등록일(REGIST_DT)은 경매일과 하루 어긋날 수 있습니다."
                : "조회는 완료되었으나 해당 조건에 맞는 행이 없습니다. 경매일·품목(SMALL)·필터를 바꿔 보세요."
              : "「데이터 조회」로 결과를 불러오면 여기에 표시됩니다."}
          </p>
        ) : null}
      </div>
    </details>
  );
}
