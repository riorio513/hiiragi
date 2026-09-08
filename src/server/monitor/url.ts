/**
 * 商品URLの検証と正規化。
 * 同じページを指すURLは同じ文字列に揃えて、監視対象を利用者間で共有できるようにする。
 */

export type UrlCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; code: UrlErrorCode; message: string };

export type UrlErrorCode =
  | "empty"
  | "invalid"
  | "scheme"
  | "host"
  | "private";

/** 計測用のパラメータなど、ページの中身に影響しないものは落とす。 */
const DROP_PARAM_PREFIXES = ["utm_", "_ga", "_gl", "yclid", "gclid", "fbclid", "dclid"];
const DROP_PARAMS = new Set([
  "ref",
  "ref_",
  "rtg",
  "trflg",
  "scid",
  "sc_e",
  "sc_i",
  "sc_lid",
  "cid",
  "icm_cid",
  "iasid",
]);

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[?::1\]?)/i;
const PRIVATE_172 = /^172\.(1[6-9]|2\d|3[01])\./;

function localBaseHost(): string | null {
  const base = process.env.APP_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * 入力されたURLを検証して正規化する。
 * スキーム省略（例: shop.example.com/item/1）は https を補う。
 */
export function normalizeUrl(raw: string): UrlCheck {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, code: "empty", message: "URLが入力されていません。" };

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return {
      ok: false,
      code: "invalid",
      message: "URLの形が正しくありません。https:// から始まる商品ページのURLを貼り付けてください。",
    };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, code: "scheme", message: "http または https のURLだけ登録できます。" };
  }

  const host = parsed.hostname.toLowerCase();
  const allowedLocal = localBaseHost();
  const isLocalDemo = allowedLocal !== null && parsed.host.toLowerCase() === allowedLocal;

  if (!isLocalDemo) {
    if (!host.includes(".")) {
      return { ok: false, code: "host", message: "販売サイトのドメインが読み取れませんでした。" };
    }
    if (PRIVATE_HOST.test(host) || PRIVATE_172.test(host)) {
      return {
        ok: false,
        code: "private",
        message: "インターネット上に公開されている商品ページのURLを入力してください。",
      };
    }
  }

  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  parsed.hostname = host;
  if (
    (parsed.protocol === "https:" && parsed.port === "443") ||
    (parsed.protocol === "http:" && parsed.port === "80")
  ) {
    parsed.port = "";
  }

  const keys = [...parsed.searchParams.keys()];
  for (const key of keys) {
    const lower = key.toLowerCase();
    if (DROP_PARAMS.has(lower) || DROP_PARAM_PREFIXES.some((p) => lower.startsWith(p))) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.search = parsed.searchParams.toString() ? `?${parsed.searchParams.toString()}` : "";

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return { ok: true, url: parsed.toString(), host: parsed.host.toLowerCase() };
}

/** 取得したHTMLの中のURLを、通知リンクとして安全に使えるものだけに絞る。 */
export function isSafeLink(url: string): boolean {
  const check = normalizeUrl(url);
  return check.ok;
}
