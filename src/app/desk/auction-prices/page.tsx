import DeskAuctionPriceSheetClient from "@/components/desk/DeskAuctionPriceSheetClient";
import { listDeskProducts } from "@/components/desk/server/deskProductQueries";

function formatYmdKst(d: Date): string {
  const s = d.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
  const datePart = s.split(" ")[0] ?? "";
  return datePart.replace(/-/g, "");
}

export default async function DeskAuctionPricesPage() {
  const products = await listDeskProducts("active", { sortMode: "alpha" });
  return (
    <DeskAuctionPriceSheetClient
      products={products}
      initialProductId={products[0]?.id ?? null}
      initialSaleDateYmd={formatYmdKst(new Date())}
    />
  );
}
