const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
