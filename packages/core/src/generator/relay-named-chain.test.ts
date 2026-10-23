import { describe, expect, it } from "vitest";
import { generateClashConfig, generateClashYaml } from "./index";
import { buildGenerateOptionsFromConfig } from "../subscription/config-utils";
import type { ParsedNode } from "../types/node";
import type { DialerProxyGroup } from "../types/template-config";

function entrance(name = "US Magebox"): ParsedNode {
  return { name, type: "ss", server: `${name}.example.com`, port: 8388,
    cipher: "aes-128-gcm", password: "entrance-secret", _sourceIds: ["airport"] } as ParsedNode;
}
const landing = {
  name: "Landing", type: "vless", server: "landing.example.com", port: 443,
  uuid: "e413c37e-615e-4d09-bb47-658745f724f2", tls: true, servername: "landing.example.com",
  network: "ws", "ws-opts": { path: "/proxy", headers: { Host: "landing.example.com" } },
  _sourceIds: ["private"],
} as ParsedNode;
function chain(patch: Partial<DialerProxyGroup> = {}): DialerProxyGroup {
  return { id: "chain", name: "US 中转", type: "select", preserveRelayNames: true,
    relayNodes: ["US Magebox"], targetNodes: ["Landing"], ...patch };
}
function generate(groups = [chain()], nodes = [entrance(), landing]) {
  return generateClashConfig({ nodes, dialerProxyGroups: groups, userConfig: { dnsYaml: "" } });
}

describe("chains retaining entrance names", () => {
  it("uses landing credentials under the entrance name, with a private entrance and no extra group", () => {
    const nodes = [entrance(), landing];
    const before = structuredClone(nodes);
    const config = generate([chain()], nodes);
    const publicNode = config.proxies!.find((node) => node.name === "US Magebox")!;
    expect(publicNode).toMatchObject({ ...landing, name: "US Magebox" });
    const internalName = publicNode["dialer-proxy"] as string;
    expect(config.proxies!.find((node) => node.name === internalName)).toMatchObject({
      ...entrance(), name: internalName,
    });
    expect(config.proxies!.map((node) => node.name)).not.toContain("Landing");
    expect(config["proxy-groups"]!.map((group) => group.name)).not.toContain("US 中转");
    for (const group of config["proxy-groups"]!) {
      expect(group.proxies).not.toContain(internalName);
      expect(group.proxies).not.toContain("Landing");
    }
    expect(config["proxy-groups"]!.find((group) => group.name === "🚀 节点选择")!.proxies).toContain("US Magebox");
    expect(nodes).toEqual(before);
  });

  it("creates an independent chain per entrance, sharing one landing", () => {
    const config = generate([chain({ relayNodes: ["US Magebox", "US VMISS"] })],
      [entrance(), entrance("US VMISS"), landing]);
    const publicNodes = config.proxies!.filter((node) => node.name.startsWith("US "));
    expect(publicNodes).toHaveLength(2);
    expect(new Set(publicNodes.map((node) => node["dialer-proxy"])).size).toBe(2);
    for (const node of publicNodes) {
      expect(node.server).toBe(landing.server);
      const hop = config.proxies!.find((item) => item.name === node["dialer-proxy"])!;
      expect(hop.server).toBe(entrance(node.name).server);
    }
  });

  it("allows shared landings across groups and exposes direct landing only when requested", () => {
    const config = generate([chain(), chain({ id: "two", name: "Second", relayNodes: ["US VMISS"], exposeLanding: true })],
      [entrance(), entrance("US VMISS"), landing]);
    expect(config.proxies!.find((node) => node.name === "Landing")).toEqual(landing);
    expect(config["proxy-groups"]!.find((group) => group.name === "🚀 节点选择")!.proxies).toContain("Landing");
  });

  it("retains entrance source filtering, order, and listener names", () => {
    const config = generateClashConfig({
      nodes: [entrance(), landing], dialerProxyGroups: [chain()],
      userConfig: { dnsYaml: "", listenerPorts: { "US Magebox": 41000 } },
      proxyGroupAdvanced: { select: { sourceIds: ["airport"] } },
      customProxyGroups: [{ id: "custom", name: "My Group", emoji: "", groupType: "select", memberSource: "filtered-nodes",
        advanced: { sourceIds: ["airport"] } }],
    });
    expect(config["proxy-groups"]!.find((group) => group.name === "My Group")!.proxies).toContain("US Magebox");
    expect(config.listeners).toEqual([{ name: "mixed0", type: "mixed", port: 41000, proxy: "US Magebox" }]);
  });

  it("avoids generated name collisions and does not inherit an imported dialer", () => {
    const original = { ...entrance(), "dialer-proxy": "Bad" } as ParsedNode;
    const occupied = entrance("__subboost_entry_US Magebox");
    const config = generate([chain()], [original, landing, occupied]);
    expect(new Set(config.proxies!.map((node) => node.name)).size).toBe(config.proxies!.length);
    const hop = config.proxies!.find((node) => node.name === config.proxies![0]["dialer-proxy"])!;
    expect(hop).not.toHaveProperty("dialer-proxy");
    expect(hop.server).toBe(original.server);
  });

  it.each([
    { relayNodes: [] }, { targetNodes: [] }, { targetNodes: ["Landing", "US Magebox"] },
    { relayNodes: ["DIRECT"] }, { relayNodes: ["🚀 节点选择"] },
    { relayNodes: ["Missing"] }, { targetNodes: ["Missing"] }, { targetNodes: ["US Magebox"] },
  ])("rejects incomplete or invalid bindings instead of changing the exit: %j", (patch) => {
    expect(() => generate([chain(patch)])).toThrow(/中转组/);
  });

  it("rejects duplicate bindings and loops, but accepts disabled conflicting groups", () => {
    const duplicate = chain({ id: "two", name: "Second" });
    expect(() => generate([chain(), duplicate])).toThrow(/其他中转组/);
    expect(() => generate([chain(), chain({ id: "two", relayNodes: ["Landing"], targetNodes: ["US Magebox"] })])).toThrow(/其他中转组/);
    expect(() => generate([chain(), { ...duplicate, enabled: false }])).not.toThrow();
  });

  it("rejects ambiguous node names and overlapping ordinary chains", () => {
    expect(() => generate([chain()], [entrance(), entrance(), landing])).toThrow(/重名/);
    expect(() => generate([chain(), chain({ id: "ordinary", preserveRelayNames: false })])).toThrow(/其他中转组/);
  });

  it("restores ordinary behavior when disabled or switched back", () => {
    const disabled = generate([chain({ enabled: false })]);
    expect(disabled.proxies).toEqual([entrance(), landing]);
    const ordinary = generate([chain({ preserveRelayNames: false })]);
    expect(ordinary.proxies!.find((node) => node.name === "US Magebox")!.server).toBe(entrance().server);
    expect(ordinary.proxies!.find((node) => node.name === "Landing")).toHaveProperty("dialer-proxy", "US 中转");
    expect(ordinary["proxy-groups"]!.some((group) => group.name === "US 中转")).toBe(true);
  });

  it("reports rules and listeners still targeting the hidden landing instead of silently retargeting them", () => {
    for (const userConfig of [
      { customRules: [{ id: "one", type: "DOMAIN" as const, value: "example.com", target: "Landing" }] },
      { listenerPorts: { Landing: 41000 } },
      { dnsYaml: "listeners:\n  - name: my-port\n    type: mixed\n    port: 41001\n    proxy: Landing\n" },
    ]) {
      expect(() => generateClashConfig({ nodes: [entrance(), landing], dialerProxyGroups: [chain()], userConfig })).toThrow(/仍引用/);
      expect(() => generateClashConfig({ nodes: [entrance(), landing], dialerProxyGroups: [chain({ exposeLanding: true })], userConfig })).not.toThrow();
    }
  });

  it("keeps saved subscription regeneration identical to the preview", () => {
    const nodes = [entrance(), landing];
    const rawConfig = JSON.parse(JSON.stringify({ dialerProxyGroups: [chain({ exposeLanding: true })], dnsYaml: "" }));
    const options = buildGenerateOptionsFromConfig(rawConfig, { nodes });
    expect(options.dialerProxyGroups![0]).toMatchObject({ preserveRelayNames: true, exposeLanding: true });
    expect(generateClashYaml(options)).toBe(generateClashYaml({ nodes, dialerProxyGroups: rawConfig.dialerProxyGroups,
      userConfig: { dnsYaml: "" } }));
    expect(() => generateClashYaml(buildGenerateOptionsFromConfig(rawConfig, { nodes: [entrance()] }))).toThrow(/重新绑定/);
  });
});
