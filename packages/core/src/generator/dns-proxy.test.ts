import { describe, expect, it } from "vitest";
import type { ParsedNode } from "../types/node";
import { buildDnsProxyGroup, isSubBoostDnsResolver, SUBBOOST_DNS_PROXY_NAME } from "./dns-proxy";

const resolver = `https://1.1.1.1/dns-query#${SUBBOOST_DNS_PROXY_NAME}`;
const node = (name: string, type = "vless") => ({ name, type, server: "example.com", port: 443 }) as ParsedNode;
const options = () => ({
  dns: { nameserver: [resolver] }, selectionNodes: [node("Hong Kong"), node("Japan")],
  testUrl: "https://www.gstatic.com/generate_204", testInterval: 300,
});

describe("DNS proxy group", () => {
  it("identifies one resolver only by its exact decoded proxy fragment token", () => {
    for (const value of [resolver, `https://1.1.1.1/dns-query#${encodeURIComponent(SUBBOOST_DNS_PROXY_NAME)}`,
      `${resolver}&h3=false`, `https://1.1.1.1/dns-query#h3=false&${encodeURIComponent(SUBBOOST_DNS_PROXY_NAME)}`]) {
      expect(isSubBoostDnsResolver(value)).toBe(true);
    }
    for (const value of [null, undefined, [resolver], { resolver }, SUBBOOST_DNS_PROXY_NAME,
      `${resolver} Extra`, `${resolver}-backup`, `${resolver}%20Extra`,
      `https://1.1.1.1/dns-query#proxy=${SUBBOOST_DNS_PROXY_NAME}`,
      `https://1.1.1.1/dns-query?name=${SUBBOOST_DNS_PROXY_NAME}`,
      "https://1.1.1.1/dns-query#SubBoost%DNS"]) {
      expect(isSubBoostDnsResolver(value)).toBe(false);
    }
  });

  it("uses actual proxy nodes and fails closed rather than including DIRECT", () => {
    const group = buildDnsProxyGroup({
      ...options(),
      selectionNodes: [node("Hong Kong"), node("local", "direct"), node("dns", "dns"), node("stop", "reject"),
        node("pass", "pass"), node("compat", "compatible"), node("chain", "relay"), node("DIRECT"), node("Hong Kong")],
    });
    expect(group).toMatchObject({
      name: SUBBOOST_DNS_PROXY_NAME, type: "url-test", proxies: ["Hong Kong"],
      "empty-fallback": "REJECT", url: options().testUrl, interval: 300,
    });
    expect(group?.proxies).not.toContain("DIRECT");
  });

  it("rejects all DNS requests when there are no proxy nodes or providers", () => {
    expect(buildDnsProxyGroup({ ...options(), selectionNodes: [] })).toMatchObject({
      proxies: ["REJECT"], "empty-fallback": "REJECT",
    });
    expect(buildDnsProxyGroup({ ...options(), selectionNodes: [node("LAN", "direct")] })?.proxies).toEqual(["REJECT"]);
  });

  it("includes providers with non-proxy adapter exclusions and an explicit empty-provider rejection", () => {
    const group = buildDnsProxyGroup({ ...options(), selectionNodes: [], providerNames: ["airport", "airport"] });
    expect(group?.use).toEqual(["airport"]);
    expect(group?.proxies).toBeUndefined();
    expect(group?.["empty-fallback"]).toBe("REJECT");
    const excludedTypes = group?.["exclude-type"]?.split("|");
    expect(excludedTypes).toEqual(expect.arrayContaining(["Direct", "Dns", "Compatible", "Pass", "Relay"]));
  });

  it("preserves ordinary custom DNS, including unrelated appearances of the reserved text", () => {
    for (const dns of [undefined, null, "nameserver: []", { nameserver: ["https://dns.example/dns-query"] },
      { "fake-ip-filter": [`#${SUBBOOST_DNS_PROXY_NAME}`] },
      { nameserver: [`${resolver} Extra`] }, { nameserver: [`https://dns.example/#proxy=${SUBBOOST_DNS_PROXY_NAME}`] }]) {
      expect(buildDnsProxyGroup({ ...options(), dns, existingPolicyNames: [SUBBOOST_DNS_PROXY_NAME] })).toBeNull();
    }
  });

  it("recognizes exact resolver references across DNS lists and per-domain policy values", () => {
    for (const field of ["nameserver", "default-nameserver", "fallback", "proxy-server-nameserver", "direct-nameserver"]) {
      expect(buildDnsProxyGroup({ ...options(), dns: { [field]: [resolver] } })?.name).toBe(SUBBOOST_DNS_PROXY_NAME);
    }
    for (const field of ["nameserver-policy", "proxy-server-nameserver-policy"]) {
      expect(buildDnsProxyGroup({ ...options(), dns: { [field]: { "+.example.com": resolver } } })?.name).toBe(SUBBOOST_DNS_PROXY_NAME);
    }
    expect(buildDnsProxyGroup({ ...options(), dns: { nameserver: [`https://1.1.1.1/dns-query#${encodeURIComponent(SUBBOOST_DNS_PROXY_NAME)}&h3=false`] } })?.name).toBe(SUBBOOST_DNS_PROXY_NAME);
  });

  it("refuses reserved-name collisions with an existing node or policy", () => {
    expect(() => buildDnsProxyGroup({ ...options(), selectionNodes: [node(SUBBOOST_DNS_PROXY_NAME)] })).toThrow("保留名称");
    expect(() => buildDnsProxyGroup({ ...options(), existingPolicyNames: new Set([SUBBOOST_DNS_PROXY_NAME]) })).toThrow("保留名称");
  });
});
