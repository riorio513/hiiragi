import { describe, expect, it } from "vitest";
import { analyze } from "@/server/monitor/analyze";
import { GENERIC_ADAPTER } from "@/server/monitor/adapters";

function page(body: string, head = ""): string {
  return `<html><head><title>テスト商品 | サンプル店</title>${head}</head><body>${body}</body></html>`;
}

describe("analyze", () => {
  it("構造化データの InStock を最優先で読む", () => {
    const html = page(
      "<p>SOLD OUT の文字もあるが構造化データを優先する</p>",
      `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "テスト商品",
        offers: { "@type": "Offer", price: "2980", priceCurrency: "JPY", availability: "https://schema.org/InStock" },
      })}</script>`,
    );
    const result = analyze(html, GENERIC_ADAPTER);
    expect(result.status).toBe("in_stock");
    expect(result.price).toBe(2980);
    expect(result.title).toBe("テスト商品 | サンプル店");
  });

  it("構造化データの OutOfStock を読む", () => {
    const html = page(
      "",
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "Product",
        offers: { price: 4980, availability: "OutOfStock" },
      })}</script>`,
    );
    expect(analyze(html, GENERIC_ADAPTER).status).toBe("out_of_stock");
  });

  it("meta タグからも読む", () => {
    const html = page(
      "",
      `<meta property="product:availability" content="instock"><meta property="product:price:amount" content="1,200">`,
    );
    const result = analyze(html, GENERIC_ADAPTER);
    expect(result.status).toBe("in_stock");
    expect(result.price).toBe(1200);
  });

  it("ボタンの文言で在庫ありと判断する", () => {
    const html = page(`<div><button>カートに入れる</button></div>`);
    expect(analyze(html, GENERIC_ADAPTER).status).toBe("in_stock");
  });

  it("おすすめ欄の SOLD OUT に引っかからない（押せる場所を先に見る）", () => {
    const html = page(
      `<button>カートに入れる</button><aside><p>関連商品：別の商品 SOLD OUT</p></aside>`,
    );
    expect(analyze(html, GENERIC_ADAPTER).status).toBe("in_stock");
  });

  it("買える言葉と買えない言葉が同じ場所に両方あるときは状態不明にする", () => {
    const html = page(`<button>カートに入れる</button><button>SOLD OUT</button>`);
    expect(analyze(html, GENERIC_ADAPTER).status).toBe("unknown");
  });

  it("手がかりが無いときは在庫なしと決めつけない", () => {
    const html = page(`<p>この商品についての説明文だけがあります。</p>`);
    expect(analyze(html, GENERIC_ADAPTER).status).toBe("unknown");
  });

  it("script の中の文字は本文として数えない", () => {
    const html = page(`<script>var label = "カートに入れる";</script><p>説明</p>`);
    expect(analyze(html, GENERIC_ADAPTER).status).toBe("unknown");
  });

  it("壊れた JSON-LD があっても落ちない", () => {
    const html = page(`<button>SOLD OUT</button>`, `<script type="application/ld+json">{ぐちゃ</script>`);
    expect(analyze(html, GENERIC_ADAPTER).status).toBe("out_of_stock");
  });
});
