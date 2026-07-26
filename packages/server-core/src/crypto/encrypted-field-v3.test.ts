import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decryptEncryptedFieldV3,
  encryptEncryptedFieldV3,
  isV3EncryptedField,
} from "./encrypted-field-v3";

const masterKey = "unit-test-encryption-key-32-bytes-minimum";

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("reuses one derived key for sequential operations with the same master key", async () => {
    const deriveBits = vi.spyOn(globalThis.crypto.subtle, "deriveBits");
    const cacheKey = "unit-test-sequential-cache-key";

    const first = await encryptEncryptedFieldV3("first", cacheKey);
    const second = await encryptEncryptedFieldV3("second", cacheKey);

    await expect(decryptEncryptedFieldV3(first, cacheKey)).resolves.toBe("first");
    await expect(decryptEncryptedFieldV3(second, cacheKey)).resolves.toBe("second");
    expect(deriveBits).toHaveBeenCalledTimes(1);
  });

  it("shares in-flight derivation across concurrent operations", async () => {
    const deriveBits = vi.spyOn(globalThis.crypto.subtle, "deriveBits");
    const cacheKey = "unit-test-concurrent-cache-key";

    const ciphertexts = await Promise.all([
      encryptEncryptedFieldV3("one", cacheKey),
      encryptEncryptedFieldV3("two", cacheKey),
      encryptEncryptedFieldV3("three", cacheKey),
    ]);

    expect(ciphertexts).toHaveLength(3);
    expect(deriveBits).toHaveBeenCalledTimes(1);
  });

  it("keeps only the most recently used master key", async () => {
    const deriveBits = vi.spyOn(globalThis.crypto.subtle, "deriveBits");
    const firstKey = "unit-test-single-entry-cache-key-a";
    const secondKey = "unit-test-single-entry-cache-key-b";

    await encryptEncryptedFieldV3("a1", firstKey);
    await encryptEncryptedFieldV3("b1", secondKey);
    await encryptEncryptedFieldV3("b2", secondKey);
    await encryptEncryptedFieldV3("a2", firstKey);

    expect(deriveBits).toHaveBeenCalledTimes(3);
  });

  it("retries key derivation after a transient failure", async () => {
    const originalDeriveBits = globalThis.crypto.subtle.deriveBits.bind(globalThis.crypto.subtle);
    const deriveBits = vi
      .spyOn(globalThis.crypto.subtle, "deriveBits")
      .mockRejectedValueOnce(new Error("transient derive failure"))
      .mockImplementation((...args) => originalDeriveBits(...args));
    const cacheKey = "unit-test-retry-cache-key";

    await expect(encryptEncryptedFieldV3("first", cacheKey)).rejects.toThrow("transient derive failure");
    await expect(encryptEncryptedFieldV3("second", cacheKey)).resolves.toMatch(/^v3:/);
    expect(deriveBits).toHaveBeenCalledTimes(2);
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
