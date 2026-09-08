import { headers } from "next/headers";

/**
 * デモ（練習）用のしくみ。
 * 本物の販売サイトに触れずに「在庫なし → 在庫あり → 通知」を体験してもらうため、
 * このアプリ自身が模擬ショップのページを配信し、それを監視対象として登録する。
 * 模擬ページには実際の購入導線を置かない。
 */

export const DEMO_ITEMS = [
  { slug: "sample-a", name: "【デモ】サンプル商品A（練習用）", price: 2980 },
  { slug: "sample-b", name: "【デモ】サンプル商品B（練習用）", price: 5480 },
] as const;

export const DEMO_STORE_NAME = "ヒイラギ練習ショップ（デモ）";
export const DEMO_PRODUCT_NAME = "【デモ】サンプル商品A（練習用）";

/** 監視処理から自分自身を見に行くときのURLの土台。 */
export async function appBaseUrl(): Promise<string> {
  const fromEnv = process.env.APP_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
