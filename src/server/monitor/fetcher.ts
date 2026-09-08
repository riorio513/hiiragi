import { normalizeUrl } from "./url";
import { USER_AGENT_TOKEN } from "./robots";

/**
 * 商品ページの取得。
 * ・時間制限つき（固まらない）
 * ・大きすぎるページは途中で打ち切る
 * ・リダイレクト先が社内アドレス等に変わっていないか確認する
 */

export const USER_AGENT = `Mozilla/5.0 (compatible; ${USER_AGENT_TOKEN}/1.0; +personal stock watcher)`;
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 3_000_000;

export type FetchOk = { ok: true; status: number; html: string; finalUrl: string };
export type FetchNg = { ok: false; status: number | null; code: string; message: string };
export type FetchOutcome = FetchOk | FetchNg;

export async function fetchPage(url: string, fetchImpl = fetch): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "ja,en;q=0.8",
      },
    });

    const finalUrl = res.url || url;
    const finalCheck = normalizeUrl(finalUrl);
    if (!finalCheck.ok) {
      return {
        ok: false,
        status: res.status,
        code: "redirect_blocked",
        message: "転送先のURLが監視できない場所でした。",
      };
    }

    if (res.status === 404 || res.status === 410) {
      return {
        ok: false,
        status: res.status,
        code: "not_found",
        message: "商品ページが見つかりません（削除・URL変更の可能性）。",
      };
    }
    if (res.status === 403 || res.status === 401) {
      return {
        ok: false,
        status: res.status,
        code: "forbidden",
        message: "販売サイトからアクセスを断られました。",
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        status: res.status,
        code: "rate_limited",
        message: "アクセスが多すぎるとサイトに判断されました。間隔をあけて再試行します。",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: "http_error",
        message: `販売サイトがエラーを返しました（${res.status}）。`,
      };
    }

    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text\/plain|json/i.test(type)) {
      return {
        ok: false,
        status: res.status,
        code: "not_html",
        message: `商品ページではない形式でした（${type.split(";")[0]}）。`,
      };
    }

    const html = (await readCapped(res)).slice(0, MAX_BYTES);
    return { ok: true, status: res.status, html, finalUrl: finalCheck.url };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      return { ok: false, status: null, code: "timeout", message: "販売サイトの応答がありませんでした。" };
    }
    return {
      ok: false,
      status: null,
      code: "network_error",
      message: "販売サイトへ接続できませんでした。",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res: Response): Promise<string> {
  const length = Number(res.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES) {
    // ヘッダーの時点で大きすぎるなら本文は読まない
    return "";
  }
  return await res.text();
}
