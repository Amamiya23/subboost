import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { withCurrentAdmin } from "@local/lib/api-auth";
import { getLocalAdminPasswordChangeError, LOCAL_ADMIN_CREDENTIAL_MESSAGES } from "@local/lib/admin-credentials";
import { dbExecute, dbQueryOne } from "@local/lib/db";
import { apiError, getStringField, readJsonBody } from "@local/lib/http";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@local/lib/session";

export async function POST(request: Request) {
  return withCurrentAdmin(async (admin) => {
    const body = await readJsonBody(request);
    if (!body) return apiError(LOCAL_ADMIN_CREDENTIAL_MESSAGES.invalidJson, "BAD_REQUEST", 400);

    const currentPassword = getStringField(body, "currentPassword");
    const newPassword = getStringField(body, "newPassword");
    const passwordConfirm = getStringField(body, "passwordConfirm");
    const error = getLocalAdminPasswordChangeError({ currentPassword, newPassword, passwordConfirm });
    if (error) return apiError(error, "VALIDATION_ERROR", 400);

    const credentials = await dbQueryOne<{ passwordHash: string }>("SELECT passwordHash FROM LocalAdmin WHERE id = ?", admin.id);
    if (!credentials || !await bcrypt.compare(currentPassword, credentials.passwordHash)) {
      return apiError("当前密码不正确", "FORBIDDEN", 403);
    }
    if (await bcrypt.compare(newPassword, credentials.passwordHash)) {
      return apiError(LOCAL_ADMIN_CREDENTIAL_MESSAGES.passwordUnchanged, "VALIDATION_ERROR", 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const token = await signSession({ adminId: admin.id, username: admin.username }, passwordHash);
    const changed = await dbExecute(
      "UPDATE LocalAdmin SET passwordHash = ?, updatedAt = ? WHERE id = ? AND passwordHash = ?",
      passwordHash, new Date().toISOString(), admin.id, credentials.passwordHash,
    );
    if (changed !== 1) return apiError("密码已发生变化，请重新登录后重试", "CONFLICT", 409);

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  });
}
