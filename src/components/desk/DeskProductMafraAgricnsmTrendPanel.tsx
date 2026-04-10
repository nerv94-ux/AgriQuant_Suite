"use client";

import { useCallback, useMemo, useState } from "react";

type TrendRow = Record<string, string>;

type Props = {
  productName: string;
};

const TREND_LAST_YEAR = 2024;
const TREND_FIRST_YEAR = 2021;

function currentYearMonth() {
  const d = new Date();
  if (d.getFullYear() > TREND_LAST_YEAR) {
    return {
      year: String(TREND_LAST_YEAR),
      month: "12",
    };
  }
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1).padStart(2, "0"),
  };
}

function asWon(v: string): string {
  const n = Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return v || "—";
  return `${Math.trunc(n).toLocaleString("ko-KR")}원`;
}

function ymToInt(year: string, month: string): number | null {
  if (!/^\d{4}$/.test(year)) return null;
  const m = month.padStart(2, "0");
  if (!/^(0[1-9]|1[0-2])$/.test(m)) return null;
  return Number(`${year}${m}`);
}

function rowYmToInt(row: TrendRow): number | null {
  const y = String(row.CRTR_YEAR ?? row.crtr_year ?? "").trim();
  const mRaw = String(row.CRTR_MONTH ?? row.crtr_month ?? "").trim();
  const m = /^\d{1,2}$/.test(mRaw) ? mRaw.padStart(2, "0") : mRaw;
  return ymToInt(y, m);
}

function normalizeText(v: string): string {
  return v.toLowerCase().replace(/\s+/g, "");
}

function collectColumns(rows: TrendRow[]): string[] {
  const preferred = [
    "CRTR_YEAR",
    "CRTR_MONTH",
    "CLSF_NM",
    "ITEM_NM",
    "AVG_AMT",
    "MON_AVG_AMT",
    "MON_MAX_AMT",
    "MON_MIN_AMT",
    "MON_PRCHS_AMT",
    "MON_PRCHS_NOCS",
    "ESTMTN_NTSL_QTY",
    "ESTMTN_SLS_AMT",
    "REG_DT",
    "UPD_DT",
  ];
  const set = new Set<string>();
  for (const row of rows.slice(0, 200)) {
    for (const key of Object.keys(row)) set.add(key);
  }
  const ordered = preferred.filter((k) => set.has(k));
  const rest = [...set].filter((k) => !preferred.includes(k)).sort();
  return [...ordered, ...rest];
}

function isLikelyMoneyKey(key: string): boolean {
  return /amt|price|cost|금액|가격/i.test(key);
}

const COLUMN_LABEL_KO: Record<string, string> = {
  CRTR_YEAR: "기준연도",
  CRTR_MONTH: "기준월",
  CLSF_NM: "분류명",
  ITEM_NM: "품목명",
  MON_PRCHS_AMT: "월구매금액",
  MON_PRCHS_NOCS: "월구매건수",
  MON_PRCHS_NOCS_AMT: "월구매건당금액",
  ESTMTN_NTSL_QTY: "예상순판매수량",
  AVG_AMT: "평균금액",
  ESTMTN_SLS_AMT: "예상판매금액",
  MON_AVG_AMT: "월평균금액",
  MON_AMPL_CFFCNT: "월진폭계수",
  MON_FLCTN_CFFCNT: "월변동계수",
  MON_MAX_AMT: "월최대금액",
  MON_MIN_AMT: "월최소금액",
  MON_SDVTN: "월표준편차",
  YEAR_AVG_AMT: "연평균금액",
  YEAR_AMPL_CFFCNT: "연진폭계수",
  YEAR_FLCTN_CFFCNT: "연변동계수",
  YEAR_MAX_AMT: "연최대금액",
  YEAR_MIN_AMT: "연최소금액",
  YEAR_SDVTN: "연표준편차",
  REG_DT: "등록일시",
  REG_USERID: "등록자",
  UPD_DT: "수정일시",
  UPD_USERID: "수정자",
};

function labelForColumn(key: string): string {
  const hit = COLUMN_LABEL_KO[key];
  if (hit) return hit;
  // 매핑이 없는 확장 컬럼은 KEY를 사람이 읽기 쉬운 형태로 폴백한다.
  if (key.includes("_")) return key.toLowerCase().replace(/_/g, " ");
  return key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export default function DeskProductMafraAgricnsmTrendPanel({ productName }: Props) {
  const ym = useMemo(currentYearMonth, []);
  const [fromYm, setFromYm] = useState(`${ym.year}-01`);
  const [toYm, setToYm] = useState(`${ym.year}-${ym.month}`);
  const [contains, setContains] = useState(productName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [queried, setQueried] = useState(false);

  const runFetch = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setMetaMsg(null);
    setRows([]);
    setTotalCount(null);
    setQueried(false);
    try {
      const years = [TREND_FIRST_YEAR, TREND_FIRST_YEAR + 1, TREND_FIRST_YEAR + 2, TREND_LAST_YEAR];
      const reqs = years.map(async (y) => {
        const u = new URL("/api/desk/mafra/agricnsm-trnd/list", window.location.origin);
        u.searchParams.set("CRTR_YEAR", String(y));
        u.searchParams.set("startIndex", "1");
        u.searchParams.set("endIndex", "1000");
        u.searchParams.set("fetchAll", "1");
        const res = await fetch(u.toString(), { credentials: "same-origin" });
        const json = (await res.json()) as {
          ok?: boolean;
          message?: string;
          data?: { rows?: TrendRow[]; totalCount?: number };
        };
        return { res, json, year: y };
      });
      const out = await Promise.all(reqs);
      const merged: TrendRow[] = [];
      let sumTotal = 0;
      for (const one of out) {
        if (!one.res.ok || one.json.ok !== true || !one.json.data) {
          setErr(typeof one.json.message === "string" ? one.json.message : `트렌드 조회 실패 (${one.year})`);
          setQueried(true);
          return;
        }
        const list = Array.isArray(one.json.data.rows) ? one.json.data.rows : [];
        merged.push(...list);
        if (typeof one.json.data.totalCount === "number") sumTotal += one.json.data.totalCount;
      }
      setRows(merged);
      setTotalCount(sumTotal || merged.length);
      setMetaMsg(`최근 3년(${years.join(", ")}) 전체 조회 ${merged.length}건`);
      setQueried(true);
    } catch {
      setErr("네트워크 오류로 조회하지 못했습니다.");
      setQueried(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const filteredRows = useMemo(() => {
    const fromInt = /^\d{4}-\d{2}$/.test(fromYm) ? Number(fromYm.replace("-", "")) : null;
    const toInt = /^\d{4}-\d{2}$/.test(toYm) ? Number(toYm.replace("-", "")) : null;
    const needle = normalizeText(contains.trim());
    return rows.filter((row) => {
      const ymInt = rowYmToInt(row);
      if (fromInt != null && (ymInt == null || ymInt < fromInt)) return false;
      if (toInt != null && (ymInt == null || ymInt > toInt)) return false;
      if (!needle) return true;
      return Object.values(row).some((v) => normalizeText(String(v ?? "")).includes(needle));
    });
  }, [rows, fromYm, toYm, contains]);

  const columns = useMemo(() => collectColumns(filteredRows), [filteredRows]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 px-3 py-2 text-[11px] leading-relaxed text-violet-950">
        명세 `Grid_20260128000000000689_1`(소매가격정보·소비 트렌드 결합) 조회입니다. 월별 구매·추정판매·변동 통계가 내려오며,
        서버가 주는 컬럼을 최대한 원본 그대로 표시합니다(지역/연령/성별 등 확장 필드 포함).
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <label className="block text-[11px] font-medium text-zinc-700">
          표시 시작월(기간)
          <input
            type="month"
            value={fromYm}
            onChange={(e) => setFromYm(e.target.value)}
            min={`${TREND_FIRST_YEAR}-01`}
            max={`${TREND_LAST_YEAR}-12`}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs"
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-700">
          표시 종료월(기간)
          <input
            type="month"
            value={toYm}
            onChange={(e) => setToYm(e.target.value)}
            min={`${TREND_FIRST_YEAR}-01`}
            max={`${TREND_LAST_YEAR}-12`}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs"
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-700 sm:col-span-2">
          포함 검색(품목/지역/성별/연령 등 전체 컬럼)
          <input
            value={contains}
            onChange={(e) => setContains(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs"
            placeholder="예: 당근, 여성, 30대, 서울"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void runFetch()}
          disabled={busy}
          className="rounded-xl bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
        >
          {busy ? "조회 중…" : "트렌드 조회"}
        </button>
        {metaMsg ? <span className="text-[11px] text-zinc-600">{metaMsg}</span> : null}
        {queried ? (
          <span className="text-[11px] text-zinc-600">
            원본 {rows.length}건 / 기간·검색 적용 {filteredRows.length}건
          </span>
        ) : null}
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {filteredRows.length > 0 ? (
        <div className="max-h-[420px] overflow-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">
              <tr>
                {columns.map((k) => (
                  <th key={k} title={k} className="whitespace-nowrap px-2 py-1.5 font-semibold">
                    {labelForColumn(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.map((r, i) => (
                <tr key={`${r.ROW_NUM ?? i}-${i}`} className="hover:bg-zinc-50/80">
                  {columns.map((k) => {
                    const raw = String(r[k] ?? "").trim();
                    const val = isLikelyMoneyKey(k) ? asWon(raw) : raw || "—";
                    return (
                      <td key={`${k}-${i}`} className="whitespace-nowrap px-2 py-1 text-zinc-800">
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {totalCount != null && totalCount > rows.length ? (
            <p className="border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500">
              전체 {totalCount}건 중 {rows.length}건 표시입니다.
            </p>
          ) : null}
        </div>
      ) : !busy && queried && !err ? (
        <p className="text-[11px] text-zinc-500">
          조회 결과가 없습니다. 표시 기간(시작·종료월) 또는 포함 검색어를 조정해 보세요.
        </p>
      ) : !busy && !err ? (
        <p className="text-[11px] text-zinc-500">
          「트렌드 조회」를 누르면 2021~2024 전체 결과가 표시됩니다.
        </p>
      ) : null}
    </div>
  );
}

