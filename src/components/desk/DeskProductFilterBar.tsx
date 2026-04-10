"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deskSegmentBtnBase, deskSegmentOff, deskSegmentOn } from "@/components/desk/deskSegmentButtonClasses";
import { buildDeskProductsListUrl } from "@/components/desk/deskProductListUrl";
import type { DeskProductListFilter } from "@/components/desk/server/deskProductQueries";
import type { DeskProductListSortMode } from "@/components/desk/server/deskProductUserPreferenceQueries";

type DeskProductFilterBarProps = {
  active: DeskProductListFilter;
  /** 검색어 유지용(현재 URL의 `q`) */
  searchQuery?: string;
  sortMode?: DeskProductListSortMode;
};

export default function DeskProductFilterBar({
  active,
  searchQuery = "",
  sortMode = "my",
}: DeskProductFilterBarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(next: DeskProductListFilter) {
    if (pending) return;
    startTransition(async () => {
      try {
        await fetch("/api/desk/me/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ desk: { productListFilter: next } }),
        });
      } catch {
        /* 저장 실패해도 목록 이동은 시도 */
      }
      router.push(buildDeskProductsListUrl(next, searchQuery, sortMode));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      <span className="shrink-0 self-center text-xs font-medium text-zinc-500">보기</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => go("active")}
        className={[deskSegmentBtnBase, active === "active" ? deskSegmentOn : deskSegmentOff].join(" ")}
      >
        사용중
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => go("inactive")}
        className={[deskSegmentBtnBase, active === "inactive" ? deskSegmentOn : deskSegmentOff].join(" ")}
      >
        미사용
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => go("all")}
        className={[deskSegmentBtnBase, active === "all" ? deskSegmentOn : deskSegmentOff].join(" ")}
      >
        전체
      </button>
    </div>
  );
}
