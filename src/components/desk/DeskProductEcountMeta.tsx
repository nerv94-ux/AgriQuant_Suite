import DeskProductNameParts from "@/components/desk/DeskProductNameParts";
import type { DeskProduct } from "@/types/deskProduct";

type DeskProductEcountMetaProps = {
  product: DeskProduct;
};

/** 이카운트 품목 — 코드·구분·표시 품목명·규격 */
export default function DeskProductEcountMeta({ product }: DeskProductEcountMetaProps) {
  if (product.source !== "ecount") {
    return null;
  }

  return (
    <div className="mt-4 space-y-4">
      {product.needsSourceReview ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          이카운트 쪽 품목 문구가 바뀐 뒤 아직 표시명이 맞는지 확인되지 않았습니다. 관리자에게 정리·저장을 요청하거나, 관리자 계정에서 상세 하단의 표시명 설정을 확인해 주세요.
        </div>
      ) : null}
      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">품목코드(앞)</p>
          <p className="mt-1 font-mono text-sm text-zinc-900">{product.ecountCodeBase ?? product.ecountProdCode ?? "—"}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">구분</p>
          <p className="mt-1 text-sm text-zinc-700">{product.ecountCodeSuffix ?? "—"}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">표시 품목명</p>
          <div className="mt-2">
            <DeskProductNameParts parts={product.nameParts} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">규격</p>
          <p className="mt-1 text-sm text-zinc-700">{product.specLabel}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">포장단위</p>
          <p className="mt-1 text-sm text-zinc-700">
            {product.packageUnit.trim() !== "" ? product.packageUnit : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
