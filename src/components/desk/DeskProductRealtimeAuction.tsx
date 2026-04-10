"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type MafraRealtimeAuctionItem = {
  SALEDATE: string;
  WHSALCD: string;
  WHSALNAME: string;
  CMPCD: string;
  CMPNAME: string;
  LARGE: string;
  LARGENAME: string;
  MID: string;
  MIDNAME: string;
  SMALL: string;
  SMALLNAME: string;
  SANCD: string;
  SANNAME: string;
  COST: string;
  QTY: string;
  STD: string;
  SBIDTIME: string;
};

type CodeNameRow = { CODEID: string; CODENAME: string };

type ApiOk = {
  ok: true;
  data?: {
    totalCount: number;
    rows: MafraRealtimeAuctionItem[];
    resolved?: { whsalcd: string | null; cmpcd: string | null; small: string | null };
  };
  message?: string;
};
type ApiErr = { ok: false; message?: string };

function yesterdayDateInputValue(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToYmd(iso: string): string {
  const t = iso.trim().replaceAll("-", "");
  return t.length === 8 ? t : "";
}

function dash(v: string | null | undefined): string {
  const t = v?.trim();
  return t ? t : "—";
}

type DeskProductRealtimeAuctionProps = {
  productId: string;
  savedMafraLarge: string | null;
  savedMafraMid: string | null;
  savedMafraSmall: string | null;
};

async function fetchCodeList(
  segment: "market-codes" | "corp-codes",
  forceSync: boolean,
): Promise<{ ok: true; items: CodeNameRow[]; message?: string } | { ok: false; error: string }> {
  const u = new URL(`/api/desk/mafra/${segment}`, window.location.origin);
  if (forceSync) u.searchParams.set("forceSync", "1");
  const res = await fetch(u.toString(), { credentials: "same-origin" });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: `서버 응답을 읽을 수 없습니다. (HTTP ${res.status})` };
  }
  const json = parsed as {
    ok?: boolean;
    message?: string;
    data?: { items?: CodeNameRow[] };
  };
  if (!res.ok || json.ok !== true) {
    return {
      ok: false,
      error:
        typeof json.message === "string" && json.message.length > 0
          ? json.message
          : `목록을 불러오지 못했습니다. (HTTP ${res.status})`,
    };
  }
  const items = json.data?.items;
  if (!Array.isArray(items)) {
    return { ok: false, error: "목록 형식이 올바르지 않습니다." };
  }
  return { ok: true, items, message: json.message };
}

export default function DeskProductRealtimeAuction({
  productId,
  savedMafraLarge,
  savedMafraMid,
  savedMafraSmall,
}: DeskProductRealtimeAuctionProps) {
  const [saleDateInput, setSaleDateInput] = useState(yesterdayDateInputValue);
  const [whsalName, setWhsalName] = useState("서울가락");
  const [cmpName, setCmpName] = useState("한국청과");
  const [marketFilter, setMarketFilter] = useState("");
  const [corpFilter, setCorpFilter] = useState("");
  const [marketRows, setMarketRows] = useState<CodeNameRow[]>([]);
  const [corpRows, setCorpRows] = useState<CodeNameRow[]>([]);
  const [listBusy, setListBusy] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);
  const [listNote, setListNote] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<MafraRealtimeAuctionItem[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [resolvedHint, setResolvedHint] = useState<string | null>(null);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);

  const saleYmd = useMemo(() => dateInputToYmd(saleDateInput), [saleDateInput]);

  const loadLists = useCallback(async (forceSync: boolean) => {
    setListBusy(true);
    setListErr(null);
    setListNote(null);
    try {
      const [mr, cr] = await Promise.all([
        fetchCodeList("market-codes", forceSync),
        fetchCodeList("corp-codes", forceSync),
      ]);
      const errs: string[] = [];
      if (!mr.ok) {
        errs.push(`시장: ${mr.error}`);
        setMarketRows([]);
      } else {
        setMarketRows(mr.items);
        if (typeof mr.message === "string" && /실패|이전/.test(mr.message)) {
          setListNote(mr.message);
        }
      }
      if (!cr.ok) {
        errs.push(`법인: ${cr.error}`);
        setCorpRows([]);
      } else {
        setCorpRows(cr.items);
        if (typeof cr.message === "string" && /실패|이전/.test(cr.message)) {
          const crMsg = cr.message;
          setListNote((n) => (n ? `${n} ${crMsg}` : crMsg));
        }
      }
      if (errs.length) setListErr(errs.join("\n"));
      if (mr.ok && mr.items.length === 0 && cr.ok && cr.items.length === 0) {
        setListNote(
          (n) =>
            n ??
            "시장·법인 목록이 비어 있습니다. 관리자에서 MAFRA 코드사전(도매시장·법인) 동기화를 실행했는지 확인해 주세요.",
        );
      }
    } catch {
      setListErr("시장·법인 목록을 불러오지 못했습니다.");
      setMarketRows([]);
      setCorpRows([]);
    } finally {
      setListBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadLists(false);
  }, [loadLists]);

  const filteredMarkets = useMemo(() => {
    const f = marketFilter.trim().toLowerCase();
    if (!f) return marketRows;
    return marketRows.filter(
      (r) => r.CODEID.toLowerCase().includes(f) || r.CODENAME.toLowerCase().includes(f),
    );
  }, [marketRows, marketFilter]);

  const filteredCorps = useMemo(() => {
    const f = corpFilter.trim().toLowerCase();
    if (!f) return corpRows;
    return corpRows.filter(
      (r) => r.CODEID.toLowerCase().includes(f) || r.CODENAME.toLowerCase().includes(f),
    );
  }, [corpRows, corpFilter]);

  /** datalist에 너무 많은 option을 넣지 않도록 상한 */
  const datalistMarkets = useMemo(() => filteredMarkets.slice(0, 400), [filteredMarkets]);
  const datalistCorps = useMemo(() => filteredCorps.slice(0, 400), [filteredCorps]);

  const fetchPrices = useCallback(async () => {
    const ymd = dateInputToYmd(saleDateInput);
    if (!/^\d{8}$/.test(ymd)) {
      setErr("기준일을 선택해 주세요.");
      setRows([]);
      return;
    }
    setBusy(true);
    setErr(null);
    setMetaMsg(null);
    setResolvedHint(null);
    try {
      const u = new URL(
        `/api/desk/products/${encodeURIComponent(productId)}/realtime-auction`,
        window.location.origin,
      );
      u.searchParams.set("saleDate", ymd);
      u.searchParams.set("whsalName", whsalName.trim());
      u.searchParams.set("cmpName", cmpName.trim());
      u.searchParams.set("startIndex", "1");
      u.searchParams.set("endIndex", "80");

      const w = marketRows.find((r) => r.CODENAME === whsalName.trim());
      const c = corpRows.find((r) => r.CODENAME === cmpName.trim());
      if (w?.CODEID) u.searchParams.set("whsalcd", w.CODEID);
      if (c?.CODEID) u.searchParams.set("cmpcd", c.CODEID);

      const res = await fetch(u.toString(), { credentials: "same-origin" });
      const json = (await res.json()) as ApiOk | ApiErr;
      if (!res.ok || json.ok !== true) {
        setErr(typeof json.message === "string" ? json.message : "조회에 실패했습니다.");
        setRows([]);
        setTotalCount(null);
        return;
      }
      const data = json.data;
      setRows(data?.rows ?? []);
      setTotalCount(typeof data?.totalCount === "number" ? data.totalCount : null);
      if (typeof json.message === "string" && json.message.length > 0) {
        setMetaMsg(json.message);
      }
      const r = data?.resolved;
      if (r) {
        setResolvedHint(
          `해석된 코드 — 시장 ${r.whsalcd ?? "—"} · 법인 ${r.cmpcd ?? "—"} · SMALL ${r.small ?? "—"}`,
        );
      }
    } catch {
      setErr("네트워크 오류로 조회하지 못했습니다.");
      setRows([]);
      setTotalCount(null);
    } finally {
      setBusy(false);
    }
  }, [productId, saleDateInput, whsalName, cmpName, marketRows, corpRows]);

  const hasSavedItem = Boolean(savedMafraSmall?.trim());

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-600">
        <strong className="font-semibold text-zinc-800">저장된 품목명·규격</strong>으로 농식품 소(SMALL)를 자동 맞춘 뒤 조회합니다.{" "}
        <strong className="font-semibold text-zinc-800">가락 API 명세 기준으로는 소(SMALL) 확정이 핵심</strong>이라, 「시세용 농식품 품목
        확정」으로 한 줄 저장해 두는 것을 권장합니다. 아래 대·중·소는 조회 해석 결과이며, 시장·법인은 동기화 목록에서 고르거나 직접 입력할 수
        있습니다.
      </p>

      <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-zinc-700">
        <span className="font-semibold text-zinc-800">이 조회에 쓰는 품목코드:</span> LARGE {dash(savedMafraLarge)} · MID{" "}
        {dash(savedMafraMid)} · SMALL {dash(savedMafraSmall)}
        {!hasSavedItem ? (
          <span className="text-emerald-900/90"> — DB에 없으면 품목명·규격으로 코드사전 자동 매칭.</span>
        ) : null}
      </div>

      {listErr ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
          <p className="break-words whitespace-pre-wrap leading-relaxed">{listErr}</p>
          {/INFO-100|인증에 실패|AUTH_ERROR/i.test(listErr) ? (
            <p className="mt-2 leading-relaxed">
              <Link href="/admin" className="font-semibold underline underline-offset-2 hover:text-amber-900">
                관리자
              </Link>
              → MAFRA → 코드사전 동기화(도매시장·법인) 후 아래 「목록 다시 받기」.
            </p>
          ) : null}
        </div>
      ) : null}
      {listNote ? <p className="text-[11px] leading-relaxed text-zinc-600">{listNote}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={listBusy}
          onClick={() => void loadLists(true)}
          className="text-[11px] font-semibold text-emerald-800 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {listBusy ? "시장·법인 목록 불러오는 중…" : "목록 다시 받기 (서버 동기화)"}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
        <label className="text-xs font-medium text-zinc-700">
          기준일
          <input
            type="date"
            value={saleDateInput}
            onChange={(e) => setSaleDateInput(e.target.value)}
            className="mt-1 block rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm"
          />
        </label>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <label className="text-xs font-medium text-zinc-700">시장명</label>
          <input
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
            placeholder="목록 좁히기 (이름·코드)"
            disabled={listBusy}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 shadow-sm disabled:opacity-60"
            autoComplete="off"
          />
          <input
            list="desk-rt-auction-whsal"
            value={whsalName}
            onChange={(e) => setWhsalName(e.target.value)}
            placeholder="예: 서울가락"
            disabled={listBusy}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm disabled:opacity-60"
            autoComplete="off"
          />
          <datalist id="desk-rt-auction-whsal">
            {datalistMarkets.map((r) => (
              <option key={r.CODEID} value={r.CODENAME} />
            ))}
          </datalist>
          <p className="text-[10px] text-zinc-500">
            {listBusy
              ? "…"
              : marketRows.length > 0
                ? `동기화 ${marketRows.length}건 · 아래 후보 ${datalistMarkets.length}건`
                : "목록 없음"}
          </p>
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <label className="text-xs font-medium text-zinc-700">법인명</label>
          <input
            value={corpFilter}
            onChange={(e) => setCorpFilter(e.target.value)}
            placeholder="목록 좁히기 (이름·코드)"
            disabled={listBusy}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 shadow-sm disabled:opacity-60"
            autoComplete="off"
          />
          <input
            list="desk-rt-auction-corp"
            value={cmpName}
            onChange={(e) => setCmpName(e.target.value)}
            placeholder="예: 한국청과"
            disabled={listBusy}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm disabled:opacity-60"
            autoComplete="off"
          />
          <datalist id="desk-rt-auction-corp">
            {datalistCorps.map((r) => (
              <option key={r.CODEID} value={r.CODENAME} />
            ))}
          </datalist>
          <p className="text-[10px] text-zinc-500">
            {listBusy
              ? "…"
              : corpRows.length > 0
                ? `동기화 ${corpRows.length}건 · 아래 후보 ${datalistCorps.length}건`
                : "목록 없음"}
          </p>
        </div>
        <button
          type="button"
          disabled={busy || !/^\d{8}$/.test(saleYmd)}
          onClick={() => void fetchPrices()}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50"
        >
          {busy ? "조회 중…" : "가격 조회"}
        </button>
      </div>

      {err ? <p className="text-xs text-amber-800">{err}</p> : null}
      {metaMsg ? <p className="text-xs text-zinc-600">{metaMsg}</p> : null}
      {resolvedHint ? <p className="text-[11px] text-zinc-500">{resolvedHint}</p> : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-semibold">기준일</th>
                <th className="px-3 py-2 font-semibold">시장</th>
                <th className="px-3 py-2 font-semibold">법인</th>
                <th className="px-3 py-2 font-semibold">품목</th>
                <th className="px-3 py-2 font-semibold">단가</th>
                <th className="px-3 py-2 font-semibold">수량</th>
                <th className="px-3 py-2 font-semibold">규격</th>
                <th className="px-3 py-2 font-semibold">경락시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row, i) => (
                <tr key={`${row.SBIDTIME}-${row.COST}-${row.SMALL}-${i}`} className="hover:bg-zinc-50/80">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-700">{row.SALEDATE}</td>
                  <td className="px-3 py-2 text-xs text-zinc-800">{row.WHSALNAME || row.WHSALCD}</td>
                  <td className="px-3 py-2 text-xs text-zinc-800">{row.CMPNAME || row.CMPCD}</td>
                  <td className="px-3 py-2 text-xs text-zinc-800">
                    <span className="font-mono text-[11px] text-zinc-500">{row.SMALL}</span>{" "}
                    {row.SMALLNAME || row.MIDNAME || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-emerald-900">{row.COST}</td>
                  <td className="px-3 py-2 text-xs text-zinc-700">{row.QTY}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">{row.STD}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-zinc-600">{row.SBIDTIME}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalCount != null && totalCount > rows.length ? (
            <p className="border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500">
              전체 {totalCount}건 중 {rows.length}건만 표시했습니다. 범위를 늘리려면 이후 버전에서 조정할 수 있습니다.
            </p>
          ) : null}
        </div>
      ) : !busy && !err ? (
        <p className="text-sm text-zinc-500">「가격 조회」를 누르면 결과가 여기에 표시됩니다.</p>
      ) : null}
    </div>
  );
}
