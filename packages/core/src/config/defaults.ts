import { DEFAULT_DNS_CONFIG } from "@subboost/core/generator/dns";
import { dump } from "js-yaml";
import { DEFAULT_RULE_PROVIDER_BASE_URL } from "@subboost/core/rules/metadata";
import { TEMPLATES } from "@subboost/core/templates";
import { SUBBOOST_TEMPLATE_CONFIG_SCHEMA } from "@subboost/core/templates/config-template";
import type { ClashConfig, TemplateType, UserConfig } from "@subboost/core/types/config";
import type { SubBoostTemplateConfig } from "@subboost/core/types/template-config";

export const DEFAULT_SUBBOOST_CONFIG = {
  autoSelectStrategy: "url-test",
  testUrl: "https://www.gstatic.com/generate_204",
  testInterval: 300,
  ruleProviderBaseUrl: DEFAULT_RULE_PROVIDER_BASE_URL,
  customRules: [],
  ruleOrder: [],
  cnIpNoResolve: true,
  experimentalCnUseCnRuleSet: true,
  dnsYaml: "",
  mixedPort: 7897,
  allowLan: false,
} as const satisfies Omit<UserConfig, "enabledGroups" | "enabledRules">;

export function buildDefaultUserConfig(template: TemplateType): UserConfig {
  const templateConfig = TEMPLATES[template];
  return {
    enabledGroups: templateConfig.groups,
    enabledRules: templateConfig.rules,
    autoSelectStrategy: DEFAULT_SUBBOOST_CONFIG.autoSelectStrategy,
    testUrl: DEFAULT_SUBBOOST_CONFIG.testUrl,
    testInterval: DEFAULT_SUBBOOST_CONFIG.testInterval,
    ruleProviderBaseUrl: DEFAULT_SUBBOOST_CONFIG.ruleProviderBaseUrl,
    customRules: [...DEFAULT_SUBBOOST_CONFIG.customRules],
    ruleOrder: [...DEFAULT_SUBBOOST_CONFIG.ruleOrder],
    cnIpNoResolve: DEFAULT_SUBBOOST_CONFIG.cnIpNoResolve,
    experimentalCnUseCnRuleSet: DEFAULT_SUBBOOST_CONFIG.experimentalCnUseCnRuleSet,
    dnsYaml: DEFAULT_SUBBOOST_CONFIG.dnsYaml,
    mixedPort: DEFAULT_SUBBOOST_CONFIG.mixedPort,
    allowLan: DEFAULT_SUBBOOST_CONFIG.allowLan,
  };
}

export function buildDefaultBaseConfigPatch(options: {
  mixedPort?: number;
  allowLan?: boolean;
} = {}): ClashConfig {
  return {
    "mixed-port": options.mixedPort ?? DEFAULT_SUBBOOST_CONFIG.mixedPort,
    "allow-lan": options.allowLan ?? DEFAULT_SUBBOOST_CONFIG.allowLan,
    mode: "rule",
    "log-level": "info",
    "unified-delay": true,
    "tcp-concurrent": true,
    "find-process-mode": "strict",
    dns: DEFAULT_DNS_CONFIG,
    profile: {
      "store-selected": true,
      "store-fake-ip": false,
    },
    sniffer: {
      enable: true,
      "parse-pure-ip": true,
      sniff: {
        TLS: { ports: [443, 8443] },
        HTTP: { ports: [80, "8080-8880"], "override-destination": true },
        QUIC: { ports: [443, 8443] },
      },
    },
    "geodata-mode": true,
    "geo-auto-update": true,
    "geodata-loader": "standard",
    "geo-update-interval": 24,
    "geox-url": {
      geoip: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat",
      geosite: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
      mmdb: "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb",
      asn: "https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb",
    },
  };
}

export function buildDefaultSubBoostTemplateConfig(type: TemplateType): SubBoostTemplateConfig {
  const template = TEMPLATES[type];
  return {
    schema: SUBBOOST_TEMPLATE_CONFIG_SCHEMA,
    template: type,
    enabledProxyGroups: template.groups,
    hiddenProxyGroups: [],
    customProxyGroups: [],
    proxyGroupAdvanced: {},
    proxyGroupAdvancedModeEnabled: false,
    customRuleSets: [],
    builtinRuleEdits: {},
    customRules: [],
    ruleOrder: [],
    cnIpNoResolve: DEFAULT_SUBBOOST_CONFIG.cnIpNoResolve,
    experimentalCnUseCnRuleSet: DEFAULT_SUBBOOST_CONFIG.experimentalCnUseCnRuleSet,
    dialerProxyGroups: [],
    proxyGroupNameOverrides: {},
    dnsYaml: DEFAULT_BASE_CONFIG_YAML,
    mixedPort: DEFAULT_SUBBOOST_CONFIG.mixedPort,
    allowLan: DEFAULT_SUBBOOST_CONFIG.allowLan,
    testUrl: DEFAULT_SUBBOOST_CONFIG.testUrl,
    testInterval: DEFAULT_SUBBOOST_CONFIG.testInterval,
    ruleProviderBaseUrl: DEFAULT_SUBBOOST_CONFIG.ruleProviderBaseUrl,
  };
}

function serializeDefaultBaseConfig(): string {
  const yaml = dump(buildDefaultBaseConfigPatch(), { noRefs: true, lineWidth: -1 });
  return `# 基础配置\n${yaml}`
    .replace(/^dns:/m, "\n# DNS 配置\ndns:")
    .replace(/^profile:/m, "\n# 配置文件管理\nprofile:")
    .replace(/^sniffer:/m, "\n# 域名/流量嗅探\nsniffer:");
}

export const DEFAULT_BASE_CONFIG_YAML = serializeDefaultBaseConfig();
