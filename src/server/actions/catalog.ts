"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { passwordProblem, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { normalizeUrl } from "../monitor/url";
import { SNS_PLATFORMS, STORE_KINDS } from "@/lib/types";

export type FormState = { error?: string; ok?: string };

function text(formData: FormData, key: string, max = 500): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function optionalUrl(value: string): string | "invalid" {
  if (!value) return "";
  const check = normalizeUrl(value);
  return check.ok ? check.url : "invalid";
}

/* ── 販売場所 ───────────────────────────────────────────── */

export async function createStoreAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = text(formData, "name", 80);
  if (!name) return { error: "店舗名を入れてください。" };

  const url = optionalUrl(text(formData, "url", 800));
  if (url === "invalid") return { error: "店舗URLの形が正しくありません（例：https://example.com）。" };

  const kind = text(formData, "kind", 30);
  const validKind = STORE_KINDS.some((k) => k.value === kind) ? kind : "other";

  await query(
    `insert into hiiragi.stores (user_id, name, url, kind, is_official, note)
     values ($1,$2,$3,$4,$5,$6)`,
    [user.id, name, url, validKind, formData.get("isOfficial") === "on", text(formData, "note", 300)],
  );
  revalidatePath("/stores");
  return { ok: `「${name}」を登録しました。` };
}

export async function updateStoreAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = text(formData, "storeId", 60);
  const name = text(formData, "name", 80);
  if (!name) return { error: "店舗名を入れてください。" };

  const url = optionalUrl(text(formData, "url", 800));
  if (url === "invalid") return { error: "店舗URLの形が正しくありません。" };

  const kind = text(formData, "kind", 30);
  const validKind = STORE_KINDS.some((k) => k.value === kind) ? kind : "other";

  await query(
    `update hiiragi.stores
        set name=$3, url=$4, kind=$5, is_official=$6, note=$7, is_active=$8, updated_at=now()
      where id=$1 and user_id=$2`,
    [
      id,
      user.id,
      name,
      url,
      validKind,
      formData.get("isOfficial") === "on",
      text(formData, "note", 300),
      formData.get("isActive") === "on",
    ],
  );
  revalidatePath("/stores");
  return { ok: "保存しました。" };
}

export async function deleteStoreAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await query(`delete from hiiragi.stores where id = $1 and user_id = $2`, [
    text(formData, "storeId", 60),
    user.id,
  ]);
  revalidatePath("/stores");
}

/* ── 公式アカウント ─────────────────────────────────────── */

export async function createAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = text(formData, "name", 80);
  if (!name) return { error: "アカウント名を入れてください。" };

  const url = optionalUrl(text(formData, "url", 800));
  if (url === "invalid") return { error: "アカウントURLの形が正しくありません。" };

  const platform = text(formData, "platform", 30);
  const validPlatform = SNS_PLATFORMS.some((p) => p.value === platform) ? platform : "other";

  let storeId: string | null = text(formData, "storeId", 60) || null;
  if (storeId) {
    const owned = await queryOne(`select 1 from hiiragi.stores where id=$1 and user_id=$2`, [
      storeId,
      user.id,
    ]);
    if (!owned) storeId = null;
  }

  await query(
    `insert into hiiragi.official_accounts (user_id, name, url, platform, is_official, store_id, note)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      user.id,
      name,
      url,
      validPlatform,
      formData.get("isOfficial") === "on",
      storeId,
      text(formData, "note", 300),
    ],
  );
  revalidatePath("/accounts");
  return { ok: `「${name}」を登録しました。` };
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await query(`delete from hiiragi.official_accounts where id = $1 and user_id = $2`, [
    text(formData, "accountId", 60),
    user.id,
  ]);
  revalidatePath("/accounts");
}

/* ── 通知 ───────────────────────────────────────────────── */

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await query(
    `update hiiragi.notifications set is_read = true, read_at = now()
      where id = $1 and user_id = $2`,
    [text(formData, "notificationId", 60), user.id],
  );
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await query(
    `update hiiragi.notifications set is_read = true, read_at = now()
      where user_id = $1 and not is_read`,
    [user.id],
  );
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

/* ── 設定 ───────────────────────────────────────────────── */

export async function updateSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const start = text(formData, "quietStart", 10);
  const end = text(formData, "quietEnd", 10);
  const valid = /^\d{1,2}:\d{2}$/;
  if (!valid.test(start) || !valid.test(end)) {
    return { error: "時刻は 22:00 のような形で入れてください。" };
  }
  await query(
    `insert into hiiragi.user_settings (user_id, quiet_enabled, quiet_start, quiet_end, onboarded, updated_at)
     values ($1,$2,$3,$4,true,now())
     on conflict (user_id) do update
        set quiet_enabled = excluded.quiet_enabled,
            quiet_start = excluded.quiet_start,
            quiet_end = excluded.quiet_end,
            updated_at = now()`,
    [user.id, formData.get("quietEnabled") === "on", start, end],
  );
  revalidatePath("/settings");
  return { ok: "設定を保存しました。" };
}

/* ── パスワード変更 ─────────────────────────────────────── */

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");

  const row = await queryOne<{ password_hash: string }>(
    `select password_hash from hiiragi.users where id = $1`,
    [user.id],
  );
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    return { error: "いまのパスワードが違います。" };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem };

  await query(`update hiiragi.users set password_hash = $2 where id = $1`, [
    user.id,
    await hashPassword(next),
  ]);
  return { ok: "パスワードを変更しました。" };
}
