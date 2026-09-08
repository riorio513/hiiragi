import { STOCK_LABEL, STOCK_MARK, type StockStatus } from "@/lib/types";

const STYLE: Record<StockStatus, string> = {
  in_stock: "bg-holly-100 text-holly-700",
  out_of_stock: "bg-red-50 text-berry-600",
  unknown: "bg-gray-100 text-gray-600",
  error: "bg-amber-50 text-amber-700",
};

export default function StatusBadge({
  status,
  className = "",
}: {
  status: StockStatus | null | undefined;
  className?: string;
}) {
  const value: StockStatus = status ?? "unknown";
  const label = status ? STOCK_LABEL[value] : "未確認";
  return (
    <span className={`chip ${STYLE[value]} ${className}`}>
      <span aria-hidden>{STOCK_MARK[value]}</span>
      {label}
    </span>
  );
}
