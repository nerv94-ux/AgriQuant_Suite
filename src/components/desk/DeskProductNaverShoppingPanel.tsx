"use client";

import { useCallback, useState } from "react";

type NaverShopItem = {
  title?: unknown;
  mallName?: unknown;
  brand?: unknown;
  maker?: unknown;
  category1?: unknown;
  category2?: unknown;
  category3?: unknown;
  category4?: unknown;
  lprice?: unknown;
  hprice?: unknown;
  productType?: unknown;
  productId?: unknown;
  link?: unknown;
  image?: unknown;
};

type Props = {
  productName: string;
};

function stripHtml(v: unknown): string {
  const s = String(v ?? "");
  return s.replace(/<[^>]*>/g, "").trim();
}

function asWon(v: unknown): string {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return "—";
  return `${Math.trunc(n).toLocaleString("ko-KR")}원`;
}

function safeText(v: unknown): string {
  const s = String(v ?? "").trim();
  return s || "—";
}

export default function DeskProductNaverShoppingPanel({ productName }: Props) {
  const [query, setQuery] = useState(productName);
  const [sort, setSort] = useState<"sim" | "date">("sim");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [items, setItems] = useState<NaverShopItem[]>([]);
  const [queried, setQueried] = useState(false);

  const runFetch = useCallback(async () => {
    if (!query.trim()) {
      setErr("검색어를 입력해 주세요.");
      setItems([]);
      setTotal(null);
      setQueried(true);
      return;
    }
    setBusy(true);
    setErr(null);
    setMetaMsg(null);
    setItems([]);
    setTotal(null);
    setQueried(false);
    try {
      const u = new URL("/api/desk/naver/search", window.location.origin);
      u.searchParams.set("query", query.trim());
      u.searchParams.set("sort", sort);
      u.searchParams.set("display", "30");
      u.searchParams.set("start", "1");
      const res = await fetch(u.toString(), { credentials: "same-origin" });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        data?: { total?: number; items?: NaverShopItem[] };
      };
      if (!res.ok || json.ok !== true || !json.data) {
        setErr(typeof json.message === "string" ? json.message : "네이버쇼핑 조회에 실패했습니다.");
        setQueried(true);
        return;
      }
      const list = Array.isArray(json.data.items) ? json.data.items : [];
      setItems(list);
      setTotal(typeof json.data.total === "number" ? json.data.total : null);
      setMetaMsg(`네이버쇼핑 조회 ${list.length}건`);
      setQueried(true);
    } catch {
      setErr("네트워크 오류로 조회하지 못했습니다.");
      setQueried(true);
    } finally {
      setBusy(false);
    }
  }, [query, sort]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-green-200/80 bg-green-50/50 px-3 py-2 text-[11px] leading-relaxed text-green-950">
        네이버쇼핑 검색 API(v1/search/shop) 결과를 소매 참고용으로 조회합니다. 내부 정식 판매가와는 별도이며, 상위 노출 상품을
        빠르게 비교하는 용도입니다.
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <label className="block text-[11px] font-medium text-zinc-700 sm:col-span-3">
          검색어(query)
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
            placeholder="예: 당근 1kg"
          />
        </label>
        <label className="block text-[11px] font-medium text-zinc-700">
          정렬(sort)
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value === "date" ? "date" : "sim")}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
          >
            <option value="sim">정확도(sim)</option>
            <option value="date">최신순(date)</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void runFetch()}
          disabled={busy}
          className="rounded-xl bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-60"
        >
          {busy ? "조회 중…" : "네이버쇼핑 조회"}
        </button>
        {metaMsg ? <span className="text-[11px] text-zinc-600">{metaMsg}</span> : null}
        {total != null ? <span className="text-[11px] text-zinc-600">총 {total.toLocaleString()}건</span> : null}
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {items.length > 0 ? (
        <div className="max-h-[460px] overflow-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-[10px] text-zinc-600">
              <tr>
                {["상품명", "최저가", "최고가", "쇼핑몰", "브랜드/제조사", "카테고리", "링크"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((it, i) => {
                const title = stripHtml(it.title);
                const brandMaker = [safeText(it.brand), safeText(it.maker)].filter((v) => v !== "—").join(" / ") || "—";
                const category = [it.category1, it.category2, it.category3, it.category4]
                  .map((v) => safeText(v))
                  .filter((v) => v !== "—")
                  .join(" > ") || "—";
                const link = String(it.link ?? "").trim();
                return (
                  <tr key={`${it.productId ?? i}-${i}`} className="hover:bg-zinc-50/80">
                    <td className="px-2 py-1 text-zinc-800">{title || "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{asWon(it.lprice)}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{asWon(it.hprice)}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{safeText(it.mallName)}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-zinc-800">{brandMaker}</td>
                    <td className="px-2 py-1 text-zinc-800">{category}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-zinc-800">
                      {link ? (
                        <a href={link} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                          이동
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !busy && queried && !err ? (
        <p className="text-[11px] text-zinc-500">조회 결과가 없습니다. 검색어를 조정해 보세요.</p>
      ) : !busy && !err ? (
        <p className="text-[11px] text-zinc-500">「네이버쇼핑 조회」를 누르면 결과가 표시됩니다.</p>
      ) : null}
    </div>
  );
}

