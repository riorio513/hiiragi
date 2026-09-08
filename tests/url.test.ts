import { describe, expect, it } from "vitest";
import { normalizeUrl } from "@/server/monitor/url";

describe("normalizeUrl", () => {
  it("スキームを省略しても https を補う", () => {
    const result = normalizeUrl("item.rakuten.co.jp/shop/abc/");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toBe("https://item.rakuten.co.jp/shop/abc");
  });

  it("計測用パラメータと末尾スラッシュとハッシュを落として、同じURLに揃える", () => {
    const a = normalizeUrl("https://Shop.Example.com/item/1/?utm_source=x&scid=abc#top");
    const b = normalizeUrl("https://shop.example.com/item/1");
    expect(a.ok && b.ok && a.url === b.url).toBe(true);
  });

  it("商品を特定するパラメータは残す", () => {
    const result = normalizeUrl("https://store.shopping.yahoo.co.jp/shop/item.html?sku=12");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toContain("sku=12");
  });

  it("空欄・壊れたURL・別スキームは断る", () => {
    expect(normalizeUrl("").ok).toBe(false);
    expect(normalizeUrl("ht!tp://##").ok).toBe(false);
    expect(normalizeUrl("javascript:alert(1)").ok).toBe(false);
    expect(normalizeUrl("file:///etc/passwd").ok).toBe(false);
  });

  it("社内・手元のアドレスは断る（外部の商品ページだけを見る）", () => {
    expect(normalizeUrl("http://192.168.0.1/admin").ok).toBe(false);
    expect(normalizeUrl("http://127.0.0.1:3000/x").ok).toBe(false);
    expect(normalizeUrl("http://10.0.0.5/").ok).toBe(false);
    expect(normalizeUrl("http://172.16.3.4/").ok).toBe(false);
  });
});
