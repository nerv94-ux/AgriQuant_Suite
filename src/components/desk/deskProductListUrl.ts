import type { DeskProductListFilter } from "@/components/desk/server/deskProductQueries";
import type { DeskProductListSortMode } from "@/components/desk/server/deskProductUserPreferenceQueries";

/** 품목 목록 URL — `filter`·`q`·`sort` 쿼리 조합 */
export function buildDeskProductsListUrl(
  filter: DeskProductListFilter,
  q?: string,
  sort?: DeskProductListSortMode,
): string {
  const params = new URLSearchParams();
  if (filter === "all") {
    params.set("filter", "all");
  } else if (filter === "inactive") {
    params.set("filter", "inactive");
  } else {
    params.set("filter", "active");
  }
  const qt = q?.trim().slice(0, 100) ?? "";
  if (qt) {
    params.set("q", qt);
  }
  if (sort === "alpha") {
    params.set("sort", "alpha");
  } else if (sort === "recent") {
    params.set("sort", "recent");
  }
  const s = params.toString();
  return s ? `/desk/products?${s}` : "/desk/products";
}
