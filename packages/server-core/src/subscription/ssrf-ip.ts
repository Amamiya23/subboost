import { getIpVersion } from "./ip-address";

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;

  return (
    (((nums[0] << 24) >>> 0) +
      ((nums[1] << 16) >>> 0) +
      ((nums[2] << 8) >>> 0) +
      (nums[3] >>> 0)) >>>
    0
  );
}

function ipv4InCidr(ipInt: number, baseInt: number, maskBits: number): boolean {
  const mask = maskBits === 0 ? 0 : ((0xffffffff << (32 - maskBits)) >>> 0);
  return ((ipInt & mask) >>> 0) === ((baseInt & mask) >>> 0);
}

function isPrivateOrReservedIPv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return true;

  const cidrs: Array<{ base: string; mask: number }> = [
    { base: "0.0.0.0", mask: 8 },
    { base: "10.0.0.0", mask: 8 },
    { base: "100.64.0.0", mask: 10 },
    { base: "127.0.0.0", mask: 8 },
    { base: "169.254.0.0", mask: 16 },
    { base: "172.16.0.0", mask: 12 },
    { base: "192.0.0.0", mask: 24 },
    { base: "192.0.2.0", mask: 24 },
    { base: "192.88.99.0", mask: 24 },
    { base: "192.168.0.0", mask: 16 },
    { base: "198.18.0.0", mask: 15 },
    { base: "198.51.100.0", mask: 24 },
    { base: "203.0.113.0", mask: 24 },
    { base: "224.0.0.0", mask: 4 },
    { base: "240.0.0.0", mask: 4 },
  ];

  for (const cidr of cidrs) {
    const baseInt = ipv4ToInt(cidr.base);
    if (baseInt === null) continue;
    if (ipv4InCidr(ipInt, baseInt, cidr.mask)) return true;
  }

  return false;
}

function isBenchmarkReservedIPv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt("198.18.0.0");
  if (ipInt === null || baseInt === null) return false;
  return ipv4InCidr(ipInt, baseInt, 15);
}

function ipv4FromMappedHexTail(value: string): string | null {
  const parts = value.split(":");
  if (parts.length !== 2) return null;
  const nums = parts.map((part) => Number.parseInt(part, 16));
  if (nums.some((num) => !Number.isInteger(num) || num < 0 || num > 0xffff)) return null;
  return [
    nums[0] >> 8,
    nums[0] & 0xff,
    nums[1] >> 8,
    nums[1] & 0xff,
  ].join(".");
}

function isDocumentationIPv6(ip: string): boolean {
  const [first = "", second = ""] = ip.split(":");
  return Number.parseInt(first, 16) === 0x2001 && Number.parseInt(second, 16) === 0x0db8;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;
  if (normalized === "::1") return true;

  const firstHextet = normalized.split(":")[0] || "";
  if (firstHextet.startsWith("fc") || firstHextet.startsWith("fd")) return true;
  if (
    firstHextet.startsWith("fe8") ||
    firstHextet.startsWith("fe9") ||
    firstHextet.startsWith("fea") ||
    firstHextet.startsWith("feb")
  ) {
    return true;
  }
  if (firstHextet.startsWith("ff")) return true;
  if (isDocumentationIPv6(normalized)) return true;

  const lastSegment = normalized.split(":").slice(-1)[0] || "";
  if (lastSegment.includes(".")) {
    return isPrivateOrReservedIPv4(lastSegment);
  }
  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = ipv4FromMappedHexTail(normalized.slice("::ffff:".length));
    return mappedIpv4 ? isPrivateOrReservedIPv4(mappedIpv4) : false;
  }

  return false;
}

export function isPrivateOrReservedIp(hostname: string): boolean {
  const version = getIpVersion(hostname);
  if (version === 4) return isPrivateOrReservedIPv4(hostname);
  if (version === 6) return isPrivateOrReservedIPv6(hostname);
  return false;
}

export function isBenchmarkReservedIp(hostname: string): boolean {
  const version = getIpVersion(hostname);
  if (version === 4) return isBenchmarkReservedIPv4(hostname);
  return false;
}

export function normalizeResolvedIpAddresses(addresses: readonly string[]): string[] {
  return addresses
    .map((ip) => (typeof ip === "string" ? ip.trim() : ""))
    .filter(Boolean);
}

export function shouldRecheckFakeIpDnsAnswers(addresses: readonly string[]): boolean {
  const normalized = normalizeResolvedIpAddresses(addresses);
  const unsafe = normalized.filter((ip) => isPrivateOrReservedIp(ip));
  return unsafe.length > 0 && unsafe.every((ip) => isBenchmarkReservedIp(ip));
}

export function selectDnsAddressesAfterFakeIpRecheck(
  systemAddresses: readonly string[],
  recheckAddresses: readonly string[]
): string[] {
  const normalizedSystemAddresses = normalizeResolvedIpAddresses(systemAddresses);
  if (!shouldRecheckFakeIpDnsAnswers(normalizedSystemAddresses)) return normalizedSystemAddresses;

  const normalizedRecheckAddresses = normalizeResolvedIpAddresses(recheckAddresses);
  return normalizedRecheckAddresses.length > 0 ? normalizedRecheckAddresses : normalizedSystemAddresses;
}
