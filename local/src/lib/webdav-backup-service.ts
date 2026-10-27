import { decryptJson, encryptJson } from "./crypto";
import { dbExecute, dbQuery, dbQueryOne } from "./db";
import { collectBackupData, restoreBackupData } from "./backup-data";
import { decryptBackup, encryptBackup } from "./backup-crypto";
import { downloadWebDavBackup, parseWebDavConfig, testWebDav, uploadWebDavBackup, type WebDavConfig } from "./webdav";

async function loadConfig(ownerId: string): Promise<WebDavConfig | null> {
  const row = await dbQueryOne<{ encryptedConfig: string }>("SELECT encryptedConfig FROM WebDavBackupSettings WHERE ownerId = ?", ownerId);
  return row ? parseWebDavConfig(await decryptJson(row.encryptedConfig, null)) : null;
}

export async function getBackupSettings(ownerId: string) {
  const config = await loadConfig(ownerId);
  const status = config ? await dbQueryOne<{ lastBackupAt: string | null; lastError: string | null }>(
    "SELECT lastBackupAt, lastError FROM WebDavBackupSettings WHERE ownerId = ?", ownerId) : null;
  return config ? { url: config.url, username: config.username, path: config.path, hasPassword: true, ...status } : null;
}

export async function resolveBackupConfig(ownerId: string, input: unknown): Promise<WebDavConfig> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("请输入 WebDAV 配置");
  const candidate = input as Record<string, unknown>;
  // Explicit credentials also allow recovering after the instance encryption key changes.
  if (typeof candidate.password === "string" && candidate.password.length > 0) return parseWebDavConfig(candidate);
  const saved = await loadConfig(ownerId);
  // A saved password can only be reused for the exact destination and account it belongs to.
  const config = parseWebDavConfig({ ...candidate, password: candidate.password || saved?.password || "" });
  if (!candidate.password && saved && (config.url !== saved.url || config.username !== saved.username)) {
    throw new Error("修改 WebDAV 地址或用户名后，请重新输入 WebDAV 密码");
  }
  return config;
}

export async function saveBackupSettings(ownerId: string, input: unknown) {
  const config = await resolveBackupConfig(ownerId, input);
  await dbExecute("INSERT INTO WebDavBackupSettings (ownerId, encryptedConfig, updatedAt) VALUES (?, ?, ?) ON CONFLICT(ownerId) DO UPDATE SET encryptedConfig = excluded.encryptedConfig, updatedAt = excluded.updatedAt",
    ownerId, await encryptJson(config), new Date().toISOString());
  return getBackupSettings(ownerId);
}

export async function testBackupConnection(ownerId: string, input: unknown) {
  await testWebDav(await resolveBackupConfig(ownerId, input));
}

function accountConfig(config: WebDavConfig, ownerId: string): WebDavConfig {
  const parts = config.path.split("/");
  parts.splice(parts.length - 1, 0, encodeURIComponent(ownerId));
  return { ...config, path: parts.join("/") };
}

export async function createWebDavBackup(ownerId: string, input: unknown) {
  const config = await resolveBackupConfig(ownerId, input);
  const data = await collectBackupData(ownerId);
  const ciphertext = await encryptBackup(data, ownerId);
  const destination = accountConfig(config, ownerId);
  await uploadWebDavBackup(destination, ciphertext);
  await dbExecute("UPDATE WebDavBackupSettings SET lastBackupAt = ?, lastAttemptedAt = ?, lastError = NULL WHERE ownerId = ?",
    data.createdAt, new Date().toISOString(), ownerId);
  return { createdAt: data.createdAt, subscriptions: data.subscriptions.length, templates: data.templates.length, path: destination.path };
}

export async function restoreWebDavBackup(ownerId: string, input: unknown) {
  const config = await resolveBackupConfig(ownerId, input);
  const ciphertext = await downloadWebDavBackup(accountConfig(config, ownerId));
  const data = await decryptBackup(ciphertext, ownerId);
  return restoreBackupData(ownerId, data);
}

export async function runAutomaticWebDavBackups() {
  const rows = await dbQuery<{ ownerId: string; lastAttemptedAt: string | null }>("SELECT ownerId, lastAttemptedAt FROM WebDavBackupSettings");
  const result = { total: rows.length, success: 0, failed: 0, skipped: 0 };
  const now = Date.now();
  for (const row of rows) {
    if (row.lastAttemptedAt && now - Date.parse(row.lastAttemptedAt) < 60 * 60 * 1000) { result.skipped++; continue; }
    await dbExecute("UPDATE WebDavBackupSettings SET lastAttemptedAt = ? WHERE ownerId = ?", new Date(now).toISOString(), row.ownerId);
    try {
      const config = await loadConfig(row.ownerId);
      if (!config) { result.skipped++; continue; }
      await createWebDavBackup(row.ownerId, config);
      result.success++;
    } catch (error) {
      result.failed++;
      await dbExecute("UPDATE WebDavBackupSettings SET lastError = ? WHERE ownerId = ?",
        error instanceof Error ? error.message : "自动备份失败", row.ownerId);
    }
  }
  return result;
}
