import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptBackup, encryptBackup } from "./backup-crypto";

describe("account-bound encrypted backups", () => {
  const ownerId = "account-1";
  const data = { url: "https://secret.test/token", nodes: [{ password: "node-secret" }] };
  beforeEach(() => { vi.stubEnv("ENCRYPTION_KEY", "instance-key"); });
  afterEach(() => { vi.unstubAllEnvs(); });
  it("round trips encrypted data for its owner without a backup password", async () => {
    const first = await encryptBackup(data, ownerId);
    const second = await encryptBackup(data, ownerId);
    expect(first).not.toContain("secret");
    expect(first).not.toContain(ownerId);
    expect(first).not.toBe(second);
    await expect(decryptBackup(first, ownerId)).resolves.toEqual(data);
  });
  it("rejects another account even when it has the complete backup file", async () => {
    const encrypted = await encryptBackup(data, ownerId);
    const copied = { ...JSON.parse(encrypted), ownerId: "account-2" };
    await expect(decryptBackup(JSON.stringify(copied), "account-2")).rejects.toThrow("属于其他账号");
  });
  it("rejects a different deployment key, damaged ciphertext, legacy and plaintext files", async () => {
    const encrypted = await encryptBackup(data, ownerId);
    vi.stubEnv("ENCRYPTION_KEY", "replacement-key");
    await expect(decryptBackup(encrypted, ownerId)).rejects.toThrow("解密失败");
    vi.stubEnv("ENCRYPTION_KEY", "instance-key");
    const envelope = JSON.parse(encrypted);
    envelope.ciphertext = "damaged-ciphertext";
    await expect(decryptBackup(JSON.stringify(envelope), ownerId)).rejects.toThrow("解密失败");
    await expect(decryptBackup(JSON.stringify({ format: "subboost-encrypted-backup", version: 1 }), ownerId)).rejects.toThrow("旧密码备份");
    await expect(decryptBackup(JSON.stringify(data), ownerId)).rejects.toThrow("不支持");
  });
});
