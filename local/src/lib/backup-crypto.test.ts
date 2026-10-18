import { describe, expect, it } from "vitest";
import { decryptBackup, encryptBackup } from "./backup-crypto";

describe("portable encrypted backups", () => {
  const password = "独立的备份密码-with-spaces ";
  const data = { url: "https://secret.test/token", nodes: [{ password: "node-secret" }] };
  it("round trips Unicode data using only the backup password, with fresh salt and IV", async () => {
    const first = await encryptBackup(data, password);
    const second = await encryptBackup(data, password);
    expect(first).not.toContain("secret");
    expect(first).not.toBe(second);
    expect(JSON.parse(first).salt).not.toBe(JSON.parse(second).salt);
    expect(JSON.parse(first).iv).not.toBe(JSON.parse(second).iv);
    await expect(decryptBackup(first, password)).resolves.toEqual(data);
  });
  it("rejects wrong passwords, modified ciphertext, unsupported parameters and plaintext files", async () => {
    const encrypted = await encryptBackup(data, password);
    await expect(decryptBackup(encrypted, "wrong-password")).rejects.toThrow("解密失败");
    const envelope = JSON.parse(encrypted);
    envelope.ciphertext = (envelope.ciphertext[0] === "A" ? "B" : "A") + envelope.ciphertext.slice(1);
    await expect(decryptBackup(JSON.stringify(envelope), password)).rejects.toThrow("解密失败");
    envelope.iterations = 1000000000;
    await expect(decryptBackup(JSON.stringify(envelope), password)).rejects.toThrow("不支持");
    await expect(decryptBackup(JSON.stringify(data), password)).rejects.toThrow("不支持");
    await expect(encryptBackup(data, "short")).rejects.toThrow("10 至");
  });
});
