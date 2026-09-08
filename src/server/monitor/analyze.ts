import type { StockStatus } from "@/lib/types";
import type { Adapter } from "./adapters";
import {
  actionableText,
  extractJsonLd,
  extractMeta,
  extractTitle,
  parsePrice,
  visibleText,
} from "./extract";

export type Analysis = {
  status: StockStatus;
  price: number | null;
  title: string | null;
  /** どの根拠で判定したか（画面と履歴に残す） */
  basis: string;
};

const AVAILABILITY_IN = ["instock", "in_stock", "preorder", "backorder", "onlineonly", "limitedavailability"];
const AVAILABILITY_OUT = ["outofstock", "out_of_stock", "soldout", "sold_out", "discontinued"];

function normalizeAvailability(value: string): StockStatus | null {
  const key = value.toLowerCase().replace(/^https?:\/\/schema\.org\//, "").replace(/[\s-]/g, "");
  if (AVAILABILITY_IN.includes(key)) return "in_stock";
  if (AVAILABILITY_OUT.includes(key)) return "out_of_stock";
  return null;
}

function hasAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

/**
 * HTMLから在庫と価格を読み取る。
 * 判断できないときは推測せず "unknown"（状態不明）を返す。これがこのアプリの約束。
 */
export function analyze(html: string, adapter: Adapter): Analysis {
  const title = extractTitle(html);

  // 1) 構造化データ（schema.org）。サイトが自分で書いている情報なので最優先。
  let ldStatus: StockStatus | null = null;
  let ldPrice: number | null = null;
  for (const node of extractJsonLd(html)) {
    const availability = node["availability"];
    if (typeof availability === "string" && ldStatus === null) {
      ldStatus = normalizeAvailability(availability);
    }
    if (ldPrice === null) {
      const price = parsePrice(node["price"] ?? node["lowPrice"] ?? null);
      if (price !== null) ldPrice = price;
    }
  }

  // 2) meta タグ
  const metaAvailability =
    extractMeta(html, "product:availability") ??
    extractMeta(html, "og:availability") ??
    extractMeta(html, "availability");
  const metaStatus = metaAvailability ? normalizeAvailability(metaAvailability) : null;
  const metaPrice =
    parsePrice(extractMeta(html, "product:price:amount")) ??
    parsePrice(extractMeta(html, "og:price:amount")) ??
    parsePrice(extractMeta(html, "price"));

  const price = ldPrice ?? metaPrice ?? null;

  if (ldStatus) return { status: ldStatus, price, title, basis: "構造化データ(JSON-LD)" };
  if (metaStatus) return { status: metaStatus, price, title, basis: "metaタグ" };

  // 3) ボタンやリンクの文言。押せる場所だけを見るので、おすすめ欄の「SOLD OUT」に引っかかりにくい。
  const buttons = actionableText(html);
  const buttonPositive = hasAny(buttons, adapter.positive);
  const buttonNegative = hasAny(buttons, adapter.negative);
  if (buttonPositive && !buttonNegative) {
    return { status: "in_stock", price, title, basis: "ボタンの文言" };
  }
  if (buttonNegative && !buttonPositive) {
    return { status: "out_of_stock", price, title, basis: "ボタンの文言" };
  }
  if (buttonPositive && buttonNegative) {
    return { status: "unknown", price, title, basis: "ボタンの文言が両方あり判断できず" };
  }

  // 4) 本文全体。ここまで来ると根拠が弱いので、片方だけ見つかったときしか判定しない。
  const body = visibleText(html).slice(0, 200_000);
  const bodyPositive = hasAny(body, adapter.positive);
  const bodyNegative = hasAny(body, adapter.negative);
  if (bodyNegative && !bodyPositive) {
    return { status: "out_of_stock", price, title, basis: "ページ本文の文言" };
  }
  if (bodyPositive && !bodyNegative) {
    return { status: "in_stock", price, title, basis: "ページ本文の文言" };
  }

  return { status: "unknown", price, title, basis: "判定できる手がかりが見つからず" };
}
