import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { queryOne } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
};

/** ログイン中の利用者。未ログインなら null。 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await queryOne<CurrentUser>(
    `select id, email, display_name, role, is_active from hiiragi.users where id = $1`,
    [session.userId],
  );
  if (!user || !user.is_active) return null;
  return user;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254;
}

export function passwordProblem(value: string): string | null {
  if (value.length < 8) return "パスワードは8文字以上にしてください。";
  if (value.length > 200) return "パスワードが長すぎます。";
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return "パスワードは英字と数字を両方入れてください。";
  }
  return null;
}
