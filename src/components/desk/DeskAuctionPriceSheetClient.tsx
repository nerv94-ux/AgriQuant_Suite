"use client";

import DeskWholesaleAuctionSheet from "@/components/desk/DeskWholesaleAuctionSheet";
import type { DeskProduct } from "@/types/deskProduct";

type Props = {
  products: DeskProduct[];
  initialProductId: string | null;
  initialSaleDateYmd: string;
};

/** `/desk/auction-prices` 전용 — 품목 선택형 전국 시세표 */
export default function DeskAuctionPriceSheetClient(props: Props) {
  return <DeskWholesaleAuctionSheet mode="page" {...props} />;
}
