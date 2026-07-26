import { describe, expect, it } from "vitest";
import { encryptEncryptedFieldV2 } from "./encrypted-field-v2";
import {
  decryptLegacyV2EncryptedField,
  isLegacyV2EncryptedField,
} from "./encrypted-field";

const masterKey = "unit-test-encryption-key-32-bytes-minimum";

describe("encrypted field compatibility", () => {
  it("decrypts legacy Node v2 ciphertext through the Worker-safe compatibility path", async () => {
    const ciphertext = encryptEncryptedFieldV2("legacy subscription", masterKey);

    expect(isLegacyV2EncryptedField(ciphertext)).toBe(true);
    await expect(decryptLegacyV2EncryptedField(ciphertext, masterKey)).resolves.toBe("legacy subscription");
  });

  it("rejects malformed legacy v2 fields", async () => {
    expect(isLegacyV2EncryptedField("v3:00:00:00")).toBe(false);
    await expect(decryptLegacyV2EncryptedField("v2:zz:00:ab", masterKey)).rejects.toThrow(
      "Invalid ciphertext v2 metadata",
    );
  });
});
