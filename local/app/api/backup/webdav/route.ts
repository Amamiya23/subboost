import { withCurrentAdmin } from "@local/lib/api-auth";
import { apiError, json } from "@local/lib/http";
import { readLimitedText } from "@local/lib/webdav";
import { createWebDavBackup, getBackupSettings, restoreWebDavBackup, saveBackupSettings, testBackupConnection } from "@local/lib/webdav-backup-service";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "WebDAV 备份操作失败";
  if (message.includes("no such table: WebDavBackupSettings")) {
    return apiError("请先应用 D1 数据库迁移以启用 WebDAV 备份", "CONFIGURATION_ERROR", 503);
  }
  return apiError(message, "BAD_REQUEST", 400);
}

export async function GET() {
  return withCurrentAdmin(async (admin) => {
    try {
      const response = json({ settings: await getBackupSettings(admin.id) });
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) { return failure(error); }
  });
}

export async function POST(request: Request) {
  return withCurrentAdmin(async (admin) => {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return apiError("请求来源无效", "FORBIDDEN", 403);
    try {
      let body;
      try { body = JSON.parse(await readLimitedText(request, 16384)); }
      catch { return apiError("请求格式无效或内容过大", "BAD_REQUEST", 400); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("请求格式无效", "BAD_REQUEST", 400);
      let result;
      switch (body.action) {
        case "save": result = { settings: await saveBackupSettings(admin.id, body.config) }; break;
        case "test": await testBackupConnection(admin.id, body.config); result = { success: true }; break;
        case "backup":
        case "restore": {
          if (typeof body.password !== "string" || body.password.length < 10 || body.password.length > 1024) {
            return apiError("备份密码需为 10 至 1024 个字符", "VALIDATION_ERROR", 400);
          }
          if (body.action === "restore" && body.confirmRestore !== true) return apiError("请先确认覆盖当前订阅和个人模板", "VALIDATION_ERROR", 400);
          result = body.action === "backup" ? await createWebDavBackup(admin.id, body.config, body.password)
            : await restoreWebDavBackup(admin.id, body.config, body.password);
          break;
        }
        default: return apiError("不支持的备份操作", "BAD_REQUEST", 400);
      }
      const response = json(result);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) { return failure(error); }
  });
}
