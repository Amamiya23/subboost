import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getLocalAdminSetupCredentialError, LOCAL_ADMIN_CREDENTIAL_MESSAGES } from "@local/lib/admin-credentials";
import { apiError, getStringField, readJsonBody } from "@local/lib/http";
import { dbExecute, dbQueryOne, generateId } from "@local/lib/db";
import { sessionCookieOptions, signSession, SESSION_COOKIE } from "@local/lib/session";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) return apiError(LOCAL_ADMIN_CREDENTIAL_MESSAGES.invalidJson, "BAD_REQUEST", 400);

  const countRow = await dbQueryOne<{ count: number }>("SELECT COUNT(*) as count FROM LocalAdmin");
  if (Number(countRow?.count ?? 0) > 0) {
    return apiError(LOCAL_ADMIN_CREDENTIAL_MESSAGES.adminExists, "CONFLICT", 409);
  }

  const username = getStringField(body, "username");
  const password = getStringField(body, "password");
  const passwordConfirm = getStringField(body, "passwordConfirm");
  const credentialError = getLocalAdminSetupCredentialError({ username, password, passwordConfirm });
  if (credentialError) {
    return apiError(credentialError, "BAD_REQUEST", 400);
  }

  const id = generateId();
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  await dbExecute(
    "INSERT INTO LocalAdmin (id, username, passwordHash, lastLoginAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    username,
    passwordHash,
    now,
    now,
    now,
  );

  const response = NextResponse.json({
    success: true,
    user: { id, username },
  });
  response.cookies.set(SESSION_COOKIE, await signSession({ adminId: id, username }), sessionCookieOptions());
  return response;
}
