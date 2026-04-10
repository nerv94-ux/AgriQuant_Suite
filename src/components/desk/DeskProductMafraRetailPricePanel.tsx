"use client";

import { useCallback, useMemo, useState } from "react";

type MafraRetailRow = {
  ROW_NUM: string;
  EXAMIN_DE: string;
  FRMPRD_CATGORY_NM: string;
  FRMPRD_CATGORY_CD: string;
  PRDLST_CD: string;
  PRDLST_NM: string;
  SPCIES_CD: string;
  SPCIES_NM: string;
  GRAD_CD: string;
  GRAD_NM: string;
  EXAMIN_UNIT: string;
  AREA_CD: string;
  AREA_NM: string;
  MRKT_CD: string;
  MRKT_NM: string;
  AMT: string;
};

type RetailSuggestRow = {
  ctgryCd: string;
  itemCd: string;
  speciesCd: string;
  itemName: string;
  speciesName: string;
  count: number;
};

type Props = {
  defaultCtgryCd?: string | null;
  defaultItemCd?: string | null;
  defaultSpeciesCd?: string | null;
  productName: string;
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

function asWon(v: string): string {
  const n = Number(String(v).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return v || "—";
  return `${Math.trunc(n).toLocaleString("ko-KR")}원`;
}

export default function DeskProductMafraRetailPricePanel({
  defaultCtgryCd,
  defaultItemCd,
  defaultSpeciesCd,
  productName,
}: Props) {
  const [examinDe, setExaminDe] = useState(todayYmd);
  const [ctgryCd, setCtgryCd] = useState(defaultCtgryCd ?? "");
  const [itemCd, setItemCd] = useState(defaultItemCd ?? "");
  const [speciesCd, setSpeciesCd] = useState(defaultSpeciesCd ?? "");
  const [gradCd, setGradCd] = useState("");
  const [areaCd, setAreaCd] = useState("");
  const [mrktCd, setMrktCd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<MafraRetailRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [queried, setQueried] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestRows, setSuggestRows] = useState<RetailSuggestRow[]>([]);
  const [suggestHint, setSuggestHint] = useState<string | null>(null);
  const [suggestMeta, setSuggestMeta] = useState<string | null>(null);

  const runSuggest = useCallback(async () => {
    if (!/^\d{8}$/.test(examinDe.trim())) {
      setSuggestHint("조사일(examinDe)을 먼저 올바르게 입력해 주세요.");
      return [];
    }
    setSuggestBusy(true);
    setSuggestHint(null);
    setSuggestMeta(null);
    try {
      const u = new URL("/api/desk/mafra/rtlsal-price/suggest", window.location.origin);
      u.searchParams.set("examinDe", examinDe.trim());
      u.searchParams.set("keyword", productName.trim());
      const res = await fetch(u.toString(), { credentials: "same-origin" });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          suggestions?: RetailSuggestRow[];
          searchedDates?: string[];
          sampledRows?: number;
          hint?: string | null;
        };
      };
      if (!res.ok || json.ok !== true || !json.data) {
        setSuggestRows([]);
        setSuggestHint(typeof json.message === "string" ? json.message : "소매 코드 후보 조회에 실패했습니다.");
        return [];
      }
      const list = Array.isArray(json.data.suggestions) ? json.data.suggestions : [];
      setSuggestRows(list);
      setSuggestHint(typeof json.data.hint === "string" ? json.data.hint : null);
      const sampled = typeof json.data.sampledRows === "number" ? json.data.sampledRows : 0;
      const dates = Array.isArray(json.data.searchedDates) ? json.data.searchedDates.length : 0;
      setSuggestMeta(`후보 ${list.length}건 · 샘플 ${sampled}행 · 검사일 ${dates}일`);
      return list;
    } catch {
      setSuggestRows([]);
      setSuggestHint("네트워크 오류로 소매 코드 후보를 가져오지 못했습니다.");
      return [];
    } finally {
      setSuggestBusy(false);
    }
  }, [examinDe, productName]);

  const runFetch = useCallback(async () => {
    if (!/^\d{8}$/.test(examinDe.trim())) {
      setErr("조사일(examinDe)은 YYYYMMDD 형식이어야 합니다.");
      setRows([]);
      setTotalCount(null);
      setQueried(true);
      return;
    }
    setBusy(true);
    setErr(null);
    setMetaMsg(null);
    setRows([]);
    setTotalCount(null);
    setQueried(false);
    try {
      const u = new URL("/api/desk/mafra/rtlsal-price/list", window.location.origin);
      u.searchParams.set("examinDe", examinDe.trim());
      u.searchParams.set("FRMPRD_CATGORY_CD", ctgryCd.trim());
      u.searchParams.set("PRDLST_CD", itemCd.trim());
      u.searchParams.set("SPCIES_CD", speciesCd.trim());
      u.searchParams.set("GRAD_CD", gradCd.trim());
      u.searchParams.set("AREA_CD", areaCd.trim());
      u.searchParams.set("MRKT_CD", mrktCd.trim());
      u.searchParams.set("startIndex", "1");
      u.searchParams.set("endIndex", "120");
      const res = await fetch(u.toString(), { credentials: "same-origin" });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          rows?: MafraRetailRow[];
          totalCount?: number;
        };
      };
      if (!res.ok || json.ok !== true || !json.data) {
        setErr(typeof json.message === "string" ? json.message : "소매가격 조회에 실패했습니다.");
        setQueried(true);
        return;
      }
      const list = Array.isArray(json.data.rows) ? json.data.rows : [];
      setRows(list);
      setTotalCount(typeof json.data.totalCount === "number" ? json.data.totalCount : null);
      if (typeof json.message === "string" && json.message.trim()) {
        setMetaMsg(json.message.trim());
      }
      const noCoreCodes = !ctgryCd.trim() && !itemCd.trim() && !speciesCd.trim();
      if (list.length === 0 && noCoreCodes) {
        const suggested = await runSuggest();
        const first = suggested[0];
        if (first) {
          setCtgryCd(first.ctgryCd);
          setItemCd(first.itemCd);
          setSpeciesCd(first.speciesCd);
          const u2 = new URL("/api/desk/mafra/rtlsal-price/list", window.location.origin);
          u2.searchParams.set("examinDe", examinDe.trim());
          u2.searchParams.set("FRMPRD_CATGORY_CD", first.ctgryCd);
          u2.searchParams.set("PRDLST_CD", first.itemCd);
          u2.searchParams.set("SPCIES_CD", first.speciesCd);
          u2.searchParams.set("GRAD_CD", gradCd.trim());
          u2.searchParams.set("AREA_CD", areaCd.trim());
          u2.searchParams.set("MRKT_CD", mrktCd.trim());
          u2.searchParams.set("startIndex", "1");
          u2.searchParams.set("endIndex", "120");
          const res2 = await fetch(u2.toString(), { credentials: "same-origin" });
          const json2 = (await res2.json()) as {
            ok?: boolean;
            message?: string;
            data?: { rows?: MafraRetailRow[]; totalCount?: number };
          };
          if (res2.ok && json2.ok === true && json2.data) {
            const list2 = Array.isArray(json2.data.rows) ? json2.data.rows : [];
            setRows(list2);
            setTotalCount(typeof json2.data.totalCount === "number" ? json2.data.totalCount : null);
            setMetaMsg(
              `0건으로 자동 추천 코드 적용 후 재조회: ${first.ctgryCd}-${first.itemCd}-${first.speciesCd} (${list2.length}건)`,
            );
          } else {
            setMetaMsg(
              `0건으로 자동 추천 코드 적용: ${first.ctgryCd}-${first.itemCd}-${first.speciesCd} (${first.itemName} ${first.speciesName})`,
            );
          }
        }
      }
      setQueried(true);
    } catch {
      setErr("네트워크 오류로 조회하지 못했습니다.");
      setQueried(true);
    } finally {
      setBusy(false);
    }
  }, [examinDe, ctgryCd, itemCd, speciesCd, gradCd, areaCd, mrktCd, runSuggest]);

  const onPickSuggestion = useCallback((s: RetailSuggestRow) => {
    setCtgryCd(s.ctgryCd);
    setItemCd(s.itemCd);
    setSpeciesCd(s.speciesCd);
    setMetaMsg(`추천 코드 적용: ${s.ctgryCd}-${s.itemCd}-${s.speciesCd} (${s.itemName} ${s.speciesName})`);
  }, []);

  const topHint = useMemo(() => {
    const parts = [`품목명: ${productName}`];
    if (ctgryCd.trim()) parts.push(`부류 ${ctgryCd.trim()}`);
    if (itemCd.trim()) parts.push(`품목 ${itemCd.trim()}`);
    if (speciesCd.trim()) parts.push(`품종 ${speciesCd.trim()}`);
    return parts.join(" · ");
  }, [productName, ctgryCd, itemCd, speciesCd]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 px-3 py-2 text-[11px] leading-relaxed text-sky-950">
        명세 `Grid_20141225000000000163_1` 기준 소매가격(조사) 조회입니다. 조사일(`EXAMIN_DE`)은 필수이고,
        품목이 넓게 섞이면 부류·품목·품종 코드를 함께 넣어 좁히세요.
      </div>
      <p className="text-[11px] text-zinc-600">{topHint}</p>
      <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 text-[11px] leading-relaxed text-sky-950">
        0건이면 품목명 「{productName}」 기준으로 최근 조사일 샘플에서 코드 후보를 자동 탐색합니다.
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runSuggest()}
            disabled={suggestBusy || busy}
            className="rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-60"
          >
            {suggestBusy ? "후보 탐색 중…" : "품목명으로 소매 코드 후보 찾기"}
          </button>
          {suggestMeta ? <span className="text-[11px] text-sky-800/90">{suggestMeta}</span> : null}
        </div>
        {suggestHint ? <p className="mt-1.5 text-amber-900">{suggestHint}</p> : null}
        {suggestRows.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestRows.map((s) => (
              <button
                key={`${s.ctgryCd}-${s.itemCd}-${s.speciesCd}-${s.itemName}-${s.speciesName}`}
                type="button"
                onClick={() => onPickSuggestion(s)}
                className="rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-[11px] text-sky-900 hover:bg-sky-100"
              >
                {`${s.itemName || "품목"} ${s.speciesName || ""}`.trim()} · {s.ctgryCd}-{s.itemCd}-{s.speciesCd} ({s.count}건)
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-[11px] font-medium text-zinc-700">
          조사일(EXAMIN_DE)
          <input
            type="date"
            value={ymdToDateValue(examinDe)}
            onChange={(e) => setExaminDe(dateValueToYmd(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-700">
          부류(FRMPRD_CATGORY_CD)
          <input
            value={ctgryCd}
            onChange={(e) => setCtgryCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs"
            placeholder="예: 200"
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-700">
          품목(PRDLST_CD)
          <input
            value={itemCd}
            onChange={(e) => setItemCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs"
            placeholder="예: 112"
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-700">
          품종(SPCIES_CD)
          <input
            value={speciesCd}
            onChange={(e) => setSpeciesCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs"
            placeholder="예: 01"
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-700">
          등급(GRAD_CD)
          <input
            value={gradCd}
            onChange={(e) => setGradCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs"
            placeholder="선택"
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-700">
          지역(AREA_CD)
          <input
            value={areaCd}
            onChange={(e) => setAreaCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs"
            placeholder="선택"
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-700">
          시장(MRKT_CD)
          <input
            value={mrktCd}
            onChange={(e) => setMrktCd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 font-mono text-xs"
            placeholder="선택"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void runFetch()}
          disabled={busy}
          className="rounded-xl bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {busy ? "조회 중…" : "소매가격 조회"}
        </button>
        {metaMsg ? <span className="text-[11px] text-zinc-600">{metaMsg}</span> : null}
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {rows.length > 0 ? (
        <div className="max-h-[420px] overflow-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">
              <tr>
                {[
                  "EXAMIN_DE",
                  "FRMPRD_CATGORY_NM",
                  "PRDLST_NM",
                  "SPCIES_NM",
                  "GRAD_NM",
                  "EXAMIN_UNIT",
                  "AREA_NM",
                  "MRKT_NM",
                  "AMT",
                  "코드",
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r, i) => (
                <tr key={`${r.ROW_NUM}-${i}`} className="hover:bg-zinc-50/80">
                  <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{r.EXAMIN_DE || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{r.FRMPRD_CATGORY_NM || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{r.PRDLST_NM || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{r.SPCIES_NM || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{r.GRAD_NM || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{r.EXAMIN_UNIT || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{r.AREA_NM || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{r.MRKT_NM || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{asWon(r.AMT)}</td>
                  <td className="whitespace-nowrap px-2 py-1 font-mono text-[10px] text-zinc-600">
                    {`${r.FRMPRD_CATGORY_CD || "-"}-${r.PRDLST_CD || "-"}-${r.SPCIES_CD || "-"}-${r.GRAD_CD || "-"}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalCount != null && totalCount > rows.length ? (
            <p className="border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500">
              전체 {totalCount}건 중 {rows.length}건 표시입니다. 필터를 추가해 좁혀 보세요.
            </p>
          ) : null}
        </div>
      ) : !busy && queried && !err ? (
        <p className="text-[11px] text-zinc-500">
          조회 결과가 없습니다. 조사일(EXAMIN_DE)과 코드(부류·품목·품종)를 조정해 보세요.
        </p>
      ) : !busy && !err ? (
        <p className="text-[11px] text-zinc-500">「소매가격 조회」를 누르면 결과가 표시됩니다.</p>
      ) : null}
    </div>
  );
}

