import { NextResponse, type NextRequest } from "next/server";
import { runDueChecks } from "@/server/monitor/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 定期監視の入口。GitHub Actions のスケジュール実行から呼ばれる。
 * 合言葉（CRON_SECRET）が一致したときだけ動く。
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return header === secret;
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  try {
    const summary = await runDueChecks(limit, "cron");
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    // エラーの中身は外へ出さない
    console.error("cron check failed", error);
    return NextResponse.json({ ok: false, error: "monitor_failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
