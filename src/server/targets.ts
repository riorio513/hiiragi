import { query, queryOne } from "@/lib/db";
import { adapterForUrl } from "./monitor/adapters";
import { normalizeUrl } from "./monitor/url";
import { checkTarget, loadTarget, type TargetRow } from "./monitor/runner";

/**
 * 「商品発見」と「商品監視」を分けるための入口。
 * URLを1本受け取り、監視対象（全利用者で共有）を用意するところまでを担当する。
 */

export type EnsureResult =
  | { ok: true; target: TargetRow; adapterLabel: string; note: string }
  | { ok: false; message: string };

export async function ensureTarget(rawUrl: string): Promise<EnsureResult> {
  const check = normalizeUrl(rawUrl);
  if (!check.ok) return { ok: false, message: check.message };

  const adapter = adapterForUrl(check.url, check.host);
  if (!adapter.supported) {
    return {
      ok: false,
      message: adapter.unsupportedReason ?? "このサイトは監視に対応していません。",
    };
  }

  const existing = await queryOne<TargetRow>(
    `select id, url, host, adapter, min_interval_sec, is_active, robots_allowed, robots_checked_at,
            last_status, last_price, consecutive_errors, restock_seq
       from hiiragi.monitor_targets where url = $1`,
    [check.url],
  );
  if (existing) {
    if (!existing.is_active) {
      await query(
        `update hiiragi.monitor_targets set is_active = true, disabled_reason = null, next_check_at = now() where id = $1`,
        [existing.id],
      );
      existing.is_active = true;
    }
    return {
      ok: true,
      target: existing,
      adapterLabel: adapter.label,
      note: adapter.note ?? "",
    };
  }

  const created = await queryOne<TargetRow>(
    `insert into hiiragi.monitor_targets (url, host, adapter, min_interval_sec)
     values ($1, $2, $3, $4)
     on conflict (url) do update set is_active = true
     returning id, url, host, adapter, min_interval_sec, is_active, robots_allowed, robots_checked_at,
               last_status, last_price, consecutive_errors, restock_seq`,
    [check.url, check.host, adapter.name, adapter.minIntervalSec],
  );
  if (!created) return { ok: false, message: "監視対象を作成できませんでした。" };
  return { ok: true, target: created, adapterLabel: adapter.label, note: adapter.note ?? "" };
}

/** 登録直後の初回取得。結果は画面にそのまま出す。 */
export async function runInitialCheck(targetId: string) {
  const target = await loadTarget(targetId);
  if (!target) return null;
  try {
    return await checkTarget(target);
  } catch {
    return null;
  }
}
