"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import DeskProductDeskEnabledToggle from "@/components/desk/DeskProductDeskEnabledToggle";
import DeskProductListDisplayEdit from "@/components/desk/DeskProductListDisplayEdit";
import DeskProductListToolbar from "@/components/desk/DeskProductListToolbar";
import type { DeskProductListFilter } from "@/components/desk/server/deskProductQueries";
import type { DeskProductListSortMode, DeskProductWithListPrefs } from "@/components/desk/server/deskProductUserPreferenceQueries";

type DeskProductListTableProps = {
  products: DeskProductWithListPrefs[];
  sortMode: DeskProductListSortMode;
  filter: DeskProductListFilter;
  initialQ: string;
};

const btnBase =
  "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

async function readDeskApiJson(res: Response): Promise<{ ok?: boolean; message?: string }> {
  const text = await res.text();
  if (!text.trim()) {
    return { ok: false, message: `응답이 비어 있습니다 (${res.status})` };
  }
  try {
    return JSON.parse(text) as { ok?: boolean; message?: string };
  } catch {
    return { ok: false, message: `서버 오류 (${res.status})` };
  }
}

type SortableRowProps = {
  product: DeskProductWithListPrefs;
  dragDisabled: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleFavorite: (id: string, next: boolean) => void;
  onMoveTop: (id: string) => void;
  favoritePending: boolean;
  topPending: boolean;
};

function SortableProductRow({
  product,
  dragDisabled,
  selected,
  onToggleSelect,
  onToggleFavorite,
  onMoveTop,
  favoritePending,
  topPending,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : undefined,
    zIndex: isDragging ? 2 : undefined,
    position: "relative" as const,
  };

  return (
    <tr ref={setNodeRef} style={style} id={`desk-product-row-${product.id}`} className="hover:bg-zinc-50/80">
      <td className="px-2 py-3 pl-4 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(product.id)}
          className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-300 bg-white text-emerald-600 focus:ring-emerald-500/40"
          aria-label={`${product.name} 선택`}
        />
      </td>
      <td className="w-10 px-1 py-3 align-middle text-center">
        {dragDisabled ? (
          <span className="text-zinc-300" title="가나다·최근 사용 모드에서는 순서를 바꿀 수 없습니다">
            —
          </span>
        ) : (
          <button
            type="button"
            className="cursor-grab touch-none text-zinc-400 hover:text-zinc-700 active:cursor-grabbing"
            aria-label="순서 바꾸기"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        )}
      </td>
      <td className="w-12 px-1 py-2 align-middle text-center">
        <button
          type="button"
          disabled={favoritePending}
          onClick={() => onToggleFavorite(product.id, !product.favorite)}
          className={[
            "rounded-lg p-1.5 text-lg leading-none transition",
            product.favorite ? "text-amber-500 hover:text-amber-600" : "text-zinc-300 hover:text-amber-400",
          ].join(" ")}
          title={product.favorite ? "즐겨찾기 해제" : "즐겨찾기"}
          aria-pressed={product.favorite}
        >
          ★
        </button>
      </td>
      <td className="w-14 px-1 py-2 align-middle">
        <button
          type="button"
          disabled={topPending}
          onClick={() => onMoveTop(product.id)}
          className="whitespace-nowrap rounded border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-100"
          title="목록 최상단으로"
        >
          맨↑
        </button>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-800">
        {product.ecountCodeBase ?? product.ecountProdCode ?? "—"}
      </td>
      <td className="max-w-[8rem] px-4 py-3 text-xs text-zinc-400">{product.ecountCodeSuffix ?? "—"}</td>
      <DeskProductListDisplayEdit key={`${product.id}-${product.updatedAt}`} product={product} />
      <td className="px-4 py-3">
        <DeskProductDeskEnabledToggle productId={product.id} initialEnabled={product.deskEnabled} />
      </td>
      <td className="px-4 py-3">
        <span
          className={[
            "rounded-full border px-2 py-0.5 text-xs font-semibold",
            product.source === "ecount"
              ? "border-sky-200 bg-sky-50 text-sky-900"
              : "border-amber-200 bg-amber-50 text-amber-900",
          ].join(" ")}
        >
          {product.source === "ecount" ? "이카운트" : "수동"}
        </span>
      </td>
      <td className="px-4 py-3 text-zinc-500">{product.hasOpenMarketMatch ? "있음" : "—"}</td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/desk/products/${product.id}`}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          상세
        </Link>
      </td>
    </tr>
  );
}

export default function DeskProductListTable({ products, sortMode, filter, initialQ }: DeskProductListTableProps) {
  const router = useRouter();
  const [items, setItems] = useState<DeskProductWithListPrefs[]>(products);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  const [topBusy, setTopBusy] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const dragDisabled = sortMode !== "my";

  useEffect(() => {
    setItems(products);
  }, [products]);

  const ids = useMemo(() => items.map((p) => p.id), [items]);

  useEffect(() => {
    const idSet = new Set(ids);
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (idSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed || next.size !== prev.size ? next : prev;
    });
  }, [ids]);

  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && selected.size < items.length;

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) {
      el.indeterminate = someSelected;
    }
  }, [someSelected]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === items.length) {
        return new Set();
      }
      return new Set(ids);
    });
  }, [ids, items.length]);

  async function persistReorder(next: DeskProductWithListPrefs[]) {
    setError(null);
    const res = await fetch("/api/desk/me/product-preferences/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: next.map((p) => ({ deskProductId: p.id, favorite: p.favorite })),
      }),
    });
    const data = await readDeskApiJson(res);
    if (!res.ok || !data.ok) {
      setError(data.message ?? "순서 저장에 실패했습니다.");
      setItems(products);
      return;
    }
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  function onDragEnd(event: DragEndEvent) {
    if (dragDisabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    void persistReorder(next);
  }

  async function onToggleFavorite(id: string, next: boolean) {
    setFavoriteBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/desk/me/product-preferences/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: next }),
      });
      const data = await readDeskApiJson(res);
      if (!res.ok || !data.ok) {
        setError(data.message ?? "즐겨찾기를 바꾸지 못했습니다.");
        return;
      }
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, favorite: next } : p)));
      startRefreshTransition(() => router.refresh());
    } catch {
      setError("요청을 보내지 못했습니다.");
    } finally {
      setFavoriteBusy(null);
    }
  }

  async function onMoveTop(id: string) {
    setTopBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/desk/me/product-preferences/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveToTop: true }),
      });
      const data = await readDeskApiJson(res);
      if (!res.ok || !data.ok) {
        setError(data.message ?? "이동에 실패했습니다.");
        return;
      }
      startRefreshTransition(() => router.refresh());
    } catch {
      setError("요청을 보내지 못했습니다.");
    } finally {
      setTopBusy(null);
    }
  }

  async function bulkApply(enabled: boolean) {
    const list = Array.from(selected);
    if (list.length === 0 || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/desk/products/bulk-desk-enabled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: list, enabled }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; updated?: number };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "일괄 반영에 실패했습니다.");
        return;
      }
      setSelected(new Set());
      startRefreshTransition(() => {
        router.refresh();
      });
    } catch {
      setError("요청을 보내지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <DeskProductListToolbar
        filter={filter}
        initialQ={initialQ}
        sortMode={sortMode}
        bulkActions={
          <>
            <span className="text-xs text-zinc-600">
              선택 <span className="font-medium text-zinc-900">{selected.size}</span>건
            </span>
            <span className="text-zinc-300">|</span>
            <button
              type="button"
              disabled={selected.size === 0 || pending}
              onClick={() => void bulkApply(true)}
              className={[btnBase, "border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"].join(
                " ",
              )}
            >
              {pending ? "처리 중…" : "선택 항목 데스크 켜기"}
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || pending}
              onClick={() => void bulkApply(false)}
              className={[btnBase, "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"].join(" ")}
            >
              {pending ? "처리 중…" : "선택 항목 데스크 끄기"}
            </button>
            {isRefreshing ? <span className="text-xs text-zinc-500">목록 새로고침…</span> : null}
            {error ? <span className="text-xs text-red-600">{error}</span> : null}
          </>
        }
      />

      <p className="text-[11px] leading-relaxed text-zinc-500">
        <strong className="font-medium text-zinc-700">내 순서</strong>에서 ⋮⋮으로 드래그해 순서를 바꿀 수 있습니다.{" "}
        <strong className="font-medium text-zinc-700">★</strong> 즐겨찾기, <strong className="font-medium text-zinc-700">맨↑</strong>{" "}
        최상단(정렬 기준 상단)으로 옮깁니다.{" "}
        <strong className="font-medium text-zinc-700">가나다</strong>·<strong className="font-medium text-zinc-700">최근 사용</strong>
        은 순서 편집이 꺼집니다. 이카운트 품목은 품목명·규격·포장단위를 목록에서 바로 고칠 수 있으며, 품목명 옆{" "}
        <strong className="font-medium text-zinc-700">자물쇠</strong>로 이카운트 표시를 되돌릴 수 있습니다.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[1060px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-10 px-2 py-3 pl-4">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={items.length === 0}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-300 bg-white text-emerald-600 focus:ring-emerald-500/40 disabled:cursor-not-allowed"
                    aria-label="현재 목록 전체 선택"
                  />
                </th>
                <th className="w-10 px-1 py-3 font-semibold" title="드래그(내 순서 모드)">
                  순서
                </th>
                <th className="w-12 px-1 py-3 font-semibold">즐겨</th>
                <th className="w-14 px-1 py-3 font-semibold">맨↑</th>
                <th className="px-4 py-3 font-semibold">코드</th>
                <th className="px-4 py-3 font-semibold">구분</th>
                <th className="px-4 py-3 font-semibold">품목</th>
                <th className="px-4 py-3 font-semibold">규격</th>
                <th className="min-w-[6rem] px-4 py-3 font-semibold">포장단위</th>
                <th className="px-4 py-3 font-semibold">데스크 사용</th>
                <th className="px-4 py-3 font-semibold">출처</th>
                <th className="px-4 py-3 font-semibold">매칭</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <tbody className="divide-y divide-zinc-100">
                {items.map((p) => (
                  <SortableProductRow
                    key={p.id}
                    product={p}
                    dragDisabled={dragDisabled}
                    selected={selected.has(p.id)}
                    onToggleSelect={toggleOne}
                    onToggleFavorite={onToggleFavorite}
                    onMoveTop={onMoveTop}
                    favoritePending={favoriteBusy === p.id}
                    topPending={topBusy === p.id}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>
    </div>
  );
}
