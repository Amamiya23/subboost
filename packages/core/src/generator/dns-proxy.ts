import type { ParsedNode } from "@subboost/core/types/node";
import type { ProxyGroup } from "@subboost/core/types/config";

export const SUBBOOST_DNS_PROXY_NAME = "SubBoost DNS";

// AdapterType names used by Mihomo's exclude-type (not protocol scheme names).
const NON_PROXY_ADAPTER_TYPES = [
  "Direct", "Dns", "Reject", "RejectDrop", "Compatible", "Pass", "PassRule", "Rematch",
  "Relay", "Selector", "Fallback", "URLTest", "LoadBalance",
] as const;
const nonProxyTypes = new Set([
  ...NON_PROXY_ADAPTER_TYPES.map((type) => type.toLowerCase()),
  "reject-drop", "pass-rule", "select", "url-test", "load-balance",
]);
const builtinPolicyNames = new Set(["DIRECT", "DNS", "REJECT", "REJECT-DROP", "COMPATIBLE", "PASS", "GLOBAL"]);
const resolverFields = [
  "nameserver", "default-nameserver", "proxy-server-nameserver", "direct-nameserver", "fallback",
] as const;
const resolverPolicyFields = ["nameserver-policy", "proxy-server-nameserver-policy"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isSubBoostDnsResolver(resolver: unknown): boolean {
  if (typeof resolver !== "string") return false;
  const fragmentIndex = resolver.indexOf("#");
  if (fragmentIndex < 0) return false;
  return resolver.slice(fragmentIndex + 1).split("&").some((part) => {
    try {
      return decodeURIComponent(part) === SUBBOOST_DNS_PROXY_NAME;
    } catch {
      return false;
    }
  });
}

function usesDnsProxy(resolver: unknown): boolean {
  return Array.isArray(resolver) ? resolver.some(isSubBoostDnsResolver) : isSubBoostDnsResolver(resolver);
}

function dnsUsesProxy(dns: unknown): boolean {
  if (!isRecord(dns)) return false;
  if (resolverFields.some((field) => usesDnsProxy(dns[field]))) return true;
  return resolverPolicyFields.some((field) => {
    const policy = dns[field];
    return isRecord(policy) && Object.values(policy).some(usesDnsProxy);
  });
}

export function buildDnsProxyGroup(options: {
  dns: unknown;
  selectionNodes: ParsedNode[];
  providerNames?: string[];
  testUrl: string;
  testInterval: number;
  existingPolicyNames?: Iterable<string>;
}): ProxyGroup | null {
  if (!dnsUsesProxy(options.dns)) return null;
  const existingNames = new Set(options.existingPolicyNames ?? []);
  if (
    existingNames.has(SUBBOOST_DNS_PROXY_NAME) ||
    options.selectionNodes.some((node) => node.name === SUBBOOST_DNS_PROXY_NAME)
  ) {
    throw new Error(`“${SUBBOOST_DNS_PROXY_NAME}”是 DNS 专用代理组的保留名称，请修改同名节点或代理组`);
  }

  const proxies = Array.from(new Set(options.selectionNodes
    .filter((node) => !nonProxyTypes.has(node.type.toLowerCase()) && !builtinPolicyNames.has(node.name))
    .map((node) => node.name)));
  const providers = Array.from(new Set(options.providerNames ?? []));
  return {
    name: SUBBOOST_DNS_PROXY_NAME,
    type: "url-test",
    ...(proxies.length || !providers.length ? { proxies: proxies.length ? proxies : ["REJECT"] } : {}),
    ...(providers.length ? { use: providers, "exclude-type": NON_PROXY_ADAPTER_TYPES.join("|") } : {}),
    // Empty providers must fail closed instead of Mihomo's default COMPATIBLE.
    "empty-fallback": "REJECT",
    url: options.testUrl,
    interval: options.testInterval,
    lazy: false,
  };
}
