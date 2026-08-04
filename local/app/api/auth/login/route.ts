import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { apiError, getStringField, readJsonBody } from "@local/lib/http";
import { dbExecute, dbQueryOne } from "@local/lib/db";
import { sessionCookieOptions, signSession, SESSION_COOKIE } from "@local/lib/session";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) return apiError("Invalid JSON body.", "BAD_REQUEST", 400);

  const username = getStringField(body, "username");
  const password = getStringField(body, "password");
  const admin = username
    ? await dbQueryOne<{ id: string; username: string; passwordHash: string }>(
        "SELECT id, username, passwordHash FROM LocalAdmin WHERE username = ?",
        username,
      )
    : null;
  const valid = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
  if (!admin || !valid) {
    return apiError("Invalid username or password.", "UNAUTHORIZED", 401);
  }

  await dbExecute("UPDATE LocalAdmin SET lastLoginAt = ? WHERE id = ?", new Date().toISOString(), admin.id);
  const response = NextResponse.json({ success: true, user: { id: admin.id, username: admin.username } });
  response.cookies.set(SESSION_COOKIE, await signSession({ adminId: admin.id, username: admin.username }), sessionCookieOptions());
  return response;
}
