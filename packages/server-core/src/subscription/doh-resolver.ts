import { getIpVersion } from "./ip-address";

const DEFAULT_DOH_ENDPOINTS = [
  "https://doh.pub/dns-query",
  "https://dns.alidns.com/dns-query",
  "https://doh.360.cn/dns-query",
  "https://dns.google/dns-query",
] as const;

const DNS_TYPE_A = 1;
const DNS_TYPE_AAAA = 28;
const DNS_CLASS_IN = 1;
const DEFAULT_TIMEOUT_MS = 4000;

export type DohQueryType = "A" | "AAAA";

export type DohTransportRequest = {
  endpoint: string;
  headers: Record<string, string>;
  body: Uint8Array;
  timeoutMs: number;
};

export type DohTransportResponse = {
  statusCode: number;
  body: Uint8Array;
};

export type DohTransport = (request: DohTransportRequest) => Promise<DohTransportResponse>;

export type ResolveHostnameByDohOptions = {
  endpoints?: readonly string[];
  timeoutMs?: number;
  transport?: DohTransport;
};

function normalizeHostname(hostname: string): string {
  return hostname.trim().replace(/\.$/, "").toLowerCase();
}

function queryTypeToCode(type: DohQueryType): number {
  return type === "A" ? DNS_TYPE_A : DNS_TYPE_AAAA;
}

function encodeDnsQuestion(hostname: string, type: DohQueryType): Uint8Array {
  const labels = normalizeHostname(hostname).split(".").filter(Boolean);
  const encodedLabels = labels.map((label) => new TextEncoder().encode(label));
  const questionLength = encodedLabels.reduce((sum, label) => sum + 1 + label.byteLength, 1);
  const out = new Uint8Array(12 + questionLength + 4);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0);
  view.setUint16(2, 0x0100);
  view.setUint16(4, 1);

  let offset = 12;
  for (const bytes of encodedLabels) {
    out[offset] = bytes.length;
    offset += 1;
    out.set(bytes, offset);
    offset += bytes.length;
  }
  out[offset] = 0;
  offset += 1;
  view.setUint16(offset, queryTypeToCode(type));
  offset += 2;
  view.setUint16(offset, DNS_CLASS_IN);

  return out;
}

function readNameEnd(message: Uint8Array, offset: number): number {
  let current = offset;
  let jumps = 0;

  while (current < message.length) {
    const length = message[current];
    if ((length & 0xc0) === 0xc0) {
      if (current + 1 >= message.length) return message.length;
      return current + 2;
    }
    if (length === 0) return current + 1;
    if ((length & 0xc0) !== 0) return message.length;
    current += 1 + length;
    jumps += 1;
    if (jumps > 128) return message.length;
  }

  return message.length;
}

function parseIpv6(bytes: Uint8Array): string {
  const groups: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 2) {
    groups.push(((bytes[offset] << 8) | bytes[offset + 1]).toString(16));
  }
  return groups.join(":");
}

function parseDnsResponseAddresses(message: Uint8Array): string[] {
  if (message.length < 12) return [];
  const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
  const questionCount = view.getUint16(4);
  const answerCount = view.getUint16(6);
  const out = new Set<string>();

  let offset = 12;
  for (let index = 0; index < questionCount; index += 1) {
    offset = readNameEnd(message, offset) + 4;
    if (offset > message.length) return [];
  }

  for (let index = 0; index < answerCount; index += 1) {
    offset = readNameEnd(message, offset);
    if (offset + 10 > message.length) return Array.from(out);

    const type = view.getUint16(offset);
    const klass = view.getUint16(offset + 2);
    const dataLength = view.getUint16(offset + 8);
    offset += 10;
    if (offset + dataLength > message.length) return Array.from(out);

    const data = message.slice(offset, offset + dataLength);
    if (klass === DNS_CLASS_IN && type === DNS_TYPE_A && dataLength === 4) {
      out.add(Array.from(data).join("."));
    }
    if (klass === DNS_CLASS_IN && type === DNS_TYPE_AAAA && dataLength === 16) {
      const ip = parseIpv6(data);
      if (getIpVersion(ip)) out.add(ip);
    }
    offset += dataLength;
  }

  return Array.from(out);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

async function defaultDohTransport(request: DohTransportRequest): Promise<DohTransportResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await fetch(request.endpoint, {
      method: "POST",
      headers: request.headers,
      body: toArrayBuffer(request.body),
      redirect: "manual",
      signal: controller.signal,
    });
    return {
      statusCode: response.status,
      body: new Uint8Array(await response.arrayBuffer()),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveEndpointAddresses(
  endpoint: string,
  hostname: string,
  timeoutMs: number,
  transport: DohTransport
): Promise<string[]> {
  const out = new Set<string>();
  for (const type of ["A", "AAAA"] as const) {
    const response = await transport({
      endpoint,
      headers: {
        Accept: "application/dns-message",
        "Content-Type": "application/dns-message",
      },
      body: encodeDnsQuestion(hostname, type),
      timeoutMs,
    });
    if (response.statusCode < 200 || response.statusCode >= 300) continue;
    for (const address of parseDnsResponseAddresses(response.body)) {
      if (getIpVersion(address)) out.add(address);
    }
  }
  return Array.from(out);
}

export async function resolveHostnameByDoh(
  hostname: string,
  opts: ResolveHostnameByDohOptions = {}
): Promise<string[]> {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) return [];

  const endpoints = opts.endpoints?.length ? opts.endpoints : DEFAULT_DOH_ENDPOINTS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const transport = opts.transport ?? defaultDohTransport;

  for (const endpoint of endpoints) {
    const addresses = await resolveEndpointAddresses(endpoint, normalizedHostname, timeoutMs, transport).catch(() => []);
    if (addresses.length > 0) return addresses;
  }

  return [];
}
