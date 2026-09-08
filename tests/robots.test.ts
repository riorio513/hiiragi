import { describe, expect, it } from "vitest";
import { isPathAllowed, USER_AGENT_TOKEN } from "@/server/monitor/robots";

describe("isPathAllowed", () => {
  it("robots.txt が空なら許可", () => {
    expect(isPathAllowed("", USER_AGENT_TOKEN, "/item/1")).toBe(true);
  });

  it("すべて禁止されていれば見に行かない", () => {
    const txt = "User-agent: *\nDisallow: /";
    expect(isPathAllowed(txt, USER_AGENT_TOKEN, "/item/1")).toBe(false);
  });

  it("最長一致が勝つ（禁止の中の一部だけ許可）", () => {
    const txt = "User-agent: *\nDisallow: /item/\nAllow: /item/public/";
    expect(isPathAllowed(txt, USER_AGENT_TOKEN, "/item/secret")).toBe(false);
    expect(isPathAllowed(txt, USER_AGENT_TOKEN, "/item/public/1")).toBe(true);
  });

  it("自分の名前あてのグループがあればそちらを使う", () => {
    const txt = `User-agent: *\nDisallow: /\n\nUser-agent: ${USER_AGENT_TOKEN}\nAllow: /`;
    expect(isPathAllowed(txt, USER_AGENT_TOKEN, "/item/1")).toBe(true);
  });

  it("空の Disallow は全許可の意味", () => {
    expect(isPathAllowed("User-agent: *\nDisallow:", USER_AGENT_TOKEN, "/any")).toBe(true);
  });

  it("ワイルドカードと $ に対応する", () => {
    const txt = "User-agent: *\nDisallow: /*.pdf$";
    expect(isPathAllowed(txt, USER_AGENT_TOKEN, "/doc/a.pdf")).toBe(false);
    expect(isPathAllowed(txt, USER_AGENT_TOKEN, "/doc/a.html")).toBe(true);
  });

  it("コメント行は無視する", () => {
    const txt = "# コメント\nUser-agent: *\nDisallow: /admin # 管理画面";
    expect(isPathAllowed(txt, USER_AGENT_TOKEN, "/admin/x")).toBe(false);
  });
});
