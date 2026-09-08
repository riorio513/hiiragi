/**
 * HTMLから必要な情報だけを取り出す小さな道具箱。
 * 外部ライブラリは使わず、正規表現で「タイトル」「meta」「JSON-LD」「本文テキスト」を拾う。
 * 取り出した文字列はそのまま画面へ出さず、必ずReact経由で表示する（XSS対策）。
 */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  yen: "¥",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeChar(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[String(name).toLowerCase()] ?? m);
}

function safeChar(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/** script / style / noscript / コメントを落として、可視テキストだけにする。 */
export function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** ボタンやリンクなど「押せる場所」の文字だけを集める。在庫判定の誤爆を減らすため。 */
export function actionableText(html: string): string {
  const chunks: string[] = [];
  const patterns = [
    /<button\b[^>]*>([\s\S]*?)<\/button>/gi,
    /<a\b[^>]*>([\s\S]*?)<\/a>/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) chunks.push(visibleText(m[1]));
  }
  let inputMatch: RegExpExecArray | null;
  const inputRe = /<input\b[^>]*>/gi;
  while ((inputMatch = inputRe.exec(html)) !== null) {
    const value = /value\s*=\s*("([^"]*)"|'([^']*)')/i.exec(inputMatch[0]);
    if (value) chunks.push(decodeEntities(value[2] ?? value[3] ?? ""));
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

export function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (m) {
    const text = decodeEntities(m[1]).replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, 300);
  }
  const og = extractMeta(html, "og:title");
  return og ? og.slice(0, 300) : null;
}

/** name / property / itemprop のどれで書かれていても拾う。 */
export function extractMeta(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta\\b[^>]*(?:name|property|itemprop)\\s*=\\s*["']${escapeRe(key)}["'][^>]*>`,
    "i",
  );
  const tag = re.exec(html);
  if (!tag) return null;
  const content = /content\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag[0]);
  if (!content) return null;
  const value = decodeEntities(content[2] ?? content[3] ?? "").trim();
  return value || null;
}

function escapeRe(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type JsonLdNode = Record<string, unknown>;

/** <script type="application/ld+json"> を全部読み、入れ子も平らに展開する。 */
export function extractJsonLd(html: string): JsonLdNode[] {
  const out: JsonLdNode[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim().replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
    try {
      flatten(JSON.parse(raw), out, 0);
    } catch {
      // 壊れたJSON-LDは黙って無視する（推測しない）
    }
  }
  return out;
}

function flatten(value: unknown, out: JsonLdNode[], depth: number): void {
  if (depth > 6 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) flatten(item, out, depth + 1);
    return;
  }
  const node = value as JsonLdNode;
  out.push(node);
  for (const key of ["@graph", "offers", "itemOffered", "mainEntity", "hasVariant"]) {
    if (key in node) flatten(node[key], out, depth + 1);
  }
}

export function parsePrice(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return Math.round(input);
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[,\s円¥￥]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 100_000_000) return null;
  return Math.round(value);
}
