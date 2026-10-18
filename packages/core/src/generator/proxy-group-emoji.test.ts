import { describe, expect, it } from "vitest";
import { generateClashConfig } from "./index";
import { withoutProxyGroupEmoji } from "./proxy-group-emoji";
import { stripProxyGroupEmojiPrefix } from "../proxy-group-name";
import { buildGenerateOptionsFromConfig } from "../subscription/config-utils";
import type { ClashConfig } from "../types/config";
import type { ParsedNode } from "../types/node";

function node(name: string): ParsedNode {
  return { name, type: "ss", server: "example.com", port: 8388, cipher: "aes-128-gcm", password: "secret" } as ParsedNode;
}

describe("proxy group emoji preference", () => {
  it("round-trips the saved preference through generation without changing original names or node names", () => {
    const saved = {
      enabledGroups: ["select", "auto", "ai", "global", "final"],
      proxyGroupNameOverrides: { ai: "🧠 我的 AI" },
      customProxyGroups: [{ id: "custom", name: "👩🏽‍💻自定义", emoji: "👩🏽‍💻", groupType: "select" }],
      dialerProxyGroups: [{ id: "chain", name: "🇺🇸 中转", type: "select", relayNodes: ["🇺🇸 Entry"], targetNodes: ["🇯🇵 Exit"] }],
      customRules: [{ type: "DOMAIN", value: "example.com", target: { kind: "custom", id: "custom" } }],
      customRuleSets: [{ id: "test", name: "test", behavior: "domain", path: "https://example.com/test.mrs", target: { kind: "module", id: "ai" } }],
    };
    const snapshot = structuredClone(saved);
    const nodes = [node("🇺🇸 Entry"), node("🇯🇵 Exit")];
    const generate = (enabled?: boolean) => generateClashConfig(buildGenerateOptionsFromConfig(
      { ...saved, ...(enabled === undefined ? {} : { proxyGroupEmojiEnabled: enabled }) }, { nodes },
    ));
    const original = generate();
    const disabled = generate(false);
    expect(disabled["proxy-groups"]?.map((group) => group.name)).toEqual(
      original["proxy-groups"]?.map((group) => stripProxyGroupEmojiPrefix(group.name)),
    );
    expect(disabled["proxy-groups"]?.map((group) => group.name)).toEqual(expect.arrayContaining(["节点选择", "自动选择", "我的 AI", "自定义", "中转"]));
    expect(disabled.proxies?.map((proxy) => proxy.name)).toEqual(original.proxies?.map((proxy) => proxy.name));
    const policies = new Set(["DIRECT", "REJECT", ...disabled["proxy-groups"]!.map((group) => group.name), ...disabled.proxies!.map((proxy) => proxy.name)]);
    for (const group of disabled["proxy-groups"]!) {
      for (const member of group.proxies ?? []) expect(policies.has(member), `missing member ${member}`).toBe(true);
    }
    for (const proxy of disabled.proxies!) {
      if (typeof proxy["dialer-proxy"] === "string") expect(policies.has(proxy["dialer-proxy"])).toBe(true);
    }
    for (const rule of disabled.rules!) {
      const parts = rule.split(",");
      const target = parts.at(parts.at(-1) === "no-resolve" ? -2 : -1)!;
      expect(policies.has(target), `missing rule policy ${target}`).toBe(true);
    }
    expect(generate(true)).toEqual(original);
    expect(saved).toEqual(snapshot);
  });

  it("avoids policy collisions and rewrites group, rule, listener, provider and DNS references together", () => {
    const input: ClashConfig = {
      proxies: [node("共享")],
      "proxy-groups": [
        { name: "🚀共享", type: "select", proxies: ["🌍 共享", "共享"] },
        { name: "🌍 共享", type: "select", proxies: ["共享"] },
        { name: "共享 (2)", type: "select", proxies: ["DIRECT"] },
        { name: "🚀 DIRECT", type: "select", proxies: ["DIRECT"] },
      ],
      rules: ["DOMAIN,a.example,🚀共享", "IP-CIDR,192.0.2.0/24,🌍 共享,no-resolve", "AND,((NETWORK,TCP),(DST-PORT,443)),🚀共享", "SUB-RULE,(NETWORK,TCP),🚀共享"],
      "sub-rules": { "🚀共享": ["MATCH,🌍 共享"] },
      listeners: [{ name: "listener", type: "mixed", port: 7891, proxy: "🚀共享" }],
      "proxy-providers": { remote: { proxy: "🌍 共享", override: { "dialer-proxy": "🚀共享" } } },
      dns: { nameserver: ["https://dns.example/dns-query#🚀共享", `https://dns.example/dns-query#${encodeURIComponent("🌍 共享")}&h3=true`] },
    };
    const before = structuredClone(input);
    const output = withoutProxyGroupEmoji(input);
    expect(output["proxy-groups"]?.map((group) => group.name)).toEqual(["共享 (3)", "共享 (4)", "共享 (2)", "DIRECT (2)"]);
    expect(output["proxy-groups"]?.[0].proxies).toEqual(["共享 (4)", "共享"]);
    expect(output.rules).toEqual(["DOMAIN,a.example,共享 (3)", "IP-CIDR,192.0.2.0/24,共享 (4),no-resolve", "AND,((NETWORK,TCP),(DST-PORT,443)),共享 (3)", "SUB-RULE,(NETWORK,TCP),🚀共享"]);
    expect(output["sub-rules"]).toEqual({ "🚀共享": ["MATCH,共享 (4)"] });
    expect(output.listeners?.[0].proxy).toBe("共享 (3)");
    expect(output["proxy-providers"]).toEqual({ remote: { proxy: "共享 (4)", override: { "dialer-proxy": "共享 (3)" } } });
    expect(output.dns?.nameserver).toEqual(["https://dns.example/dns-query#共享 (3)", `https://dns.example/dns-query#${encodeURIComponent("共享 (4)")}&h3=true`]);
    expect(output.proxies?.[0].name).toBe("共享");
    expect(input).toEqual(before);
  });

  it("recognizes Unicode emoji prefixes without deleting plain words or returning an empty name", () => {
    for (const name of ["🇭🇰 香港", "👩🏽‍💻开发", "🛡️ 安全", "1️⃣ 一组", "🚀 ✨ 多个"]) {
      expect(stripProxyGroupEmojiPrefix(name)).toBe(name.replace(/^(🇭🇰 |👩🏽‍💻|🛡️ |1️⃣ |🚀 ✨ )/, ""));
    }
    for (const name of ["My Group", "香港 香港", "日本語 Group", "— Separator", "🧩"]) {
      expect(stripProxyGroupEmojiPrefix(name)).toBe(name);
    }
  });
});
