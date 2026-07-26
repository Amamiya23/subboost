const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const V3_PREFIX = "v3";
const V3_HKDF_SALT = "subboost:encrypted-field:v3";
const V3_HKDF_INFO = "subboost:aes-256-gcm:v3";
const HEX_BYTES = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, "0"));

function assertNonEmptyMasterKey(masterKey: string): void {
  if (typeof masterKey !== "string" || masterKey.trim().length === 0) {
    throw new Error("Encryption master key is required");
  }
}

function getTextEncoder(): TextEncoder {
  return globalTextEncoder ??= new TextEncoder();
}

let globalTextEncoder: TextEncoder | null = null;

function getTextDecoder(): TextDecoder {
  return globalTextDecoder ??= new TextDecoder();
}

let globalTextDecoder: TextDecoder | null = null;

type DerivedKeyCacheEntry = {
  masterKey: string;
  promise: Promise<CryptoKey>;
};

let derivedKeyCache: DerivedKeyCacheEntry | null = null;

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += HEX_BYTES[bytes[i]];
  }
  return hex;
}

function fromHexCode(code: number): number {
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 65 && code <= 70) return code - 55;
  if (code >= 97 && code <= 102) return code - 87;
  return -1;
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length === 0 || hex.length % 2 !== 0) throw new Error("Invalid hex length");
  const length = hex.length / 2;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    const offset = i * 2;
    const high = fromHexCode(hex.charCodeAt(offset));
    const low = fromHexCode(hex.charCodeAt(offset + 1));
    if (high < 0 || low < 0) throw new Error("Invalid hex length");
    bytes[i] = high * 16 + low;
  }
  return bytes;
}

async function deriveV3KeyUncached(masterKey: string): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const baseKey = await subtle.importKey(
    "raw",
    getTextEncoder().encode(masterKey),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: getTextEncoder().encode(V3_HKDF_SALT),
      info: getTextEncoder().encode(V3_HKDF_INFO),
    },
    baseKey,
    KEY_LENGTH * 8,
  );
  return subtle.importKey("raw", bits, ALGORITHM, false, ["encrypt", "decrypt"]);
}

function deriveV3Key(masterKey: string): Promise<CryptoKey> {
  if (derivedKeyCache?.masterKey === masterKey) return derivedKeyCache.promise;

  const entry: DerivedKeyCacheEntry = {
    masterKey,
    promise: deriveV3KeyUncached(masterKey),
  };
  derivedKeyCache = entry;
  void entry.promise.catch(() => {
    if (derivedKeyCache === entry) derivedKeyCache = null;
  });
  return entry.promise;
}

export function isV3EncryptedField(ciphertext: string | null | undefined): boolean {
  return typeof ciphertext === "string" && ciphertext.startsWith(`${V3_PREFIX}:`);
}

export async function encryptEncryptedFieldV3(plaintext: string, masterKey: string): Promise<string> {
  assertNonEmptyMasterKey(masterKey);

  const key = await deriveV3Key(masterKey);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
      key,
      getTextEncoder().encode(plaintext),
    ),
  );
  const tag = encrypted.subarray(encrypted.length - TAG_LENGTH);
  const data = encrypted.subarray(0, encrypted.length - TAG_LENGTH);
  return [V3_PREFIX, toHex(iv), toHex(tag), toHex(data)].join(":");
}

export async function decryptEncryptedFieldV3(ciphertext: string, masterKey: string): Promise<string> {
  assertNonEmptyMasterKey(masterKey);

  const parts = ciphertext.split(":");
  const [prefix, ivHex, tagHex, dataHex] = parts;
  if (prefix !== V3_PREFIX || !ivHex || !tagHex || !dataHex || parts.length !== 4) {
    throw new Error("Invalid ciphertext v3 format");
  }

  let iv: Uint8Array<ArrayBuffer>;
  let tag: Uint8Array<ArrayBuffer>;
  let data: Uint8Array<ArrayBuffer>;
  try {
    iv = fromHex(ivHex);
    tag = fromHex(tagHex);
    data = fromHex(dataHex);
  } catch {
    throw new Error("Invalid ciphertext v3 metadata");
  }
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error("Invalid ciphertext v3 metadata");
  }

  const key = await deriveV3Key(masterKey);
  const combined = new Uint8Array(data.length + tag.length);
  combined.set(data, 0);
  combined.set(tag, data.length);

  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    combined,
  );

  return getTextDecoder().decode(decrypted);
}
