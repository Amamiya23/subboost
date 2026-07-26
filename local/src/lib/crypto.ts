import {
  decryptEncryptedFieldV3,
  decryptLegacyV2EncryptedField,
  encryptEncryptedFieldV3,
  isLegacyV2EncryptedField,
} from "@subboost/server-core/crypto";
import { requireEnv } from "./env";

function getMasterKey(): string {
  return requireEnv("ENCRYPTION_KEY");
}

export async function encryptText(plaintext: string): Promise<string> {
  return encryptEncryptedFieldV3(plaintext, getMasterKey());
}

export async function decryptText(ciphertext: string): Promise<string> {
  if (isLegacyV2EncryptedField(ciphertext)) {
    return decryptLegacyV2EncryptedField(ciphertext, getMasterKey());
  }
  return decryptEncryptedFieldV3(ciphertext, getMasterKey());
}

export async function encryptJson(value: unknown): Promise<string> {
  return encryptText(JSON.stringify(value));
}

export async function decryptJson<T>(ciphertext: string | null | undefined, fallback: T): Promise<T> {
  if (!ciphertext) return fallback;
  return JSON.parse(await decryptText(ciphertext)) as T;
}

export async function decryptJsonObject(
  ciphertext: string | null | undefined,
): Promise<Record<string, unknown>> {
  const value = await decryptJson<unknown>(ciphertext, {});
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
