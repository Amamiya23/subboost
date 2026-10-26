import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { DEFAULT_DNS_CONFIG } from "../generator/dns";
import { SUBBOOST_DNS_PROXY_NAME } from "../generator/dns-proxy";
import { SUBBOOST_TEMPLATE_CONFIG_SCHEMA } from "../templates/config-template";
import {
  DEFAULT_BASE_CONFIG_YAML,
  DEFAULT_SUBBOOST_CONFIG,
  buildDefaultBaseConfigPatch,
  buildDefaultSubBoostTemplateConfig,
  buildDefaultUserConfig,
} from "./defaults";

describe("default config builders", () => {
  it("builds user config from the requested template and default runtime knobs", () => {
    const config = buildDefaultUserConfig("minimal");

    expect(config).toMatchObject({
      autoSelectStrategy: "url-test",
      testUrl: DEFAULT_SUBBOOST_CONFIG.testUrl,
      testInterval: DEFAULT_SUBBOOST_CONFIG.testInterval,
      ruleProviderBaseUrl: DEFAULT_SUBBOOST_CONFIG.ruleProviderBaseUrl,
      cnIpNoResolve: true,
      experimentalCnUseCnRuleSet: true,
      dnsYaml: "",
      mixedPort: 7897,
      allowLan: false,
    });
    expect(config.enabledGroups).toContain("select");
    expect(config.enabledRules).toEqual(config.enabledGroups);
    expect(config.customRules).not.toBe(DEFAULT_SUBBOOST_CONFIG.customRules);
    expect(config.ruleOrder).not.toBe(DEFAULT_SUBBOOST_CONFIG.ruleOrder);
  });

  it("builds the base Clash patch with optional overrides", () => {
    const patch = buildDefaultBaseConfigPatch({
      mixedPort: 12345,
      allowLan: false,
    });

    expect(patch).toMatchObject({
      "mixed-port": 12345,
      "allow-lan": false,
      mode: "rule",
      "log-level": "info",
      profile: {
        "store-selected": true,
        "store-fake-ip": false,
      },
      sniffer: {
        enable: true,
        "parse-pure-ip": true,
      },
    });
    expect(patch.dns?.enable).toBe(true);
    expect(patch["geox-url"]?.geoip).toContain("MetaCubeX");

    const defaultPatch = buildDefaultBaseConfigPatch();
    expect(defaultPatch).toMatchObject({
      "mixed-port": DEFAULT_SUBBOOST_CONFIG.mixedPort,
      "allow-lan": DEFAULT_SUBBOOST_CONFIG.allowLan,
    });
  });

  it("builds the full SubBoost template config with empty user customization fields", () => {
    const config = buildDefaultSubBoostTemplateConfig("full");

    expect(config).toMatchObject({
      schema: SUBBOOST_TEMPLATE_CONFIG_SCHEMA,
      template: "full",
      hiddenProxyGroups: [],
      customProxyGroups: [],
      proxyGroupAdvanced: {},
      proxyGroupAdvancedModeEnabled: false,
      customRuleSets: [],
      builtinRuleEdits: {},
      customRules: [],
      ruleOrder: [],
      dialerProxyGroups: [],
      proxyGroupNameOverrides: {},
      mixedPort: DEFAULT_SUBBOOST_CONFIG.mixedPort,
      allowLan: DEFAULT_SUBBOOST_CONFIG.allowLan,
      testUrl: DEFAULT_SUBBOOST_CONFIG.testUrl,
      testInterval: DEFAULT_SUBBOOST_CONFIG.testInterval,
      ruleProviderBaseUrl: DEFAULT_SUBBOOST_CONFIG.ruleProviderBaseUrl,
    });
    expect(config.enabledProxyGroups.length).toBeGreaterThan(0);
    expect(config.dnsYaml).toBe(DEFAULT_BASE_CONFIG_YAML);
    expect(load(config.dnsYaml)).toEqual(buildDefaultBaseConfigPatch());
  });

  it("serializes the complete canonical base patch as the editable default YAML", () => {
    expect(load(DEFAULT_BASE_CONFIG_YAML)).toEqual(buildDefaultBaseConfigPatch());
    expect(DEFAULT_BASE_CONFIG_YAML).toContain(`mixed-port: ${DEFAULT_SUBBOOST_CONFIG.mixedPort}`);
    expect(DEFAULT_BASE_CONFIG_YAML).toContain(`allow-lan: ${DEFAULT_SUBBOOST_CONFIG.allowLan}`);
    for (const section of ["# 基础配置", "# DNS 配置", "# 配置文件管理", "# 域名/流量嗅探"]) {
      expect(DEFAULT_BASE_CONFIG_YAML).toContain(section);
    }
  });

  it("routes every business resolver through the DNS proxy without a direct fallback", () => {
    expect(DEFAULT_DNS_CONFIG.nameserver).toEqual([
      `https://1.1.1.1/dns-query#${SUBBOOST_DNS_PROXY_NAME}`,
      `https://8.8.8.8/dns-query#${SUBBOOST_DNS_PROXY_NAME}`,
    ]);
    expect(DEFAULT_DNS_CONFIG.fallback).toBeUndefined();
    expect(DEFAULT_DNS_CONFIG["fallback-filter"]).toBeUndefined();
    expect(DEFAULT_DNS_CONFIG["direct-nameserver"]).toBeUndefined();
    expect(DEFAULT_DNS_CONFIG["prefer-h3"]).not.toBe(true);
    expect(JSON.stringify(DEFAULT_DNS_CONFIG)).not.toContain("h3=true");
  });

  it("uses encrypted IP endpoints for bootstrap and proxy host resolution without system DNS", () => {
    for (const field of ["default-nameserver", "proxy-server-nameserver"] as const) {
      expect(DEFAULT_DNS_CONFIG[field]?.length).toBeGreaterThan(0);
      for (const resolver of DEFAULT_DNS_CONFIG[field] ?? []) {
        const endpoint = new URL(resolver);
        expect(endpoint.protocol).toBe("https:");
        expect(endpoint.hostname).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
        expect(endpoint.hash).toBe("");
      }
    }
    expect(DEFAULT_DNS_CONFIG["use-system-hosts"]).toBe(false);
    expect(DEFAULT_BASE_CONFIG_YAML).not.toMatch(/\bsystem\b(?!-hosts)/);
    expect(DEFAULT_DNS_CONFIG["fake-ip-filter"]).toContain("*.lan");
  });

  it("keeps TUN with the client and defaults LAN access off while preserving explicit overrides", () => {
    expect(buildDefaultBaseConfigPatch()).not.toHaveProperty("tun");
    expect(buildDefaultBaseConfigPatch()["allow-lan"]).toBe(false);
    expect(buildDefaultBaseConfigPatch({ allowLan: true })["allow-lan"]).toBe(true);
  });
});
