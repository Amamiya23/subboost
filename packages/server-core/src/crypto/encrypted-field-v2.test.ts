import { describe, expect, it } from "vitest";

import {
  decryptEncryptedFieldV2,
  encryptEncryptedFieldV2,
  isV2EncryptedField,
} from "./encrypted-field-v2";

const masterKey = "unit-test-encryption-key-32-bytes-minimum";

describe("encrypted field crypto", () => {
  it("encrypts and decrypts the shared v2 format with an explicit master key", () => {
    const ciphertext = encryptEncryptedFieldV2("hello subboost", masterKey);

    expect(isV2EncryptedField(ciphertext)).toBe(true);
    expect(ciphertext.split(":")).toHaveLength(4);
    expect(decryptEncryptedFieldV2(ciphertext, masterKey)).toBe("hello subboost");
  });

  it("rejects non-v2 ciphertext", () => {
    const oldShapeCiphertext = "old:0123456789abcdef:0123456789abcdef:abcd";

    expect(isV2EncryptedField(oldShapeCiphertext)).toBe(false);
    expect(() => decryptEncryptedFieldV2(oldShapeCiphertext, masterKey)).toThrow("Invalid ciphertext v2 format");
  });

});
