export type StockStatus = "in_stock" | "out_of_stock" | "unknown" | "error";

export const STOCK_LABEL: Record<StockStatus, string> = {
  in_stock: "在庫あり",
  out_of_stock: "在庫なし",
  unknown: "状態不明",
  error: "取得エラー",
};

export const STOCK_MARK: Record<StockStatus, string> = {
  in_stock: "🟢",
  out_of_stock: "🔴",
  unknown: "⚪",
  error: "⚠️",
};

export const STORE_KINDS = [
  { value: "official_shop", label: "公式オンラインショップ" },
  { value: "ec_mall", label: "ECモール" },
  { value: "personal", label: "個人通販" },
  { value: "physical", label: "実店舗" },
  { value: "other", label: "その他" },
] as const;

export const SNS_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "line", label: "LINE" },
  { value: "other", label: "その他" },
] as const;

export const NOTIFICATION_LABEL: Record<string, string> = {
  back_in_stock: "在庫復活",
  price_drop: "希望価格",
  sale_soon: "販売開始",
  error: "取得エラー",
};

export function storeKindLabel(value: string): string {
  return STORE_KINDS.find((k) => k.value === value)?.label ?? "その他";
}

export function platformLabel(value: string): string {
  return SNS_PLATFORMS.find((k) => k.value === value)?.label ?? "その他";
}
