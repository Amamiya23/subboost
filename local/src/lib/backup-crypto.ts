import { decryptJson, encryptJson } from "./crypto";

const FORMAT = "subboost-account-backup";
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;

export async function encryptBackup(value: unknown, ownerId: string): Promise<string> {
  const payload = { format: FORMAT, version: 2, ownerId, data: value };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_BACKUP_BYTES / 1.5) throw new Error("备份数据过大");
  return JSON.stringify({ format: FORMAT, version: 2, ciphertext: await encryptJson(payload) });
}

export async function decryptBackup(text: string, ownerId: string): Promise<unknown> {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("备份文件过大");
  let envelope;
  try { envelope = JSON.parse(text); } catch { throw new Error("备份格式无效"); }
  if (!envelope || envelope.format !== FORMAT || envelope.version !== 2 || typeof envelope.ciphertext !== "string") {
    throw new Error("不支持的备份格式；旧密码备份需使用旧版本恢复");
  }
  let payload: { format?: string; version?: number; ownerId?: string; data?: unknown } | null;
  try { payload = await decryptJson<typeof payload>(envelope.ciphertext, null); }
  catch { throw new Error("解密失败：部署加密密钥不匹配或备份已损坏"); }
  if (!payload || payload.format !== FORMAT || payload.version !== 2) throw new Error("备份格式无效");
  if (payload.ownerId !== ownerId) throw new Error("此备份属于其他账号，请登录原账号后恢复");
  return payload.data;
}
