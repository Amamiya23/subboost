const FORMAT = "subboost-encrypted-backup";
// Fixed parameters bound the work for untrusted files and work in Workers Web Crypto.
const ITERATIONS = 100000;
const AAD = new TextEncoder().encode(FORMAT + ":1");
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;

function encode(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}

function decode(value: unknown): Uint8Array<ArrayBuffer> {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error("备份格式无效");
  try { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
  catch { throw new Error("备份格式无效"); }
}

function validatePassword(password: string) {
  if (typeof password !== "string" || password.length < 10 || password.length > 1024) {
    throw new Error("备份密码需为 10 至 1024 个字符");
  }
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  validatePassword(password);
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, material,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function encryptBackup(value: unknown, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  if (plaintext.byteLength > MAX_BACKUP_BYTES / 1.5) throw new Error("备份数据过大");
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 }, key, plaintext);
  return JSON.stringify({ format: FORMAT, version: 1, kdf: "PBKDF2-SHA256", iterations: ITERATIONS,
    cipher: "AES-256-GCM", salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) });
}

export async function decryptBackup(text: string, password: string): Promise<unknown> {
  validatePassword(password);
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("备份文件过大");
  let envelope;
  try { envelope = JSON.parse(text); } catch { throw new Error("备份格式无效"); }
  if (!envelope || envelope.format !== FORMAT || envelope.version !== 1 || envelope.kdf !== "PBKDF2-SHA256"
    || envelope.iterations !== ITERATIONS || envelope.cipher !== "AES-256-GCM") throw new Error("不支持的备份格式或版本");
  const salt = decode(envelope.salt);
  const iv = decode(envelope.iv);
  const ciphertext = decode(envelope.ciphertext);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error("备份格式无效");
  const key = await deriveKey(password, salt);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 }, key, ciphertext);
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
  } catch { throw new Error("解密失败：备份密码错误或文件已损坏"); }
}
