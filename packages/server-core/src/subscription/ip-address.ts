export type IpVersion = 0 | 4 | 6;

function isIpv4Address(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function isIpv6Hextet(value: string): boolean {
  return /^[0-9a-f]{1,4}$/i.test(value);
}

function isIpv6Address(value: string): boolean {
  if (!value || value.includes(":::") || value.split("::").length > 2) return false;

  const hasCompression = value.includes("::");
  const [left = "", right = ""] = value.split("::");
  const leftParts = left ? left.split(":") : [];
  const rightParts = right ? right.split(":") : [];
  const parts = [...leftParts, ...rightParts];
  const ipv4Part = parts.find((part) => part.includes("."));

  if (ipv4Part) {
    if (parts.at(-1) !== ipv4Part || !isIpv4Address(ipv4Part)) return false;
  }
  if (parts.some((part) => part.includes(".") && part !== ipv4Part)) return false;
  if (parts.some((part) => part !== ipv4Part && !isIpv6Hextet(part))) return false;

  const segmentCount = parts.length + (ipv4Part ? 1 : 0);
  return hasCompression ? segmentCount < 8 : segmentCount === 8;
}

export function getIpVersion(value: string): IpVersion {
  if (isIpv4Address(value)) return 4;
  return isIpv6Address(value) ? 6 : 0;
}
