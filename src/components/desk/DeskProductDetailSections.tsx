"use client";

import type { DeskProductUserDraftPayload } from "@/components/desk/server/deskUserDraftQueries";
import DeskProductItemMafraPicker from "@/components/desk/DeskProductItemMafraPicker";
import DeskProductEcoPrice from "@/components/desk/DeskProductEcoPrice";
import DeskProductCompetitorTargetsPanel from "@/components/desk/DeskProductCompetitorTargetsPanel";
import DeskProductMafraAgricnsmTrendPanel from "@/components/desk/DeskProductMafraAgricnsmTrendPanel";
import DeskProductMafraClclnPanel from "@/components/desk/DeskProductMafraClclnPanel";
import DeskProductMafraRetailPricePanel from "@/components/desk/DeskProductMafraRetailPricePanel";
import DeskProductNaverShoppingPanel from "@/components/desk/DeskProductNaverShoppingPanel";
import DeskProductRealtimeAuction from "@/components/desk/DeskProductRealtimeAuction";
import DeskWholesaleAuctionSheet from "@/components/desk/DeskWholesaleAuctionSheet";
import { useCallback, useEffect, useMemo, useState } from "react";

const LEGACY_DRAFT_KEY = (productId: string) => `agriquote:deskProductDraft:${productId}`;

type DeskProductDetailSectionsProps = {
  productId: string;
  /** 목록·상단과 동일한 품목·규격 라벨(전국 시세표 안내용) */
  productName: string;
  specLabel: string;
  packageUnit: string;
  initialDraft: DeskProductUserDraftPayload | null;
  savedMafraLarge: string | null;
  savedMafraMid: string | null;
  savedMafraSmall: string | null;
  savedMafraUnitCodeId: string | null;
  savedMafraGrdCodeId: string | null;
  savedMafraFrmlCodeId: string | null;
  initialEcoCtgryCd: string | null;
  initialEcoItemCd: string | null;
  initialEcoVrtyCd: string | null;
  initialEcoGrdCd: string | null;
  initialEcoSggCd: string | null;
  initialEcoMrktCd: string | null;
};

const navBtn =
  "rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900";

export default function DeskProductDetailSections({
  productId,
  productName,
  specLabel,
  packageUnit,
  initialDraft,
  savedMafraLarge,
  savedMafraMid,
  savedMafraSmall,
  savedMafraUnitCodeId,
  savedMafraGrdCodeId,
  savedMafraFrmlCodeId,
  initialEcoCtgryCd,
  initialEcoItemCd,
  initialEcoVrtyCd,
  initialEcoGrdCd,
  initialEcoSggCd,
  initialEcoMrktCd,
}: DeskProductDetailSectionsProps) {
  const [targetPriceWon, setTargetPriceWon] = useState("");
  const [note, setNote] = useState("");
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (initialDraft) {
      setTargetPriceWon(initialDraft.targetPriceWon);
      setNote(initialDraft.note);
      setSavedHint(`저장됨 · ${new Date(initialDraft.updatedAt).toLocaleString("ko-KR")}`);
      return;
    }

    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LEGACY_DRAFT_KEY(productId));
      if (!raw) return;
      const p = JSON.parse(raw) as { targetPriceWon?: unknown; note?: unknown; savedAt?: unknown };
      if (
        typeof p.targetPriceWon !== "string" ||
        typeof p.note !== "string" ||
        typeof p.savedAt !== "string"
      ) {
        return;
      }
      void (async () => {
        try {
          const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/draft`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetPriceWon: p.targetPriceWon, note: p.note }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            ok?: boolean;
            draft?: { targetPriceWon: string; note: string; updatedAt: string };
          };
          if (data.ok && data.draft) {
            window.localStorage.removeItem(LEGACY_DRAFT_KEY(productId));
            setTargetPriceWon(data.draft.targetPriceWon);
            setNote(data.draft.note);
            setSavedHint(`저장됨 · ${new Date(data.draft.updatedAt).toLocaleString("ko-KR")}`);
          }
        } catch {
          /* ignore */
        }
      })();
    } catch {
      /* ignore */
    }
  }, [productId, initialDraft]);

  const embeddedProductSummary = useMemo(() => {
    const parts = [productName.trim()];
    const spec = specLabel.trim();
    if (spec && spec !== "—") parts.push(spec);
    const u = packageUnit.trim();
    if (u) parts.push(u);
    return parts.join(" · ");
  }, [productName, specLabel, packageUnit]);

  const onSaveDraft = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/desk/products/${encodeURIComponent(productId)}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPriceWon, note }),
      });
      if (!res.ok) {
        setSavedHint("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        draft?: { targetPriceWon: string; note: string; updatedAt: string };
      };
      if (data.ok && data.draft) {
        setSavedHint(`저장됨 · ${new Date(data.draft.updatedAt).toLocaleString("ko-KR")}`);
      }
    } catch {
      setSavedHint("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }, [productId, targetPriceWon, note, pending]);

  return (
    <div className="space-y-10 scroll-mt-4">
      <nav
        aria-label="품목 상세 구역"
        className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-1 border-b border-zinc-200 bg-zinc-100/95 px-1 py-3 backdrop-blur-md"
      >
        <a href="#desk-section-wholesale" className={navBtn}>
          도매·경매
        </a>
        <a href="#desk-section-mafra-clcln" className={navBtn}>
          정산·원천
        </a>
        <a href="#desk-section-retail" className={navBtn}>
          소매·소비자가
        </a>
        <a href="#desk-section-price" className={navBtn}>
          판매가
        </a>
      </nav>

      <p className="text-xs leading-relaxed text-zinc-600">
        <strong className="font-semibold text-zinc-800">도매 가격 산정</strong>은 아래{" "}
        <strong className="text-zinc-800">도매·경매</strong> 구역(품목 코드·전국 시세·실시간 경매·
        <strong className="text-zinc-800">정산·원천</strong> 조회)을 우선 사용합니다.{" "}
        <strong className="font-semibold text-zinc-800">친환경 농산물 조사가</strong>는 소매 유통 채널 기준 공공 데이터로,{" "}
        <strong className="text-zinc-800">소매·소비자가</strong> 레퍼런스로 두었습니다.{" "}
        <strong className="font-semibold text-zinc-800">판매가</strong>·메모는 맨 아래에서 다룹니다.
      </p>

      <section id="desk-section-wholesale" className="scroll-mt-28 space-y-4">
        <DeskProductItemMafraPicker
          productId={productId}
          defaultSearchQuery={productName}
          savedMafraLarge={savedMafraLarge}
          savedMafraMid={savedMafraMid}
          savedMafraSmall={savedMafraSmall}
          savedMafraUnitCodeId={savedMafraUnitCodeId}
          savedMafraGrdCodeId={savedMafraGrdCodeId}
          savedMafraFrmlCodeId={savedMafraFrmlCodeId}
        />
        <DeskWholesaleAuctionSheet
          mode="embedded"
          deskProductId={productId}
          productSummary={embeddedProductSummary}
          defaultOpenMarketDetails
        />
        <DeskProductMafraClclnPanel
          productName={productName}
          savedMafraLarge={savedMafraLarge}
          savedMafraMid={savedMafraMid}
          savedMafraSmall={savedMafraSmall}
        />
        <details className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden">
            한 시장·법인만 지정해서 보기 <span className="font-normal text-zinc-500">(선택 · 가락 등)</span>
          </summary>
          <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
            <DeskProductRealtimeAuction
              productId={productId}
              savedMafraLarge={savedMafraLarge}
              savedMafraMid={savedMafraMid}
              savedMafraSmall={savedMafraSmall}
            />
          </div>
        </details>
      </section>

      <section id="desk-section-retail" className="scroll-mt-28 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-sky-800">소매·소비자가 레퍼런스</h3>
          <span className="text-[11px] text-zinc-500">
            도매 산정과 별도 · 친환경=공공 소매 조사가 · 오픈마켓 연동 예정
          </span>
        </div>

        <details
          id="desk-section-eco"
          className="rounded-2xl border border-emerald-200/90 bg-white shadow-sm open:shadow-md"
        >
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-emerald-900 marker:content-none [&::-webkit-details-marker]:hidden">
            친환경 농산물 가격(조사){" "}
            <span className="font-normal text-emerald-700/90">— 소매 유통 채널 · 도매 경매와 무관</span>
          </summary>
          <div className="border-t border-emerald-100 px-4 pb-4 pt-3">
            <DeskProductEcoPrice
              productId={productId}
              productName={productName}
              specLabel={specLabel}
              initialEcoCtgryCd={initialEcoCtgryCd}
              initialEcoItemCd={initialEcoItemCd}
              initialEcoVrtyCd={initialEcoVrtyCd}
              initialEcoGrdCd={initialEcoGrdCd}
              initialEcoSggCd={initialEcoSggCd}
              initialEcoMrktCd={initialEcoMrktCd}
              savedMafraLarge={savedMafraLarge}
              savedMafraMid={savedMafraMid}
              savedMafraSmall={savedMafraSmall}
            />
          </div>
        </details>

        <details
          id="desk-section-mafra-retail"
          className="rounded-2xl border border-sky-200/90 bg-white shadow-sm open:shadow-md"
        >
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-sky-900 marker:content-none [&::-webkit-details-marker]:hidden">
            농수축산물 소매가격(MAFRA Grid){" "}
            <span className="font-normal text-sky-700/90">— 조사일 기준 소매가격 명세 연동</span>
          </summary>
          <div className="border-t border-sky-100 px-4 pb-4 pt-3">
            <DeskProductMafraRetailPricePanel
              productName={productName}
              defaultCtgryCd={initialEcoCtgryCd}
              defaultItemCd={initialEcoItemCd}
              defaultSpeciesCd={initialEcoVrtyCd}
            />
          </div>
        </details>

        <details
          id="desk-section-mafra-agricnsm-trend"
          className="rounded-2xl border border-violet-200/90 bg-white shadow-sm open:shadow-md"
        >
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-violet-900 marker:content-none [&::-webkit-details-marker]:hidden">
            소매가격·소비 트렌드 결합(MAFRA Grid){" "}
            <span className="font-normal text-violet-700/90">— 월별 구매·판매·변동 지표</span>
          </summary>
          <div className="border-t border-violet-100 px-4 pb-4 pt-3">
            <DeskProductMafraAgricnsmTrendPanel productName={productName} />
          </div>
        </details>

        <details
          id="desk-section-naver-shopping"
          className="rounded-2xl border border-green-200/90 bg-white shadow-sm open:shadow-md"
        >
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-green-900 marker:content-none [&::-webkit-details-marker]:hidden">
            네이버쇼핑 검색{" "}
            <span className="font-normal text-green-700/90">— 오픈마켓 노출가 참고</span>
          </summary>
          <div className="border-t border-green-100 px-4 pb-4 pt-3">
            <DeskProductNaverShoppingPanel productName={productName} />
          </div>
        </details>

        <details
          id="desk-section-competitor-targets"
          className="rounded-2xl border border-lime-200/90 bg-white shadow-sm open:shadow-md"
        >
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-lime-900 marker:content-none [&::-webkit-details-marker]:hidden">
            경쟁상품 등록{" "}
            <span className="font-normal text-lime-700/90">— URL/상품번호 수집 대상 관리</span>
          </summary>
          <div className="border-t border-lime-100 px-4 pb-4 pt-3">
            <DeskProductCompetitorTargetsPanel productId={productId} productName={productName} />
          </div>
        </details>

        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-semibold">채널</th>
                <th className="px-4 py-3 font-semibold">상품명 요약</th>
                <th className="px-4 py-3 font-semibold">가격</th>
                <th className="px-4 py-3 font-semibold">비고</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-600">
                  연결 후 오픈마켓·소비자가 레퍼런스가 여기 표시됩니다.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="desk-section-price" className="scroll-mt-28 space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">판매가 · 메모</h3>
          <span className="text-[11px] text-zinc-500">계정별 저장</span>
        </div>
        <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="desk-target-price" className="text-xs font-medium text-zinc-600">
              목표 판매가 (원)
            </label>
            <input
              id="desk-target-price"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="예: 12800"
              value={targetPriceWon}
              onChange={(e) => setTargetPriceWon(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="desk-note" className="text-xs font-medium text-zinc-600">
              메모
            </label>
            <textarea
              id="desk-note"
              rows={3}
              placeholder="채널별 정책, 마진, 협의 사항 등"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => void onSaveDraft()}
            className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
          >
            저장
          </button>
          {savedHint ? <span className="text-xs text-zinc-500">{savedHint}</span> : null}
        </div>
      </section>
    </div>
  );
}
