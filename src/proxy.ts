import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** ログイン不要で開ける道 */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/api/auth",
  "/api/cron",
  "/demo/shop",
  "/about",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 変更系のリクエストは送信元の一致を求める（他サイトからの書き換え除け＝CSRF対策）
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    const isCron = pathname.startsWith("/api/cron");
    if (origin && !isCron) {
      let host = "";
      try {
        host = new URL(origin).host;
      } catch {
        return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
      }
      if (host !== request.nextUrl.host) {
        return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
      }
    }
  }

  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySession(token))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/dashboard" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
