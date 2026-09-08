/**
 * robots.txt の確認。
 * 「見に行ってよい」と書かれているページだけを監視する。読めなかった場合は許可扱い
 * （robots.txt が無いサイトも多いため）。明確に Disallow されていたら監視しない。
 */

export const USER_AGENT_TOKEN = "HiiragiWatch";

type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };

export function parseRobots(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    if (field === "allow" || field === "disallow") {
      if (!current) {
        current = { agents: ["*"], rules: [] };
        groups.push(current);
      }
      lastWasAgent = false;
      current.rules.push({ allow: field === "allow", path: value });
    }
  }
  return groups;
}

function matchLength(pattern: string, path: string): number {
  if (pattern === "") return -1;
  // robots.txt の * と $ に対応する
  if (!pattern.includes("*") && !pattern.endsWith("$")) {
    return path.startsWith(pattern) ? pattern.length : -1;
  }
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const anchored = escaped.endsWith("\\$") ? `^${escaped.slice(0, -2)}$` : `^${escaped}`;
  try {
    return new RegExp(anchored).test(path) ? pattern.length : -1;
  } catch {
    return -1;
  }
}

/** robots.txt に従ってよいか判定する。最長一致が勝ち、同じ長さなら Allow が勝つ。 */
export function isPathAllowed(robotsText: string, userAgent: string, path: string): boolean {
  const groups = parseRobots(robotsText);
  if (groups.length === 0) return true;

  const ua = userAgent.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && ua.includes(a)));
  const wildcard = groups.filter((g) => g.agents.includes("*"));
  const applicable = specific.length > 0 ? specific : wildcard;
  if (applicable.length === 0) return true;

  let best: { allow: boolean; length: number } | null = null;
  for (const group of applicable) {
    for (const rule of group.rules) {
      if (rule.path === "" && !rule.allow) continue; // "Disallow:" 空欄は全許可の意味
      const length = matchLength(rule.path, path);
      if (length < 0) continue;
      if (!best || length > best.length || (length === best.length && rule.allow)) {
        best = { allow: rule.allow, length };
      }
    }
  }
  return best ? best.allow : true;
}

export type RobotsCheck = { allowed: boolean; reason: string };

export async function checkRobots(url: string, fetchImpl = fetch): Promise<RobotsCheck> {
  let robotsUrl: string;
  let path: string;
  try {
    const parsed = new URL(url);
    robotsUrl = `${parsed.origin}/robots.txt`;
    path = parsed.pathname + parsed.search;
  } catch {
    return { allowed: false, reason: "URLを解釈できませんでした" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetchImpl(robotsUrl, {
      signal: controller.signal,
      headers: { "user-agent": `${USER_AGENT_TOKEN}/1.0` },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (res.status === 404 || res.status === 410) {
      return { allowed: true, reason: "robots.txt がないため制限なしとみなしました" };
    }
    if (!res.ok) {
      return { allowed: true, reason: `robots.txt を読めませんでした(${res.status})` };
    }
    const text = (await res.text()).slice(0, 500_000);
    const allowed = isPathAllowed(text, USER_AGENT_TOKEN, path);
    return {
      allowed,
      reason: allowed ? "robots.txt で許可されています" : "robots.txt でこのページの取得が禁止されています",
    };
  } catch {
    return { allowed: true, reason: "robots.txt に到達できませんでした" };
  }
}
