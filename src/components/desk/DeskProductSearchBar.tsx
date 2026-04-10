"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { DeskProductListFilter } from "@/components/desk/server/deskProductQueries";
import type { DeskProductListSortMode } from "@/components/desk/server/deskProductUserPreferenceQueries";
import { buildDeskProductsListUrl } from "@/components/desk/deskProductListUrl";

type DeskProductSearchBarProps = {
  filter: DeskProductListFilter;
  initialQ: string;
  sortMode?: DeskProductListSortMode;
  /** 툴바 통합 시 폭 제어용 */
  className?: string;
};

const DEBOUNCE_MS = 320;

export default function DeskProductSearchBar({
  filter,
  initialQ,
  sortMode = "my",
  className,
}: DeskProductSearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialQ);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(initialQ);
  }, [initialQ]);

  const pushUrl = useCallback(
    (next: string) => {
      const url = buildDeskProductsListUrl(filter, next, sortMode);
      startTransition(() => {
        router.push(url);
        router.refresh();
      });
    },
    [filter, router, sortMode],
  );

  function onChangeInput(v: string) {
    setValue(v);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      pushUrl(v);
    }, DEBOUNCE_MS);
  }

  function clearSearch() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setValue("");
    pushUrl("");
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const trimmed = value.trim();
  const showClear = trimmed.length > 0;

  return (
    <div className={className ?? "flex w-full max-w-md items-center gap-2"}>
      <label htmlFor="desk-product-search" className="shrink-0 text-xs font-medium text-zinc-500">
        검색
      </label>
      <div className="relative min-w-0 flex-1">
        <input
          id="desk-product-search"
          type="search"
          name="q"
          autoComplete="off"
          placeholder="품목명 또는 품목코드"
          value={value}
          maxLength={100}
          onChange={(e) => onChangeInput(e.target.value)}
          className="w-full cursor-text rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-20 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {isPending ? (
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-600"
              aria-hidden
            />
          ) : null}
          {showClear ? (
            <button type="button" onClick={clearSearch} className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
              지우기
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
