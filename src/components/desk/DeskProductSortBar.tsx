"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deskSegmentBtnBase, deskSegmentOff, deskSegmentOn } from "@/components/desk/deskSegmentButtonClasses";
import { buildDeskProductsListUrl } from "@/components/desk/deskProductListUrl";
import type { DeskProductListFilter } from "@/components/desk/server/deskProductQueries";
import type { DeskProductListSortMode } from "@/components/desk/server/deskProductUserPreferenceQueries";

type DeskProductSortBarProps = {
  filter: DeskProductListFilter;
  searchQuery: string;
  active: DeskProductListSortMode;
};

export default function DeskProductSortBar({ filter, searchQuery, active }: DeskProductSortBarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(next: DeskProductListSortMode) {
    if (pending) return;
    startTransition(async () => {
      try {
        await fetch("/api/desk/me/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ desk: { productListSort: next } }),
        });
      } catch {
        /* 저장 실패해도 이동 시도 */
      }
      router.push(buildDeskProductsListUrl(filter, searchQuery, next));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      <span className="shrink-0 self-center text-xs font-medium text-zinc-500">정렬</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => go("my")}
        className={[deskSegmentBtnBase, active === "my" ? deskSegmentOn : deskSegmentOff].join(" ")}
        title="내 순서·즐겨찾기·드래그 반영"
      >
        내 순서
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => go("alpha")}
        className={[deskSegmentBtnBase, active === "alpha" ? deskSegmentOn : deskSegmentOff].join(" ")}
        title="품목명 가나다순 (순서 편집 비활성)"
      >
        가나다
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => go("recent")}
        className={[deskSegmentBtnBase, "cursor-pointer", active === "recent" ? deskSegmentOn : deskSegmentOff].join(
          " ",
        )}
        title="상세 화면을 최근에 연 순서"
      >
        최근 사용
      </button>
    </div>
  );
}
