"use client";

import type { MafraItemCode } from "@/components/common/api/server/connectors/mafra-item-code/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function str(v: string | null | undefined): string {
  return v ?? "";
}

type ApiOk<T> = { ok: true; data: T; message?: string };
type ApiErr = { ok: false; message: string };

async function fetchMafraItemSearch(query: string, forceSync: boolean) {
  const u = new URL("/api/desk/mafra/search", window.location.origin);
  u.searchParams.set("kind", "item");
  u.searchParams.set("query", query);
  if (forceSync) u.searchParams.set("forceSync", "1");
  const res = await fetch(u.toString(), { credentials: "same-origin" });
  return (await res.json()) as ApiOk<{ matches?: MafraItemCode[] }> | ApiErr;
}

type DeskProductItemMafraPickerProps = {
  productId: string;
  /** 검색창 기본값(보통 저장 품목명) */
  defaultSearchQuery: string;
  savedMafraLarge: string | null;
  savedMafraMid: string | null;
  savedMafraSmall: string | null;
  savedMafraUnitCodeId: string | null;
  savedMafraGrdCodeId: string | null;
  savedMafraFrmlCodeId: string | null;
};

/**
 * 도매 시세용 농식품 품목(대·중·소)을 코드사전에서 검색해 한 줄 선택·저장.
 * (미니당근/세척당근 등 세분은 실무자가 고름)
 */
export default function DeskProductItemMafraPicker({
  productId,
  defaultSearchQuery,
  savedMafraLarge,
  savedMafraMid,
  savedMafraSmall,
  savedMafraUnitCodeId,
  savedMafraGrdCodeId,
  savedMafraFrmlCodeId,
}: DeskProductItemMafraPickerProps) {
  const router = useRouter();
  const [itemQ, setItemQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [rows, setRows] = useState<MafraItemCode[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(!str(savedMafraSmall).trim());

  useEffect(() => {
    const core = defaultSearchQuery.split("*")[0]?.trim() ?? defaultSearchQuery.trim();
    setItemQ(core);
  }, [defaultSearchQuery]);

  useEffect(() => {
    if (!str(savedMafraSmall).trim()) setShowPicker(true);
  }, [savedMafraSmall]);

  const search = useCallback(async () => {
    const q = itemQ.trim();
    if (!q) {
      setErr("검색어를 입력해 주세요.");
      setRows([]);
      return;
    }
    setBusy(true);
    setErr(null);
    setHint(null);
    try {
      const json = await fetchMafraItemSearch(q, false);
      if (!json.ok) {
        setErr(json.message ?? "검색에 실패했습니다.");
        setRows([]);
        return;
      }
      const matches = json.data?.matches ?? [];
      setRows(matches);
      if (matches.length === 0) {
        setErr("결과가 없습니다. 다른 키워드로 검색해 보세요.");
      }
    } catch {
      setErr("검색 요청에 실패했습니다.");
      setRows([]);
    } finally {
      setBusy(false);
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

  const onPickRow = useCallback(
    async (row: MafraItemCode) => {
      if (saving) return;
      const L = row.LARGE.trim();
      const M = row.MID.trim();
      const S = row.SMALL.trim();
      setSaving(true);
      setErr(null);
      setHint(null);
      try {
        const r = await putMafraCodes({
          mafraLarge: L,
          mafraMid: M,
          mafraSmall: S,
          mafraUnitCodeId: str(savedMafraUnitCodeId),
          mafraGrdCodeId: str(savedMafraGrdCodeId),
          mafraFrmlCodeId: str(savedMafraFrmlCodeId),
        });
        if (!r.ok) {
          setHint(r.message);
          return;
        }
        setHint(`「${row.GOODNAME || S}」 저장됨 — 아래 시세가 이 코드 기준으로 갱신됩니다.`);
        setShowPicker(false);
        router.refresh();
      } catch {
        setHint("저장에 실패했습니다.");
      } finally {
        setSaving(false);
      }
    },
    [putMafraCodes, savedMafraUnitCodeId, savedMafraGrdCodeId, savedMafraFrmlCodeId, router, saving],
  );

  const hasSmall = Boolean(str(savedMafraSmall).trim());

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-violet-950">시세용 농식품 품목 확정</h3>
          <p className="mt-1 text-xs leading-relaxed text-violet-950/85">
            코드사전에서 키워드로 검색한 뒤, <strong className="font-semibold">세척당근·미니당근</strong> 등{" "}
            <strong className="font-semibold">실제로 시세를 볼 품목 한 줄</strong>을 눌러 저장합니다. 저장된 대·중·소가
            전국 시세·가락 조회에 사용됩니다.
          </p>
        </div>
      </div>

      {hasSmall && !showPicker ? (
        <div className="mt-3 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-zinc-800">
          <p className="font-medium text-zinc-900">저장된 품목 코드</p>
          <p className="mt-1 font-mono text-xs text-zinc-600">
            LARGE {str(savedMafraLarge) || "—"} · MID {str(savedMafraMid) || "—"} · SMALL {str(savedMafraSmall) || "—"}
          </p>
          <button
            type="button"
            onClick={() => {
              setShowPicker(true);
              setHint(null);
            }}
            className="mt-2 text-xs font-semibold text-violet-800 underline underline-offset-2 hover:text-violet-950"
          >
            품목 다시 선택
          </button>
        </div>
      ) : null}

      {(!hasSmall || showPicker) && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={itemQ}
              onChange={(e) => setItemQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void search()}
              placeholder="예: 당근"
              className="min-w-[12rem] flex-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm"
              autoComplete="off"
              disabled={saving}
            />
            <button
              type="button"
              disabled={busy || saving}
              onClick={() => void search()}
              className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900 shadow-sm hover:bg-violet-100 disabled:opacity-60"
            >
              {busy ? "검색 중…" : "검색"}
            </button>
          </div>
          {err ? <p className="text-xs text-amber-800">{err}</p> : null}
          {rows.length > 0 ? (
            <ul className="max-h-52 overflow-y-auto rounded-lg border border-violet-200 bg-white text-sm shadow-sm">
              {rows.map((row, i) => (
                <li
                  key={`${row.LARGE}-${row.MID}-${row.SMALL}-${row.GOODNAME}-${i}`}
                  className="border-b border-zinc-100 last:border-b-0"
                >
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left transition hover:bg-violet-50 disabled:opacity-60"
                    disabled={saving}
                    onClick={() => void onPickRow(row)}
                  >
                    <span className="font-medium text-zinc-900">{row.GOODNAME || "—"}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">
                      LARGE {row.LARGE} · MID {row.MID} · SMALL {row.SMALL}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-zinc-500">
                      {row.LARGENAME ? `${row.LARGENAME} › ` : ""}
                      {row.MIDNAME ? `${row.MIDNAME} › ` : ""}
                      {row.GOODNAME}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {hint ? <p className="text-xs font-medium text-emerald-800">{hint}</p> : null}
          <p className="text-[11px] leading-relaxed text-violet-900/80">
            단위·등급·포장 코드는 페이지 상단 「시세·가격비교용 코드 (고급)」에서 함께 저장할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
