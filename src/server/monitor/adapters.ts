/**
 * 販売サイトごとの取得ルール。
 * 新しいサイトへ対応するときは、この配列に1件足すだけでよい（判定処理そのものは共通）。
 * Mellojoy 専用の記述はここにも入れない。
 */

export type Adapter = {
  name: string;
  label: string;
  /** このアダプターが担当するホスト名。generic は null。 */
  hosts: RegExp | null;
  /** 同じURLへ連続アクセスしない最短間隔（秒）。サイトへの負荷をかけないための下限。 */
  minIntervalSec: number;
  /** 「買える」と判断する言葉 */
  positive: string[];
  /** 「買えない」と判断する言葉 */
  negative: string[];
  /** 監視してよいサイトか。false のときは登録時に断る。 */
  supported: boolean;
  /** supported が false のときに画面へ出す理由 */
  unsupportedReason?: string;
  note?: string;
};

const COMMON_POSITIVE = [
  "カートに入れる",
  "カートに追加",
  "かごに追加",
  "買い物かごに入れる",
  "レジに進む",
  "今すぐ購入",
  "購入手続きへ",
  "ご購入手続きへ",
  "予約する",
  "予約受付中",
  "add to cart",
  "add to bag",
  "buy now",
  "in stock",
];

const COMMON_NEGATIVE = [
  "売り切れ",
  "売切れ",
  "在庫切れ",
  "在庫がありません",
  "品切れ",
  "完売",
  "販売終了",
  "取り扱いできません",
  "お取り扱いできません",
  "入荷お知らせ",
  "再入荷通知",
  "sold out",
  "soldout",
  "out of stock",
  "currently unavailable",
];

export const GENERIC_ADAPTER: Adapter = {
  name: "generic",
  label: "汎用ルール",
  hosts: null,
  minIntervalSec: 1800,
  positive: COMMON_POSITIVE,
  negative: COMMON_NEGATIVE,
  supported: true,
  note: "商品ページの構造化データ（JSON-LD）と、ボタンの文言から判定します。",
};

export const ADAPTERS: Adapter[] = [
  {
    name: "rakuten",
    label: "楽天市場",
    hosts: /(^|\.)item\.rakuten\.co\.jp$/i,
    minIntervalSec: 900,
    positive: [...COMMON_POSITIVE, "買い物かご", "ご注文手続きへ"],
    negative: [...COMMON_NEGATIVE, "この商品は現在お取り扱いできません"],
    supported: true,
  },
  {
    name: "yahoo",
    label: "Yahoo!ショッピング",
    hosts: /(^|\.)(store\.shopping\.yahoo\.co\.jp|shopping\.yahoo\.co\.jp|paypaymall\.yahoo\.co\.jp)$/i,
    minIntervalSec: 900,
    positive: [...COMMON_POSITIVE, "カートに入れる"],
    negative: [...COMMON_NEGATIVE, "現在お取り扱いできません"],
    supported: true,
  },
  {
    name: "base",
    label: "BASE / STORES などの個人通販",
    hosts: /(^|\.)(thebase\.in|base\.shop|stores\.jp|shop-pro\.jp|myshopify\.com)$/i,
    minIntervalSec: 900,
    positive: COMMON_POSITIVE,
    negative: COMMON_NEGATIVE,
    supported: true,
  },
  {
    name: "amazon",
    label: "Amazon",
    hosts: /(^|\.)amazon\.(co\.jp|com)$/i,
    minIntervalSec: 3600,
    positive: COMMON_POSITIVE,
    negative: COMMON_NEGATIVE,
    supported: false,
    unsupportedReason:
      "Amazonは利用規約で自動巡回を禁止しているため、このアプリでは監視できません。販売開始予定日時を登録して、通知でお知らせする使い方をおすすめします。",
  },
  {
    name: "mercari",
    label: "メルカリ",
    hosts: /(^|\.)(mercari\.com|jp\.mercari\.com)$/i,
    minIntervalSec: 3600,
    positive: COMMON_POSITIVE,
    negative: COMMON_NEGATIVE,
    supported: false,
    unsupportedReason:
      "メルカリは利用規約で自動取得を禁止しているため、このアプリでは監視できません。",
  },
];

/** このアプリ自身が配信する練習用ページ。外部サイトではないので短い間隔で確認してよい。 */
export const DEMO_ADAPTER: Adapter = {
  name: "demo",
  label: "デモ用の模擬ショップ（このアプリ内）",
  hosts: null,
  minIntervalSec: 30,
  positive: COMMON_POSITIVE,
  negative: COMMON_NEGATIVE,
  supported: true,
  note: "実在しない練習用のページです。購入はできません。",
};

export const DEMO_PATH_PREFIX = "/demo/shop/";

export function isDemoUrl(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith(DEMO_PATH_PREFIX);
  } catch {
    return false;
  }
}

export function adapterForHost(host: string): Adapter {
  const found = ADAPTERS.find((a) => a.hosts?.test(host));
  return found ?? GENERIC_ADAPTER;
}

/** URL全体（パスを含む）から担当アダプターを決める。 */
export function adapterForUrl(url: string, host: string): Adapter {
  if (isDemoUrl(url)) return DEMO_ADAPTER;
  return adapterForHost(host);
}

export function adapterByName(name: string): Adapter {
  if (name === "demo") return DEMO_ADAPTER;
  return ADAPTERS.find((a) => a.name === name) ?? GENERIC_ADAPTER;
}
