import Link from "next/link";

export default function DeskHomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-zinc-900">어그리쿼트 데스크</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600">
          품목·규격을 기준으로 시세를 모으고, 소비자가·도매가 레퍼런스를 나눠 판매가를 정하는 내부용 화면입니다. 품목은
          DB에서 불러오며, 품목을 누르면 상세에서 도매·소비자가·판매가 영역(뼈대)을 볼 수 있습니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/desk/products"
            className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
          >
            품목 목록
          </Link>
          <Link
            href="/desk/auction-prices"
            className="inline-flex h-10 items-center rounded-xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50"
          >
            전국 시세표
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "품목 마스터", body: "등록·규격 관리 (설계 예정)" },
          {
            title: "도매·경매",
            body: "전국 도매시장 실시간 경매 시세표에서 시장별 낙찰가를 비교합니다.",
          },
          { title: "소비자가", body: "오픈마켓·소비자가 레퍼런스" },
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">{card.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">{card.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
