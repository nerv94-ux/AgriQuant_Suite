import Link from "next/link";
import { requireApprovedUser } from "@/components/common/auth/server/requireApproved";
import { buildDeskProductsListUrl } from "@/components/desk/deskProductListUrl";
import DeskEcountSyncButton from "@/components/desk/DeskEcountSyncButton";
import DeskProductListTable from "@/components/desk/DeskProductListTable";
import DeskProductListToolbar from "@/components/desk/DeskProductListToolbar";
import { type DeskProductListFilter, listDeskProducts } from "@/components/desk/server/deskProductQueries";
import type { DeskProductListSortMode } from "@/components/desk/server/deskProductUserPreferenceQueries";
import {
  getDeskProductListFilterPreference,
  getDeskProductListSortPreference,
} from "@/components/desk/server/deskProductUserPreferenceQueries";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ filter?: string | string[]; q?: string | string[]; sort?: string | string[] }>;
};

function resolveFilter(sp: { filter?: string | string[] }, saved: DeskProductListFilter): DeskProductListFilter {
  const raw = sp.filter;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "all") return "all";
  if (v === "inactive") return "inactive";
  if (v === "active") return "active";
  return saved;
}

function resolveQuery(sp: { q?: string | string[] }): string {
  const raw = sp.q;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" ? v.trim().slice(0, 100) : "";
}

function resolveSort(sp: { sort?: string | string[] }, saved: DeskProductListSortMode): DeskProductListSortMode {
  const raw = sp.sort;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "alpha") return "alpha";
  if (v === "recent") return "recent";
  if (v === "my") return "my";
  return saved;
}

export default async function DeskProductsPage({ searchParams }: PageProps) {
  const session = await requireApprovedUser();
  const sp = await searchParams;
  const saved = await getDeskProductListFilterPreference(session.user.id);
  const savedSort = await getDeskProductListSortPreference(session.user.id);
  const filter = resolveFilter(sp, saved);
  const q = resolveQuery(sp);
  const sortMode = resolveSort(sp, savedSort);
  const products = await listDeskProducts(filter, {
    q: q || undefined,
    userId: session.user.id,
    sortMode,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">품목 목록</h2>
          </div>
          <DeskEcountSyncButton />
        </div>
      </section>

      {products.length === 0 ? (
        <div className="space-y-3">
          <DeskProductListToolbar filter={filter} initialQ={q} sortMode={sortMode} />
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <tbody>
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-600">
                    {q ? (
                      <>
                        검색 결과가 없습니다. 검색어를 바꾸거나{" "}
                        <Link
                          href={buildDeskProductsListUrl(filter, "", sortMode)}
                          className="font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          검색 지우기
                        </Link>
                        를 눌러 보세요.
                      </>
                    ) : filter === "active" ? (
                      <>
                        사용 중으로 켜 둔 품목이 없습니다.{" "}
                        <Link
                          href={buildDeskProductsListUrl("all", "", sortMode)}
                          className="font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          전체
                        </Link>
                        에서 켜거나, 이카운트 동기화로 들어온 품목의「데스크 사용」을 켜 주세요.
                      </>
                    ) : filter === "inactive" ? (
                      <>
                        데스크 사용이 꺼진 품목이 없습니다. 이미 모두 켜 두었거나 등록된 품목이 없을 수 있습니다.{" "}
                        <Link
                          href={buildDeskProductsListUrl("all", "", sortMode)}
                          className="font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          전체
                        </Link>
                        에서 확인해 보세요.
                      </>
                    ) : (
                      <>
                        등록된 품목이 없습니다. 위에서{" "}
                        <span className="text-zinc-800">이카운트에서 품목 불러오기</span>를 누르거나 DB를 맞춘 뒤 다시
                        시도해 주세요.
                      </>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <DeskProductListTable products={products} sortMode={sortMode} filter={filter} initialQ={q} />
      )}
    </div>
  );
}
