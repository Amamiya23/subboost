import { describe, expect, it } from "vitest";

import {
  decryptEncryptedFieldV3,
  encryptEncryptedFieldV3,
  isV3EncryptedField,
} from "./encrypted-field-v3";

const masterKey = "unit-test-encryption-key-32-bytes-minimum";

describe("encrypted field v3 crypto", () => {
  it("encrypts and decrypts a round trip with an explicit master key", async () => {
    const ciphertext = await encryptEncryptedFieldV3("hello subboost", masterKey);

    expect(isV3EncryptedField(ciphertext)).toBe(true);
    expect(ciphertext.split(":")).toHaveLength(4);
    expect(ciphertext.startsWith("v3:")).toBe(true);
    expect(await decryptEncryptedFieldV3(ciphertext, masterKey)).toBe("hello subboost");
  });

  it("produces distinct ciphertexts for repeated encryption of the same plaintext", async () => {
    const a = await encryptEncryptedFieldV3("same payload", masterKey);
    const b = await encryptEncryptedFieldV3("same payload", masterKey);
    expect(a).not.toBe(b);
    expect(await decryptEncryptedFieldV3(a, masterKey)).toBe("same payload");
    expect(await decryptEncryptedFieldV3(b, masterKey)).toBe("same payload");
  });

  it("decrypts the fixed Web Crypto v3 compatibility vector", async () => {
    const ciphertext = "v3:000102030405060708090a0b:dda4ff5988b03593a9d1457546ab737d:37f53d44985016182ce565b8982a";

    await expect(decryptEncryptedFieldV3(ciphertext, masterKey)).resolves.toBe("hello subboost");
  });

  it("rejects ciphertext with an invalid prefix", async () => {
    const oldShapeCiphertext = "v2:0123456789abcdef:0123456789abcdef:abcd";
    expect(isV3EncryptedField(oldShapeCiphertext)).toBe(false);
    await expect(decryptEncryptedFieldV3(oldShapeCiphertext, masterKey)).rejects.toThrow(
      "Invalid ciphertext v3 format",
    );
  });

  it("rejects ciphertext with malformed metadata", async () => {
    await expect(decryptEncryptedFieldV3("v3:zz:00:ab", masterKey)).rejects.toThrow(
      "Invalid ciphertext v3 metadata",
    );
    await expect(decryptEncryptedFieldV3("v3:0g:00:ab", masterKey)).rejects.toThrow(
      "Invalid ciphertext v3 metadata",
    );
  });

  it("rejects an empty master key", async () => {
    await expect(encryptEncryptedFieldV3("payload", "  ")).rejects.toThrow(
      "Encryption master key is required",
    );
    const ciphertext = await encryptEncryptedFieldV3("payload", masterKey);
    await expect(decryptEncryptedFieldV3(ciphertext, "  ")).rejects.toThrow(
      "Encryption master key is required",
    );
  });
});
