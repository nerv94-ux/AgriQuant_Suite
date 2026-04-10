"use client";

import type { MafraItemCode } from "@/components/common/api/server/connectors/mafra-item-code/types";
import type { MafraUnitCode } from "@/components/common/api/server/connectors/mafra-unit-code/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function str(v: string | null): string {
  return v ?? "";
}

/** 등급·포장·단위 공통 CODEID 행 */
type MafraCodeIdRow = { CODEID: string; CODENAME: string };

type DeskProductMafraCodesEditorProps = {
  productId: string;
  initialMafraLarge: string | null;
  initialMafraMid: string | null;
  initialMafraSmall: string | null;
  initialMafraUnitCodeId: string | null;
  initialMafraGrdCodeId: string | null;
  initialMafraFrmlCodeId: string | null;
};

type ApiOk<T> = { ok: true; data: T; message?: string };
type ApiErr = { ok: false; message: string; data?: null };

async function fetchMafraSearch(kind: "item", query: string, forceSync: boolean) {
  const u = new URL("/api/desk/mafra/search", window.location.origin);
  u.searchParams.set("kind", kind);
  u.searchParams.set("query", query);
  if (forceSync) u.searchParams.set("forceSync", "1");
  const res = await fetch(u.toString(), { credentials: "same-origin" });
  return (await res.json()) as ApiOk<unknown> | ApiErr;
}

async function fetchDeskMafraCodeList(
  segment: "unit-codes" | "grd-codes" | "frml-codes",
  forceSync: boolean,
): Promise<
  { ok: true; items: MafraCodeIdRow[]; message?: string } | { ok: false; error: string }
> {
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
    data?: { items?: MafraCodeIdRow[] };
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
  if (!json.data) {
    return { ok: false, error: "목록을 불러오지 못했습니다." };
  }
  const items = json.data.items;
  if (!Array.isArray(items)) {
    return { ok: false, error: "목록 형식이 올바르지 않습니다." };
  }
  return { ok: true, items, message: json.message };
}

export default function DeskProductMafraCodesEditor({
  productId,
  initialMafraLarge,
  initialMafraMid,
  initialMafraSmall,
  initialMafraUnitCodeId,
  initialMafraGrdCodeId,
  initialMafraFrmlCodeId,
}: DeskProductMafraCodesEditorProps) {
  const router = useRouter();
  const [mafraLarge, setMafraLarge] = useState(str(initialMafraLarge));
  const [mafraMid, setMafraMid] = useState(str(initialMafraMid));
  const [mafraSmall, setMafraSmall] = useState(str(initialMafraSmall));
  const [mafraUnitCodeId, setMafraUnitCodeId] = useState(str(initialMafraUnitCodeId));
  const [mafraGrdCodeId, setMafraGrdCodeId] = useState(str(initialMafraGrdCodeId));
  const [mafraFrmlCodeId, setMafraFrmlCodeId] = useState(str(initialMafraFrmlCodeId));

  useEffect(() => {
    setMafraLarge(str(initialMafraLarge));
    setMafraMid(str(initialMafraMid));
    setMafraSmall(str(initialMafraSmall));
    setMafraUnitCodeId(str(initialMafraUnitCodeId));
    setMafraGrdCodeId(str(initialMafraGrdCodeId));
    setMafraFrmlCodeId(str(initialMafraFrmlCodeId));
  }, [
    initialMafraLarge,
    initialMafraMid,
    initialMafraSmall,
    initialMafraUnitCodeId,
    initialMafraGrdCodeId,
    initialMafraFrmlCodeId,
  ]);

  const [itemQ, setItemQ] = useState("");
  const [itemBusy, setItemBusy] = useState(false);
  const [itemErr, setItemErr] = useState<string | null>(null);
  const [itemRows, setItemRows] = useState<MafraItemCode[]>([]);

  const [unitOptions, setUnitOptions] = useState<MafraUnitCode[]>([]);
  const [unitListBusy, setUnitListBusy] = useState(true);
  const [unitListErr, setUnitListErr] = useState<string | null>(null);
  const [unitListNote, setUnitListNote] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState("");

  const [grdOptions, setGrdOptions] = useState<MafraCodeIdRow[]>([]);
  const [grdListBusy, setGrdListBusy] = useState(true);
  const [grdListErr, setGrdListErr] = useState<string | null>(null);
  const [grdListNote, setGrdListNote] = useState<string | null>(null);
  const [grdFilter, setGrdFilter] = useState("");

  const [frmlOptions, setFrmlOptions] = useState<MafraCodeIdRow[]>([]);
  const [frmlListBusy, setFrmlListBusy] = useState(true);
  const [frmlListErr, setFrmlListErr] = useState<string | null>(null);
  const [frmlListNote, setFrmlListNote] = useState<string | null>(null);
  const [frmlFilter, setFrmlFilter] = useState("");

  const [pending, setPending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const loadUnitList = useCallback(async (forceSync: boolean) => {
    setUnitListBusy(true);
    setUnitListErr(null);
    setUnitListNote(null);
    try {
      const r = await fetchDeskMafraCodeList("unit-codes", forceSync);
      if (!r.ok) {
        setUnitListErr(r.error);
        setUnitOptions([]);
        return;
      }
      setUnitOptions(r.items as MafraUnitCode[]);
      if (typeof r.message === "string" && /실패|이전/.test(r.message)) {
        setUnitListNote(r.message);
      } else if (r.items.length === 0) {
        setUnitListNote(
          "단위 목록이 비어 있습니다. 관리자에서 MAFRA(가락) API 키를 저장한 뒤 단위코드 동기화를 실행했는지 확인해 주세요.",
        );
      }
    } catch {
      setUnitListErr("네트워크 오류이거나 서버에 연결하지 못했습니다.");
      setUnitOptions([]);
    } finally {
      setUnitListBusy(false);
    }
  }, []);

  const loadGrdList = useCallback(async (forceSync: boolean) => {
    setGrdListBusy(true);
    setGrdListErr(null);
    setGrdListNote(null);
    try {
      const r = await fetchDeskMafraCodeList("grd-codes", forceSync);
      if (!r.ok) {
        setGrdListErr(r.error);
        setGrdOptions([]);
        return;
      }
      setGrdOptions(r.items);
      if (typeof r.message === "string" && /실패|이전/.test(r.message)) {
        setGrdListNote(r.message);
      } else if (r.items.length === 0) {
        setGrdListNote(
          "등급 목록이 비어 있습니다. 관리자에서 코드사전 동기화(등급)를 실행했는지 확인해 주세요.",
        );
      }
    } catch {
      setGrdListErr("네트워크 오류이거나 서버에 연결하지 못했습니다.");
      setGrdOptions([]);
    } finally {
      setGrdListBusy(false);
    }
  }, []);

  const loadFrmlList = useCallback(async (forceSync: boolean) => {
    setFrmlListBusy(true);
    setFrmlListErr(null);
    setFrmlListNote(null);
    try {
      const r = await fetchDeskMafraCodeList("frml-codes", forceSync);
      if (!r.ok) {
        setFrmlListErr(r.error);
        setFrmlOptions([]);
        return;
      }
      setFrmlOptions(r.items);
      if (typeof r.message === "string" && /실패|이전/.test(r.message)) {
        setFrmlListNote(r.message);
      } else if (r.items.length === 0) {
        setFrmlListNote(
          "포장 목록이 비어 있습니다. 관리자에서 코드사전 동기화(포장)를 실행했는지 확인해 주세요.",
        );
      }
    } catch {
      setFrmlListErr("네트워크 오류이거나 서버에 연결하지 못했습니다.");
      setFrmlOptions([]);
    } finally {
      setFrmlListBusy(false);
    }
  }, []);

  /** 단위·등급·포장 동기화를 동시에 호출하면 가락 API가 INFO-100 등으로 거부하는 경우가 있어 순차 실행 */
  useEffect(() => {
    let cancelled = false;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    void (async () => {
      await loadUnitList(false);
      if (cancelled) return;
      await delay(350);
      await loadGrdList(false);
      if (cancelled) return;
      await delay(350);
      await loadFrmlList(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadUnitList, loadGrdList, loadFrmlList]);

  const filteredUnitOptions = useMemo(() => {
    const f = unitFilter.trim().toLowerCase();
    if (!f) return unitOptions;
    return unitOptions.filter(
      (u) => u.CODEID.toLowerCase().includes(f) || u.CODENAME.toLowerCase().includes(f),
    );
  }, [unitOptions, unitFilter]);

  const filteredGrdOptions = useMemo(() => {
    const f = grdFilter.trim().toLowerCase();
    if (!f) return grdOptions;
    return grdOptions.filter(
      (u) => u.CODEID.toLowerCase().includes(f) || u.CODENAME.toLowerCase().includes(f),
    );
  }, [grdOptions, grdFilter]);

  const filteredFrmlOptions = useMemo(() => {
    const f = frmlFilter.trim().toLowerCase();
    if (!f) return frmlOptions;
    return frmlOptions.filter(
      (u) => u.CODEID.toLowerCase().includes(f) || u.CODENAME.toLowerCase().includes(f),
    );
  }, [frmlOptions, frmlFilter]);

  const unitOrphan =
    Boolean(mafraUnitCodeId) && !unitOptions.some((u) => u.CODEID === mafraUnitCodeId);
  const grdOrphan =
    Boolean(mafraGrdCodeId) && !grdOptions.some((u) => u.CODEID === mafraGrdCodeId);
  const frmlOrphan =
    Boolean(mafraFrmlCodeId) && !frmlOptions.some((u) => u.CODEID === mafraFrmlCodeId);

  const searchItem = useCallback(async () => {
    const q = itemQ.trim();
    if (!q) {
      setItemErr("검색어를 입력해 주세요.");
      setItemRows([]);
      return;
    }
    setItemBusy(true);
    setItemErr(null);
    try {
      const json = await fetchMafraSearch("item", q, false);
      if (!json.ok) {
        setItemErr(json.message ?? "검색에 실패했습니다.");
        setItemRows([]);
        return;
      }
      const data = json.data as { matches?: MafraItemCode[] };
      setItemRows(data.matches ?? []);
      if ((data.matches?.length ?? 0) === 0) {
        setItemErr("결과가 없습니다. 다른 키워드로 검색해 보세요.");
      }
    } catch {
      setItemErr("검색 요청에 실패했습니다.");
      setItemRows([]);
    } finally {
      setItemBusy(false);
    }
  }, [itemQ]);

  const putMafraCodes = useCallback(
    async (body: {
      mafraLarge: string;
      mafraMid: string;
      mafraSmall: string;
      mafraUnitCodeId: string;
      mafraGrdCodeId: string;
      mafraFrmlCodeId: string;
    }) => {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/mafra-codes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        return { ok: false as const, message: data.message ?? "저장에 실패했습니다." };
      }
      return { ok: true as const };
    },
    [productId],
  );

  const onSave = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setHint(null);
    try {
      const r = await putMafraCodes({
        mafraLarge,
        mafraMid,
        mafraSmall,
        mafraUnitCodeId,
        mafraGrdCodeId,
        mafraFrmlCodeId,
      });
      if (!r.ok) {
        setHint(r.message);
        return;
      }
      setHint("저장했습니다.");
      router.refresh();
    } catch {
      setHint("저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }, [
    pending,
    putMafraCodes,
    mafraLarge,
    mafraMid,
    mafraSmall,
    mafraUnitCodeId,
    mafraGrdCodeId,
    mafraFrmlCodeId,
    router,
  ]);

  const onPickItemRow = useCallback(
    async (row: MafraItemCode) => {
      if (pending) return;
      const L = row.LARGE.trim();
      const M = row.MID.trim();
      const S = row.SMALL.trim();
      setMafraLarge(L);
      setMafraMid(M);
      setMafraSmall(S);
      setItemErr(null);
      setPending(true);
      setHint(null);
      try {
        const r = await putMafraCodes({
          mafraLarge: L,
          mafraMid: M,
          mafraSmall: S,
          mafraUnitCodeId,
          mafraGrdCodeId,
          mafraFrmlCodeId,
        });
        if (!r.ok) {
          setHint(r.message);
          return;
        }
        setHint(`품목 「${row.GOODNAME || S}」 저장됨 — 아래 「가격 조회」에 반영됩니다.`);
        router.refresh();
      } catch {
        setHint("품목 저장에 실패했습니다.");
      } finally {
        setPending(false);
      }
    },
    [pending, putMafraCodes, mafraUnitCodeId, mafraGrdCodeId, mafraFrmlCodeId, router],
  );

  return (
    <details className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/80 shadow-sm open:ring-1 open:ring-sky-200/60">
      <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-sky-950 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="block">시세·가격비교용 코드 (고급 · 선택)</span>
        <span className="mt-1 block text-xs font-normal leading-relaxed text-sky-950/85">
          품목명·규격만으로 시세표·가락 실시간 경매가 자동 매칭됩니다. 코드를 수동으로 고정할 때만 펼쳐 주세요.
        </span>
      </summary>
      <div className="border-t border-sky-200/80 px-4 pb-4">
      <p className="mt-3 text-xs leading-relaxed text-sky-950/85">
        품목은 검색 후 <strong className="font-semibold">목록에서 누르면 바로 저장</strong>되며, 아래 「저장」은 단위·등급·포장을 함께 확정할 때
        누릅니다. 이카운트 동기화는 이 값을 바꾸지 않습니다.
      </p>

      <div className="mt-5 space-y-5">
        <section>
          <p className="text-xs font-semibold text-sky-950">1) 품목 (대·중·소)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={itemQ}
              onChange={(e) => setItemQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void searchItem()}
              placeholder="품목명 키워드 (예: 배추)"
              className="min-w-[12rem] flex-1 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
              autoComplete="off"
            />
            <button
              type="button"
              disabled={itemBusy}
              onClick={() => void searchItem()}
              className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-900 shadow-sm hover:bg-sky-100 disabled:opacity-60"
            >
              {itemBusy ? "검색 중…" : "검색"}
            </button>
          </div>
          {itemErr ? <p className="mt-1 text-xs text-amber-800">{itemErr}</p> : null}
          {itemRows.length > 0 ? (
            <ul className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-sky-200 bg-white text-sm shadow-sm">
              {itemRows.map((row, i) => (
                <li
                  key={`${row.LARGE}-${row.MID}-${row.SMALL}-${row.GOODNAME}-${i}`}
                  className="border-b border-zinc-100 last:border-b-0"
                >
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-sky-50"
                    disabled={pending}
                    onClick={() => void onPickItemRow(row)}
                  >
                    <span className="font-medium text-zinc-900">{row.GOODNAME || "—"}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">
                      LARGE {row.LARGE} · MID {row.MID} · SMALL {row.SMALL}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-sky-950">
              LARGE
              <input
                value={mafraLarge}
                onChange={(e) => setMafraLarge(e.target.value)}
                className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm"
                autoComplete="off"
              />
            </label>
            <label className="block text-xs font-medium text-sky-950">
              MID
              <input
                value={mafraMid}
                onChange={(e) => setMafraMid(e.target.value)}
                className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm"
                autoComplete="off"
              />
            </label>
            <label className="block text-xs font-medium text-sky-950">
              SMALL
              <input
                value={mafraSmall}
                onChange={(e) => setMafraSmall(e.target.value)}
                className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm"
                autoComplete="off"
              />
            </label>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-sky-950">2) 단위 CODEID</p>
            <button
              type="button"
              disabled={unitListBusy}
              onClick={() => void loadUnitList(true)}
              className="text-[11px] font-semibold text-sky-800 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {unitListBusy ? "불러오는 중…" : "목록 다시 받기 (서버 동기화)"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-sky-900/80">
            페이지를 열 때 단위 전체를 불러옵니다. 아래 칸으로 이름·코드를 좁힌 뒤 목록에서 고르세요.
          </p>
          {unitListErr ? (
            <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
              <p className="break-words whitespace-pre-wrap leading-relaxed">{unitListErr}</p>
              {/INFO-100|인증에 실패|AUTH_ERROR/i.test(unitListErr) ? (
                <p className="leading-relaxed text-amber-950/95">
                  <Link href="/admin" className="font-semibold underline underline-offset-2 hover:text-amber-900">
                    관리자
                  </Link>
                  → MAFRA → 「코드사전 동기화」완료 후 여기서 「목록 다시 받기」.
                </p>
              ) : null}
            </div>
          ) : null}
          {unitListNote ? <p className="mt-2 text-xs leading-relaxed text-sky-900/90">{unitListNote}</p> : null}
          <label className="mt-2 block text-xs font-medium text-sky-950">
            목록 좁히기
            <input
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              placeholder="예: kg, 킬로, 박스"
              disabled={unitListBusy || unitOptions.length === 0}
              className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm disabled:opacity-60"
              autoComplete="off"
            />
          </label>
          {unitOptions.length > 0 ? (
            <label className="mt-3 block text-xs font-medium text-sky-950">
              단위 선택
              <select
                value={mafraUnitCodeId}
                onChange={(e) => setMafraUnitCodeId(e.target.value)}
                disabled={unitListBusy}
                className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm disabled:opacity-60"
              >
                <option value="">(선택 안 함)</option>
                {unitOrphan ? (
                  <option value={mafraUnitCodeId}>
                    {mafraUnitCodeId} — 저장됨 (현재 목록에 없음)
                  </option>
                ) : null}
                {filteredUnitOptions.map((u) => (
                  <option key={u.CODEID} value={u.CODEID}>
                    {u.CODEID} — {u.CODENAME}
                  </option>
                ))}
              </select>
            </label>
          ) : !unitListBusy ? (
            <label className="mt-3 block text-xs font-medium text-sky-950">
              CODEID 직접 입력 (목록을 불러오지 못했을 때)
              <input
                value={mafraUnitCodeId}
                onChange={(e) => setMafraUnitCodeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm"
                autoComplete="off"
              />
            </label>
          ) : null}
          <p className="mt-1 text-[11px] text-zinc-500">
            {unitListBusy
              ? "단위 코드를 불러오는 중입니다."
              : unitOptions.length > 0
                ? `총 ${unitOptions.length}건 · 필터 후 ${filteredUnitOptions.length}건 표시`
                : null}
          </p>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-sky-950">3) 등급 CODEID (선택)</p>
            <button
              type="button"
              disabled={grdListBusy}
              onClick={() => void loadGrdList(true)}
              className="text-[11px] font-semibold text-sky-800 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {grdListBusy ? "불러오는 중…" : "목록 다시 받기 (서버 동기화)"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-sky-900/80">
            등급 코드 전체를 불러옵니다. 아래에서 이름·코드를 좁힌 뒤 선택하거나, 직접 CODEID를 입력할 수 있습니다.
          </p>
          {grdListErr ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
              <p className="break-words whitespace-pre-wrap leading-relaxed">{grdListErr}</p>
              {/INFO-100|인증에 실패|AUTH_ERROR/i.test(grdListErr) ? (
                <p className="mt-2 leading-relaxed">
                  <Link href="/admin" className="font-semibold underline underline-offset-2 hover:text-amber-900">
                    관리자
                  </Link>
                  → MAFRA → 「코드사전 동기화」 후 「목록 다시 받기」.
                </p>
              ) : null}
            </div>
          ) : null}
          {grdListNote ? <p className="mt-2 text-xs leading-relaxed text-sky-900/90">{grdListNote}</p> : null}
          <label className="mt-2 block text-xs font-medium text-sky-950">
            목록 좁히기
            <input
              value={grdFilter}
              onChange={(e) => setGrdFilter(e.target.value)}
              placeholder="코드 또는 등급명"
              disabled={grdListBusy || grdOptions.length === 0}
              className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm disabled:opacity-60"
              autoComplete="off"
            />
          </label>
          {grdOptions.length > 0 ? (
            <label className="mt-3 block text-xs font-medium text-sky-950">
              등급 선택
              <select
                value={mafraGrdCodeId}
                onChange={(e) => setMafraGrdCodeId(e.target.value)}
                disabled={grdListBusy}
                className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm disabled:opacity-60"
              >
                <option value="">(선택 안 함)</option>
                {grdOrphan ? (
                  <option value={mafraGrdCodeId}>
                    {mafraGrdCodeId} — 저장됨 (현재 목록에 없음)
                  </option>
                ) : null}
                {filteredGrdOptions.map((u) => (
                  <option key={u.CODEID} value={u.CODEID}>
                    {u.CODEID} — {u.CODENAME}
                  </option>
                ))}
              </select>
            </label>
          ) : !grdListBusy ? (
            <label className="mt-3 block text-xs font-medium text-sky-950">
              CODEID 직접 입력
              <input
                value={mafraGrdCodeId}
                onChange={(e) => setMafraGrdCodeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm"
                autoComplete="off"
              />
            </label>
          ) : null}
          <p className="mt-1 text-[11px] text-zinc-500">
            {grdListBusy
              ? "등급 코드를 불러오는 중입니다."
              : grdOptions.length > 0
                ? `총 ${grdOptions.length}건 · 필터 후 ${filteredGrdOptions.length}건 표시`
                : null}
          </p>
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-sky-950">4) 포장 CODEID</p>
            <button
              type="button"
              disabled={frmlListBusy}
              onClick={() => void loadFrmlList(true)}
              className="text-[11px] font-semibold text-sky-800 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {frmlListBusy ? "불러오는 중…" : "목록 다시 받기 (서버 동기화)"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-sky-900/80">
            포장 코드 전체를 불러옵니다. 아래에서 이름·코드를 좁힌 뒤 선택하거나, 직접 CODEID를 입력할 수 있습니다.
          </p>
          {frmlListErr ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
              <p className="break-words whitespace-pre-wrap leading-relaxed">{frmlListErr}</p>
              {/INFO-100|인증에 실패|AUTH_ERROR/i.test(frmlListErr) ? (
                <p className="mt-2 leading-relaxed">
                  <Link href="/admin" className="font-semibold underline underline-offset-2 hover:text-amber-900">
                    관리자
                  </Link>
                  → MAFRA → 「코드사전 동기화」 후 「목록 다시 받기」.
                </p>
              ) : null}
            </div>
          ) : null}
          {frmlListNote ? <p className="mt-2 text-xs leading-relaxed text-sky-900/90">{frmlListNote}</p> : null}
          <label className="mt-2 block text-xs font-medium text-sky-950">
            목록 좁히기
            <input
              value={frmlFilter}
              onChange={(e) => setFrmlFilter(e.target.value)}
              placeholder="코드 또는 포장명"
              disabled={frmlListBusy || frmlOptions.length === 0}
              className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm disabled:opacity-60"
              autoComplete="off"
            />
          </label>
          {frmlOptions.length > 0 ? (
            <label className="mt-3 block text-xs font-medium text-sky-950">
              포장 선택
              <select
                value={mafraFrmlCodeId}
                onChange={(e) => setMafraFrmlCodeId(e.target.value)}
                disabled={frmlListBusy}
                className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm disabled:opacity-60"
              >
                <option value="">(선택 안 함)</option>
                {frmlOrphan ? (
                  <option value={mafraFrmlCodeId}>
                    {mafraFrmlCodeId} — 저장됨 (현재 목록에 없음)
                  </option>
                ) : null}
                {filteredFrmlOptions.map((u) => (
                  <option key={u.CODEID} value={u.CODEID}>
                    {u.CODEID} — {u.CODENAME}
                  </option>
                ))}
              </select>
            </label>
          ) : !frmlListBusy ? (
            <label className="mt-3 block text-xs font-medium text-sky-950">
              CODEID 직접 입력
              <input
                value={mafraFrmlCodeId}
                onChange={(e) => setMafraFrmlCodeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 shadow-sm"
                autoComplete="off"
              />
            </label>
          ) : null}
          <p className="mt-1 text-[11px] text-zinc-500">
            {frmlListBusy
              ? "포장 코드를 불러오는 중입니다."
              : frmlOptions.length > 0
                ? `총 ${frmlOptions.length}건 · 필터 후 ${filteredFrmlOptions.length}건 표시`
                : null}
          </p>
        </section>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-sky-200/80 pt-4">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-sky-800 px-4 text-xs font-semibold text-white shadow-sm hover:bg-sky-900 disabled:opacity-60"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        {hint ? <span className="text-xs text-sky-950/90">{hint}</span> : null}
      </div>
      </div>
    </details>
  );
}
