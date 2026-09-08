import { SignJWT, jwtVerify } from "jose";

/** ログイン済みの印として端末に置くCookie。30日間有効。 */
export const SESSION_COOKIE = "hiiragi_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type SessionPayload = { userId: string; role: string };

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("SESSION_SECRET is not configured");
  return new TextEncoder().encode(value);
}

export function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setAudience("hiiragi")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: "hiiragi" });
    if (!payload.sub) return null;
    return { userId: payload.sub, role: typeof payload.role === "string" ? payload.role : "user" };
  } catch {
    return null;
  }
}
