import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { resolveHostnameByDoh } from "@subboost/server-core/subscription/doh-resolver";
import { isPrivateOrReservedIp } from "@subboost/server-core/subscription/ssrf-ip";
import { MAX_BACKUP_BYTES } from "./backup-crypto";

export type WebDavConfig = { url: string; username: string; password: string; path: string };
export const DEFAULT_BACKUP_PATH = "subboost/backup.enc.json";

export function parseWebDavConfig(value: unknown): WebDavConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("请输入 WebDAV 配置");
  const input = value as Record<string, unknown>;
  if (![input.url, input.username, input.password, input.path].every((item) => typeof item === "string")) {
    throw new Error("WebDAV 配置格式无效");
  }
  let url: URL;
  try { url = new URL((input.url as string).trim()); } catch { throw new Error("WebDAV 地址无效"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("请使用不含凭据、查询参数或片段的 HTTPS WebDAV 地址");
  }
  const username = (input.username as string).trim();
  const password = input.password as string;
  if (!username || username.includes(":") || username.length > 1024 || !password || password.length > 4096) {
    throw new Error("请输入有效的 WebDAV 用户名和密码（或应用专用密码）");
  }
  const filePath = (input.path as string).trim().replace(/^\/+/, "");
  const parts = filePath.split("/");
  if (filePath.length > 1024 || parts.length > 10 || parts.some((part) => !part || part === "." || part === ".." || /[\\%?#\u0000-\u001f]/.test(part))) {
    throw new Error("备份路径无效，请使用相对文件路径，例如 subboost/backup.enc.json");
  }
  url.pathname = url.pathname.replace(/\/*$/, "/");
  return { url: url.href, username, password, path: filePath };
}

async function validateTarget(url: URL): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isPrivateOrReservedIp(hostname)) {
    throw new Error("WebDAV 不允许使用本机、内网或保留地址");
  }
  if (isIP(hostname)) return;
  let addresses = (await lookup(hostname, { all: true, verbatim: true }).catch(() => [])).map((item) => item.address);
  if (addresses.length === 0) addresses = await resolveHostnameByDoh(hostname, { timeoutMs: 3000 });
  if (addresses.length === 0 || addresses.some(isPrivateOrReservedIp)) throw new Error("WebDAV 域名无法解析为公网地址");
}

export async function readLimitedText(response: Pick<Response, "headers" | "body">, maxBytes = MAX_BACKUP_BYTES): Promise<string> {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new Error("备份文件过大");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw new Error("备份文件过大");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

async function request(config: WebDavConfig, relative: string, method: string, body?: string): Promise<string> {
  const url = new URL(relative.split("/").map(encodeURIComponent).join("/"), config.url);
  await validateTarget(url);
  // Reject redirects so authentication never follows a redirect to another host.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const credentials = new TextEncoder().encode(config.username + ":" + config.password);
    const response = await fetch(url, {
      method, redirect: "manual", cache: "no-store", signal: controller.signal,
      headers: { Authorization: "Basic " + btoa(String.fromCharCode(...credentials)),
        ...(method === "PROPFIND" ? { Depth: "0", "Content-Type": "application/xml; charset=utf-8" } : {}),
        ...(method === "PUT" ? { "Content-Type": "application/json" } : {}) },
      body,
    });
    if (!response.ok && !(method === "MKCOL" && response.status === 405)) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new Error("WebDAV 认证失败或没有访问权限");
      if (response.status === 404) throw new Error("WebDAV 目录或备份文件不存在");
      if (response.status >= 300 && response.status < 400) throw new Error("WebDAV 地址发生重定向，请填写最终的 HTTPS 地址");
      throw new Error("WebDAV 请求失败（HTTP " + response.status + "）");
    }
    if (method === "GET") return await readLimitedText(response);
    await response.body?.cancel();
    return "";
  } catch (error) {
    if (controller.signal.aborted) throw new Error("WebDAV 请求超时，请稍后重试");
    if (error instanceof TypeError) throw new Error("无法连接 WebDAV，请检查地址和网络");
    throw error;
  } finally { clearTimeout(timer); }
}

export async function testWebDav(config: WebDavConfig): Promise<void> {
  await request(config, "", "PROPFIND", '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>');
}

export async function uploadWebDavBackup(config: WebDavConfig, ciphertext: string): Promise<void> {
  const parts = config.path.split("/");
  for (let i = 1; i < parts.length; i++) await request(config, parts.slice(0, i).join("/") + "/", "MKCOL");
  await request(config, config.path, "PUT", ciphertext);
}

export async function downloadWebDavBackup(config: WebDavConfig): Promise<string> {
  return request(config, config.path, "GET");
}
