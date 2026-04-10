"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { ApiResponse } from "@/components/common/api/server/contracts";
import type { DeskProduct } from "@/types/deskProduct";
import {
  DESK_AUCTION_DEFAULT_MAX_MARKETS,
  DESK_AUCTION_MAX_ROWS_PER_MARKET,
  type DeskAuctionPriceSheetData,
} from "@/types/deskAuctionPriceSheet";

function formatYmdKst(d: Date): string {
  const s = d.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
  const datePart = s.split(" ")[0] ?? "";
  return datePart.replace(/-/g, "");
}

function yesterdayYmdKst(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatYmdKst(d);
}

function formatNum(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("ko-KR");
}

type PageProps = {
  mode: "page";
  products: DeskProduct[];
  initialProductId: string | null;
  initialSaleDateYmd: string;
};

type EmbeddedProps = {
  mode: "embedded";
  deskProductId: string;
  /** 상단에 품목·규격 안내(예: 목록과 동일 라벨) */
  productSummary?: string;
  /** 기준 경매일 — 비우면 전일(KST) */
  initialSaleDateYmd?: string;
  /** 시장별 「전체 경매 건」 블록을 기본 펼침(등급·건 전부 확인) */
  defaultOpenMarketDetails?: boolean;
};

export type DeskWholesaleAuctionSheetProps = PageProps | EmbeddedProps;

export default function DeskWholesaleAuctionSheet(props: DeskWholesaleAuctionSheetProps) {
  const isEmbedded = props.mode === "embedded";

  const [productId, setProductId] = useState(
    isEmbedded ? props.deskProductId : props.initialProductId ?? "",
  );

  const [saleDate, setSaleDate] = useState(() => {
    if (isEmbedded) {
      const y = props.initialSaleDateYmd?.trim();
      if (y && /^\d{8}$/.test(y)) return y;
      return yesterdayYmdKst();
    }
    const y = props.initialSaleDateYmd;
    return y.length === 8 ? y : formatYmdKst(new Date());
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<DeskAuctionPriceSheetData | null>(null);

  const defaultOpenDetails = isEmbedded && (props.defaultOpenMarketDetails ?? true);

  useEffect(() => {
    if (props.mode !== "embedded") return;
    setProductId(props.deskProductId);
  }, [props.mode, props.mode === "embedded" ? props.deskProductId : ""]);

  const dateInputValue = useMemo(() => {
    if (saleDate.length !== 8) return "";
    return `${saleDate.slice(0, 4)}-${saleDate.slice(4, 6)}-${saleDate.slice(6, 8)}`;
  }, [saleDate]);

  const load = useCallback(async () => {
    const pid = productId.trim();
    if (!pid) {
      setError("품목을 선택해 주세요.");
      return;
    }
    let ymd = saleDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      ymd = ymd.replace(/-/g, "");
    }
    if (!/^\d{8}$/.test(ymd)) {
      setError("경매일은 YYYYMMDD 형식이어야 합니다.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ deskProductId: pid, saleDate: ymd });
      const res = await fetch(`/api/desk/auction-prices?${qs.toString()}`);
      const body = (await res.json()) as ApiResponse<DeskAuctionPriceSheetData> | { ok: false; message?: string };
      if (!res.ok || !("ok" in body) || body.ok === false) {
        const msg =
          body && typeof body === "object" && "message" in body && typeof body.message === "string"
            ? body.message
            : `조회 실패 (${res.status})`;
        setSheet(null);
        setError(msg);
        return;
      }
      setSheet(body.data);
    } catch {
      setSheet(null);
      setError("네트워크 오류로 시세를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [productId, saleDate]);

  useEffect(() => {
    if (!productId.trim()) return;
    void load();
  }, [productId, saleDate, load]);

  const introPage = (
    <>
      <h2 className="text-xl font-semibold text-zinc-900">전국 도매시장 실시간 경매 시세</h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600">
        <strong className="font-semibold text-zinc-800">저장된 품목명·규격·포장단위</strong>로 농식품 품목코드를 자동 맞춘 뒤, 시장별 경매
        낙찰가를 모읍니다. 서울가락은 상단에 두고, 시장당 최대 {DESK_AUCTION_DEFAULT_MAX_MARKETS}곳까지 조회합니다. 시장 한 곳당 API에서
        가져올 수 있는 만큼(최대 {DESK_AUCTION_MAX_ROWS_PER_MARKET}건) 전 건을 펼쳐 볼 수 있습니다.
      </p>
    </>
  );

  const introEmbedded = (
    <>
      <h3 className="text-base font-semibold text-emerald-900">전국 도매시장 경매 낙찰가</h3>
      {props.mode === "embedded" && props.productSummary ? (
        <p className="mt-1 text-sm font-medium text-zinc-800">{props.productSummary}</p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed text-zinc-700">
        저장된 품목명·규격으로 품목코드를 맞춘 뒤, 전국 도매시장별 경락가를 불러옵니다.{" "}
        <strong className="font-semibold text-zinc-900">등급을 따로 지정하지 않았으면</strong> API가 반환하는{" "}
        <strong className="font-semibold text-zinc-900">모든 등급·규격(거래 건)</strong>이 시장별 표에 나옵니다.
      </p>
    </>
  );

  return (
    <div className="space-y-6">
      <section
        className={
          isEmbedded
            ? "rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm sm:p-5"
            : "rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
        }
      >
        {isEmbedded ? introEmbedded : introPage}

        <div className={`flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end ${isEmbedded ? "mt-4" : "mt-6"}`}>
          {!isEmbedded && props.mode === "page" ? (
            <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-700">품목</span>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="">선택…</option>
                {props.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.specLabel && p.specLabel !== "—" ? ` · ${p.specLabel}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex min-w-[180px] flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-700">경매 기준일</span>
            <input
              type="date"
              value={dateInputValue}
              onChange={(e) => {
                const v = e.target.value.replace(/-/g, "");
                if (/^\d{8}$/.test(v)) setSaleDate(v);
              }}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? "불러오는 중…" : "다시 조회"}
          </button>
        </div>

        {loading && !sheet ? (
          <p className={`text-sm text-zinc-600 ${isEmbedded ? "mt-4" : "mt-4"}`}>도매시장별 시세를 불러오는 중입니다…</p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {sheet ? (
        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:px-6">
            <p className="text-sm font-semibold text-zinc-900">{sheet.productName}</p>
            <p className="mt-1 text-xs text-zinc-500">
              규격 {sheet.specLabel}
              {sheet.packageUnit ? ` · 포장 ${sheet.packageUnit}` : ""}
            </p>
            {(sheet.itemResolutionSource ?? (sheet.smallResolvedFromCodebook ? "codebook" : "db")) === "codebook" ? (
              <div
                className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950"
                role="status"
              >
                <p className="font-semibold text-amber-950">시세 기준: 코드사전 자동 추정</p>
                <p className="mt-1">
                  검색 문장: <span className="font-mono text-[11px]">{sheet.codebookMatchedQuery ?? "—"}</span>
                  {sheet.codebookMatchedItemName ? (
                    <>
                      {" "}
                      → 맞춘 품목명: <strong className="font-semibold">{sheet.codebookMatchedItemName}</strong>
                    </>
                  ) : null}
                </p>
                <p className="mt-1 text-amber-900/90">
                  품목명을 우선해 매칭합니다. 엉뚱하면 상세 상단 「시세·가격비교용 코드」에서 대·중·소를 저장해 주세요.
                </p>
                {sheet.codebookPlausibilitySkipped ? (
                  <p className="mt-2 border-t border-amber-200/80 pt-2 text-amber-950/95">
                    이름·품목명 교차검증 없이 코드만 맞춘 결과입니다. 시세가 이상하면 고급 메뉴에서 코드를 확정해 주세요.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-950">
                시세 기준: DB에 저장된 농식품 대·중·소 코드
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-zinc-600">
              <span className="font-semibold text-zinc-800">조회에 쓴 품목 코드</span>{" "}
              <span className="text-zinc-500">(가락 API LARGE · MID · SMALL — 등급과 무관)</span>
              <br />
              <span className="font-mono text-[11px] text-zinc-800">
                LARGE {sheet.mafraLarge ?? "—"} · MID {sheet.mafraMid ?? "—"} · SMALL {sheet.mafraSmall}
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              저장된 등급 코드(참고, 이번 시세 조회에는 사용 안 함):{" "}
              <span className="font-mono text-[11px]">{sheet.mafraGrdCodeId?.trim() || "—"}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              DB에 <strong className="font-semibold text-zinc-700">대·중·소가 모두</strong> 있으면 경매 API에도 세 값을 함께 넣어 품목을
              좁힙니다. 소(SMALL)만 짧은 코드(예: 01)이면 여러 품목에 걸릴 수 있어, 「시세용 품목 확정」에서 한 줄을 고르면 보통 세
              칸이 같이 채워집니다. 일부만 비었을 때만 SMALL만 조건으로 넣습니다.
            </p>
            <p className="mt-1 text-xs text-zinc-500">경매일 {sheet.saleDate}</p>
            <p className="mt-1 text-xs text-zinc-500">
              도매시장 코드 {sheet.marketsInCache}곳 중 {sheet.marketsQueried}곳 조회 · 시장당 최대 {sheet.rowsSampledPerMarket}건
              {sheet.marketCodesUpdatedAt ? ` · 시장코드 갱신 ${sheet.marketCodesUpdatedAt}` : ""}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-white text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">도매시장</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">건수</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">평균</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">최저</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">최고</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">첫 건</th>
                  <th className="min-w-[120px] px-4 py-3 sm:px-6">비고</th>
                </tr>
              </thead>
              <tbody>
                {sheet.markets.map((row) => (
                  <Fragment key={row.whsalcd}>
                    <tr
                      className={[
                        "border-b border-zinc-100",
                        row.isGarak ? "bg-emerald-50/80" : "bg-white hover:bg-zinc-50/80",
                      ].join(" ")}
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900 sm:px-6">
                        {row.marketName}
                        {row.apiWhsalName && row.apiWhsalName !== row.marketName ? (
                          <span className="ml-1 text-xs font-normal text-zinc-500">({row.apiWhsalName})</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-800 sm:px-6">
                        {row.error
                          ? "—"
                          : row.apiTotalCount != null && row.apiTotalCount > row.rowCount
                            ? `${row.rowCount}/${row.apiTotalCount}`
                            : row.rowCount}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-800 sm:px-6">{formatNum(row.avgCost)}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-800 sm:px-6">{formatNum(row.minCost)}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-800 sm:px-6">{formatNum(row.maxCost)}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-800 sm:px-6">{formatNum(row.firstCost)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600 sm:px-6">
                        {row.error ? (
                          <span className="text-red-700">{row.error}</span>
                        ) : row.rowCount === 0 ? (
                          "해당일 거래 없음"
                        ) : row.detailRows.length > 0 ? (
                          <span className="text-zinc-500">{defaultOpenDetails ? "아래 전체 건" : "아래에서 전체 건 보기"}</span>
                        ) : null}
                      </td>
                    </tr>
                    {!row.error && row.detailRows.length > 0 ? (
                      <tr className="border-b border-zinc-100 bg-zinc-50/50">
                        <td colSpan={7} className="px-3 py-2 sm:px-5">
                          <details
                            className="group rounded-lg border border-zinc-200 bg-white text-xs shadow-sm"
                            ref={(el) => {
                              if (!el || !defaultOpenDetails) return;
                              if (el.dataset.initialWholesaleOpen === "1") return;
                              el.open = true;
                              el.dataset.initialWholesaleOpen = "1";
                            }}
                          >
                            <summary className="cursor-pointer list-none px-3 py-2 font-medium text-zinc-800 marker:content-none [&::-webkit-details-marker]:hidden">
                              전체 경매 건 · 동일 소(SMALL) 기준 등급·규격별 ({row.detailRows.length}
                              {row.apiTotalCount != null && row.apiTotalCount > row.detailRows.length
                                ? ` · API상 전체 ${row.apiTotalCount}건 중 표시분`
                                : ""}
                              )
                            </summary>
                            <div className="max-h-80 overflow-auto border-t border-zinc-100">
                              <table className="min-w-full border-collapse text-left">
                                <thead className="sticky top-0 bg-zinc-100 text-[10px] font-semibold uppercase text-zinc-600">
                                  <tr>
                                    <th className="whitespace-nowrap px-2 py-1.5">낙찰가</th>
                                    <th className="whitespace-nowrap px-2 py-1.5">수량</th>
                                    <th className="whitespace-nowrap px-2 py-1.5">규격·등급</th>
                                    <th className="whitespace-nowrap px-2 py-1.5">시간</th>
                                    <th className="whitespace-nowrap px-2 py-1.5">법인</th>
                                    <th className="whitespace-nowrap px-2 py-1.5">SMALL</th>
                                    <th className="whitespace-nowrap px-2 py-1.5">소품목명</th>
                                    <th className="whitespace-nowrap px-2 py-1.5">산지</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.detailRows.map((d, i) => (
                                    <tr key={`${row.whsalcd}-${i}`} className="border-t border-zinc-100">
                                      <td className="whitespace-nowrap px-2 py-1 tabular-nums text-zinc-900">{d.cost}</td>
                                      <td className="whitespace-nowrap px-2 py-1 text-zinc-700">{d.qty}</td>
                                      <td className="px-2 py-1 text-zinc-700">{d.std}</td>
                                      <td className="whitespace-nowrap px-2 py-1 text-zinc-600">{d.sbidtime}</td>
                                      <td className="whitespace-nowrap px-2 py-1 text-zinc-700">{d.cmpName}</td>
                                      <td className="whitespace-nowrap px-2 py-1 font-mono text-[10px] text-zinc-800">
                                        {d.smallCode || "—"}
                                      </td>
                                      <td className="px-2 py-1 text-zinc-700">{d.smallName}</td>
                                      <td className="px-2 py-1 text-zinc-600">{d.sanName}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
