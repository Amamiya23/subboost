import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { isHttpsAppUrl, requireEnv } from "./env";

export const SESSION_COOKIE = "subboost_local_session";

export type SessionPayload = {
  adminId: string;
  username: string;
  credentialVersion: string;
};

function key(): Uint8Array {
  return new TextEncoder().encode(requireEnv("JWT_SECRET"));
}

export async function getCredentialVersion(passwordHash: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passwordHash));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signSession(payload: Pick<SessionPayload, "adminId" | "username">, passwordHash: string): Promise<string> {
  return await new SignJWT({ username: payload.username, credentialVersion: await getCredentialVersion(passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.adminId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const adminId = typeof payload.sub === "string" ? payload.sub : "";
    const username = typeof payload.username === "string" ? payload.username : "";
    const credentialVersion = typeof payload.credentialVersion === "string" ? payload.credentialVersion : "";
    return adminId && username && credentialVersion ? { adminId, username, credentialVersion } : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttpsAppUrl(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttpsAppUrl(),
    path: "/",
    maxAge: 0,
  };
}
