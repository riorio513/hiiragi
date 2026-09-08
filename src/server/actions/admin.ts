"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** 友人へ配る招待コードを作る。SIGNUP_INVITE_REQUIRED=1 のときだけ必要になる。 */
export async function createInviteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const note = String(formData.get("note") ?? "").trim().slice(0, 100);
  const code = randomBytes(6).toString("hex");
  await query(
    `insert into hiiragi.invites (code, created_by, note, max_uses, expires_at)
     values ($1,$2,$3,1, now() + interval '30 days')`,
    [code, admin.id, note],
  );
  revalidatePath("/admin");
}

/** 監視が止まっている対象をもう一度動かす。 */
export async function reactivateTargetAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await query(
    `update hiiragi.monitor_targets
        set is_active = true, disabled_reason = null, consecutive_errors = 0, next_check_at = now()
      where id = $1`,
    [String(formData.get("targetId") ?? "").slice(0, 60)],
  );
  revalidatePath("/admin");
}

/** 管理画面から監視を1回まわす（定期実行を待たずに確認したいとき）。 */
export async function runMonitorNowAction(): Promise<void> {
  await requireAdmin();
  const { runDueChecks } = await import("../monitor/runner");
  await runDueChecks(20, "admin");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}
