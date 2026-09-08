import type { MetadataRoute } from "next";

/**
 * 個人用の道具なので検索エンジンには載せない。
 * ただし練習用の模擬ショップだけは、このアプリ自身の監視処理が読みに来るので許可する。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/", allow: "/demo/shop/" }],
  };
}
