export {
  decryptEncryptedFieldV3,
  encryptEncryptedFieldV3,
  isV3EncryptedField,
} from "./encrypted-field-v3";

const LEGACY_V2_PREFIX = "v2";
const LEGACY_V2_IV_LENGTH = 12;
const LEGACY_V2_TAG_LENGTH = 16;
const LEGACY_V2_HKDF_SALT = "subboost:encrypted-field:v2";
const LEGACY_V2_HKDF_INFO = "subboost:aes-256-gcm:v2";

function decodeLegacyV2Hex(value: string): Uint8Array<ArrayBuffer> {
  if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
    throw new Error("Invalid ciphertext v2 metadata");
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function deriveLegacyV2Key(masterKey: string): Promise<CryptoKey> {
  if (typeof masterKey !== "string" || masterKey.trim().length === 0) {
    throw new Error("Encryption master key is required");
  }
  const encoder = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(masterKey),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(LEGACY_V2_HKDF_SALT),
      info: encoder.encode(LEGACY_V2_HKDF_INFO),
    },
    baseKey,
    256,
  );
  return globalThis.crypto.subtle.importKey("raw", bits, "AES-GCM", false, ["decrypt"]);
}

export function isLegacyV2EncryptedField(ciphertext: string | null | undefined): boolean {
  return typeof ciphertext === "string" && ciphertext.startsWith(`${LEGACY_V2_PREFIX}:`);
}

/**
 * Read-only compatibility for Docker data written before the Web Crypto v3 migration.
 * This intentionally uses Web Crypto so importing the shared crypto entrypoint remains Worker-safe.
 */
export async function decryptLegacyV2EncryptedField(ciphertext: string, masterKey: string): Promise<string> {
  const parts = ciphertext.split(":");
  const [prefix, ivHex, tagHex, dataHex] = parts;
  if (prefix !== LEGACY_V2_PREFIX || !ivHex || !tagHex || !dataHex || parts.length !== 4) {
    throw new Error("Invalid ciphertext v2 format");
  }

  const iv = decodeLegacyV2Hex(ivHex);
  const tag = decodeLegacyV2Hex(tagHex);
  const data = decodeLegacyV2Hex(dataHex);
  if (iv.length !== LEGACY_V2_IV_LENGTH || tag.length !== LEGACY_V2_TAG_LENGTH) {
    throw new Error("Invalid ciphertext v2 metadata");
  }

  const combined = new Uint8Array(data.length + tag.length);
  combined.set(data, 0);
  combined.set(tag, data.length);
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: LEGACY_V2_TAG_LENGTH * 8 },
    await deriveLegacyV2Key(masterKey),
    combined,
  );
  return new TextDecoder().decode(decrypted);
}
