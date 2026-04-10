"use client";

import type { ReactNode } from "react";
import DeskProductFilterBar from "@/components/desk/DeskProductFilterBar";
import DeskProductSearchBar from "@/components/desk/DeskProductSearchBar";
import DeskProductSortBar from "@/components/desk/DeskProductSortBar";
import type { DeskProductListFilter } from "@/components/desk/server/deskProductQueries";
import type { DeskProductListSortMode } from "@/components/desk/server/deskProductUserPreferenceQueries";

export type DeskProductListToolbarProps = {
  filter: DeskProductListFilter;
  initialQ: string;
  sortMode: DeskProductListSortMode;
  /** 선택·일괄(데스크 켜기/끄기) — 목록에 행이 있을 때만 전달 */
  bulkActions?: ReactNode;
};

/**
 * 보기·정렬·검색(+ 선택 일괄)을 한 띠로 묶어 세로 공간을 줄임.
 */
export default function DeskProductListToolbar({
  filter,
  initialQ,
  sortMode,
  bulkActions,
}: DeskProductListToolbarProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm sm:px-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
          <DeskProductFilterBar active={filter} searchQuery={initialQ} sortMode={sortMode} />
          <span className="hidden h-5 w-px shrink-0 bg-zinc-200 sm:block" aria-hidden />
          <DeskProductSortBar filter={filter} searchQuery={initialQ} active={sortMode} />
        </div>

        {bulkActions ? (
          <>
            <span className="hidden h-5 w-px shrink-0 bg-zinc-200 xl:block" aria-hidden />
            <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 xl:flex-1 xl:border-t-0 xl:pt-0">
              {bulkActions}
            </div>
          </>
        ) : null}

        <div
          className={
            bulkActions
              ? "min-w-0 xl:ml-auto xl:w-[min(100%,24rem)] xl:shrink-0"
              : "min-w-0 w-full sm:max-w-md"
          }
        >
          <DeskProductSearchBar
            filter={filter}
            initialQ={initialQ}
            sortMode={sortMode}
            className="flex w-full min-w-0 items-center gap-2"
          />
        </div>
      </div>
    </div>
  );
}
