import Link from "next/link";
import { notFound } from "next/navigation";
import { requireApprovedUser } from "@/components/common/auth/server/requireApproved";
import DeskProductDeskEnabledToggle from "@/components/desk/DeskProductDeskEnabledToggle";
import DeskProductDetailSections from "@/components/desk/DeskProductDetailSections";
import DeskProductDisplayEditor from "@/components/desk/DeskProductDisplayEditor";
import DeskProductEcountMeta from "@/components/desk/DeskProductEcountMeta";
import DeskProductMafraCodesEditor from "@/components/desk/DeskProductMafraCodesEditor";
import DeskProductTouchLastUsed from "@/components/desk/DeskProductTouchLastUsed";
import { getDeskProductById } from "@/components/desk/server/deskProductQueries";
import { getDeskProductUserDraft } from "@/components/desk/server/deskUserDraftQueries";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeskProductDetailPage({ params }: PageProps) {
  const session = await requireApprovedUser();
  const { id } = await params;
  const product = await getDeskProductById(id);
  if (!product) {
    notFound();
  }
  const initialDraft = await getDeskProductUserDraft(session.user.id, product.id);
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="space-y-8">
      <DeskProductTouchLastUsed deskProductId={product.id} />
      <div>
        <Link href="/desk/products" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
          ← 품목 목록
        </Link>
        <h2 className="mt-2 text-xl font-semibold leading-snug text-zinc-900">{product.name}</h2>
        <p className="mt-1 text-sm text-zinc-600">
          출처: {product.source === "ecount" ? "이카운트" : "수동"}
          {product.ecountProdCode ? ` · 품목코드(전체): ${product.ecountProdCode}` : ""} · 내부 ID: {product.id}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm text-zinc-600">데스크에서 이 품목 사용</span>
          <DeskProductDeskEnabledToggle productId={product.id} initialEnabled={product.deskEnabled} />
        </div>
        <DeskProductEcountMeta product={product} />
        <DeskProductMafraCodesEditor
          productId={product.id}
          initialMafraLarge={product.mafraLarge}
          initialMafraMid={product.mafraMid}
          initialMafraSmall={product.mafraSmall}
          initialMafraUnitCodeId={product.mafraUnitCodeId}
          initialMafraGrdCodeId={product.mafraGrdCodeId}
          initialMafraFrmlCodeId={product.mafraFrmlCodeId}
        />
        {isAdmin && product.source === "ecount" ? (
          <DeskProductDisplayEditor
            productId={product.id}
            initialName={product.name}
            initialSpecLabel={product.specLabel}
            initialPackageUnit={product.packageUnit}
            initialDisplayLocked={product.displayLocked}
            needsSourceReview={product.needsSourceReview}
          />
        ) : null}
      </div>

        <DeskProductDetailSections
          productId={product.id}
          productName={product.name}
          specLabel={product.specLabel}
          packageUnit={product.packageUnit}
          initialDraft={initialDraft}
          savedMafraLarge={product.mafraLarge}
          savedMafraMid={product.mafraMid}
          savedMafraSmall={product.mafraSmall}
          savedMafraUnitCodeId={product.mafraUnitCodeId}
          savedMafraGrdCodeId={product.mafraGrdCodeId}
          savedMafraFrmlCodeId={product.mafraFrmlCodeId}
          initialEcoCtgryCd={product.ecoCtgryCd}
          initialEcoItemCd={product.ecoItemCd}
          initialEcoVrtyCd={product.ecoVrtyCd}
          initialEcoGrdCd={product.ecoGrdCd}
          initialEcoSggCd={product.ecoSggCd}
          initialEcoMrktCd={product.ecoMrktCd}
        />
    </div>
  );
}
