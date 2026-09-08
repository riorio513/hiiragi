"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { isValidEmail, passwordProblem } from "@/lib/auth";

export type FormState = { error?: string; ok?: string };

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // 外部サイトへの飛ばされ防止：同一サイト内のパスだけ許す
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

async function startSession(userId: string, role: string): Promise<void> {
  const token = await signSession({ userId, role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 40);
  const invite = String(formData.get("invite") ?? "").trim();

  if (!isValidEmail(email)) return { error: "メールアドレスの形が正しくありません。" };
  const pwProblem = passwordProblem(password);
  if (pwProblem) return { error: pwProblem };

  if (process.env.SIGNUP_INVITE_REQUIRED === "1") {
    const row = await queryOne<{ code: string }>(
      `select code from hiiragi.invites
        where code = $1 and used_count < max_uses
          and (expires_at is null or expires_at > now())`,
      [invite],
    );
    if (!row) return { error: "招待コードが正しくないか、有効期限が切れています。" };
  }

  const existing = await queryOne(`select 1 from hiiragi.users where email = $1`, [email]);
  if (existing) return { error: "このメールアドレスはすでに登録されています。" };

  const passwordHash = await hashPassword(password);
  const isFirstUser = !(await queryOne(`select 1 from hiiragi.users limit 1`));

  const user = await queryOne<{ id: string; role: string }>(
    `insert into hiiragi.users (email, password_hash, display_name, role)
     values ($1, $2, $3, $4) returning id, role`,
    [email, passwordHash, displayName || email.split("@")[0], isFirstUser ? "admin" : "user"],
  );
  if (!user) return { error: "登録に失敗しました。時間をおいて試してください。" };

  await query(`insert into hiiragi.user_settings (user_id) values ($1) on conflict do nothing`, [
    user.id,
  ]);
  if (invite) {
    await query(`update hiiragi.invites set used_count = used_count + 1 where code = $1`, [invite]);
  }

  await startSession(user.id, user.role);
  redirect("/dashboard?welcome=1");
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) return { error: "メールアドレスとパスワードを入れてください。" };

  const user = await queryOne<{
    id: string;
    password_hash: string;
    role: string;
    is_active: boolean;
    failed_logins: number;
    locked_until: Date | null;
  }>(
    `select id, password_hash, role, is_active, failed_logins, locked_until
       from hiiragi.users where email = $1`,
    [email],
  );

  // 存在しないメールでも同じ文言を返す（どのアドレスが登録済みか分からないように）
  const generic = { error: "メールアドレスかパスワードが違います。" };
  if (!user) return generic;

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return { error: `ログインの失敗が続いたため、${LOCK_MINUTES}分ほどお待ちください。` };
  }
  if (!user.is_active) return { error: "このアカウントは利用できません。" };

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const failed = user.failed_logins + 1;
    await query(
      `update hiiragi.users
          set failed_logins = $2,
              locked_until = case when $2 >= $3 then now() + ($4 || ' minutes')::interval else null end
        where id = $1`,
      [user.id, failed, MAX_FAILED, String(LOCK_MINUTES)],
    );
    return generic;
  }

  await query(
    `update hiiragi.users set failed_logins = 0, locked_until = null, last_login_at = now() where id = $1`,
    [user.id],
  );
  await query(`insert into hiiragi.user_settings (user_id) values ($1) on conflict do nothing`, [
    user.id,
  ]);
  await startSession(user.id, user.role);
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
