export const REALITY_MLKEM_ENABLED_KEY = "_realityMlkemEnabled";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasRealityPublicKey(value: unknown): boolean {
  return isRecord(value) && typeof value["public-key"] === "string" && Boolean(value["public-key"].trim());
}

export function hasRealityConfig(node: unknown): boolean {
  if (!isRecord(node)) return false;
  if (hasRealityPublicKey(node["reality-opts"])) return true;
  if (node.type !== "vless" || node.network !== "xhttp") return false;
  const xhttpOpts = node["xhttp-opts"];
  const downloadSettings = isRecord(xhttpOpts) ? xhttpOpts["download-settings"] : undefined;
  return isRecord(downloadSettings) && hasRealityPublicKey(downloadSettings["reality-opts"]);
}

export function normalizeRealityShortId(input: unknown): string | null {
  const raw = (() => {
    if (typeof input === "string") return input;
    if (typeof input === "number" || typeof input === "bigint") return String(input);
    return "";
  })().trim();
  if (!raw) return null;

  let normalized = raw;
  if (normalized.startsWith("0x") || normalized.startsWith("0X")) {
    normalized = normalized.slice(2);
  }

  normalized = normalized.replace(/[\s:_-]/g, "");
  if (!normalized) return null;
  if (!/^[0-9a-fA-F]+$/.test(normalized)) return null;

  normalized = normalized.toLowerCase();
  if (normalized.length % 2 === 1) normalized = `0${normalized}`;
  if (normalized.length > 16) return null;

  return normalized;
}

