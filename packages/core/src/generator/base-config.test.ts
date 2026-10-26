import { describe, expect, it } from "vitest";
import { BaseConfigYamlError, parseBaseConfigYaml } from "./base-config";
import { BaseConfigYamlError as PublicBaseConfigYamlError, generateClashYaml } from "./index";

describe("base configuration validation", () => {
  it("keeps blank YAML empty and the public error class compatible", () => {
    expect(parseBaseConfigYaml(" \n\t")).toEqual({});
    expect(PublicBaseConfigYamlError).toBe(BaseConfigYamlError);
  });

  it("reports YAML parser locations and rejects non-mapping documents", () => {
    expect(() => parseBaseConfigYaml("dns:\n  nameserver: [")).toThrow(/第 \d+ 行，第 \d+ 列/);
    for (const input of ["null", "true", "[dns]", "7897", "just-a-string", "2026-10-26"]) {
      expect(() => parseBaseConfigYaml(input)).toThrow("顶层 key/value 映射");
    }
  });

  it.each(["port", "socks-port", "mixed-port", "redir-port", "tproxy-port"])("checks integer boundaries for %s while allowing zero to disable it", (key) => {
    for (const value of [0, 1, 65535]) expect(parseBaseConfigYaml(`${key}: ${value}`)).toEqual({ [key]: value });
    for (const value of ["-1", "65536", "1.5", "'7897'", "null", "true", ".inf"]) {
      expect(() => parseBaseConfigYaml(`${key}: ${value}`)).toThrow(`${key} 必须是 0–65535 的整数`);
    }
  });

  it.each(["allow-lan", "ipv6", "tcp-concurrent", "unified-delay"])("requires a boolean for %s", (key) => {
    expect(parseBaseConfigYaml(`${key}: false`)).toEqual({ [key]: false });
    expect(() => parseBaseConfigYaml(`${key}: 'false'`)).toThrow(`${key} 必须是 true 或 false`);
  });

  it.each(["dns", "tun", "profile", "sniffer"])("requires an object for the %s section", (key) => {
    expect(parseBaseConfigYaml(`${key}: {}`)).toEqual({ [key]: {} });
    for (const value of ["[]", "broken", "null", "true"]) {
      expect(() => parseBaseConfigYaml(`${key}: ${value}`)).toThrow(`${key} 必须是对象`);
    }
  });

  it("validates DNS and TUN booleans with the complete field path", () => {
    for (const key of ["enable", "ipv6", "respect-rules", "use-system-hosts", "prefer-h3"]) {
      expect(() => parseBaseConfigYaml(`dns:\n  ${key}: 'true'`)).toThrow(`dns.${key} 必须是 true 或 false`);
      expect(parseBaseConfigYaml(`dns:\n  ${key}: true`)).toEqual({ dns: { [key]: true } });
    }
    for (const key of ["enable", "auto-route", "strict-route"]) {
      expect(() => parseBaseConfigYaml(`tun:\n  ${key}: 1`)).toThrow(`tun.${key} 必须是 true 或 false`);
      expect(parseBaseConfigYaml(`tun:\n  ${key}: false`)).toEqual({ tun: { [key]: false } });
    }
  });

  it.each(["nameserver", "default-nameserver", "fallback", "proxy-server-nameserver", "direct-nameserver"])("checks DNS string lists without requiring optional %s entries", (key) => {
    expect(parseBaseConfigYaml(`dns:\n  ${key}: []`)).toEqual({ dns: { [key]: [] } });
    expect(parseBaseConfigYaml(`dns:\n  ${key}: ['https://1.1.1.1/dns-query']`)).toEqual({ dns: { [key]: ["https://1.1.1.1/dns-query"] } });
    expect(() => parseBaseConfigYaml(`dns:\n  ${key}: 1.1.1.1`)).toThrow(`dns.${key} 必须是字符串数组`);
    expect(() => parseBaseConfigYaml(`dns:\n  ${key}: ['1.1.1.1', ' ']`)).toThrow(`dns.${key}[1] 必须是非空字符串`);
    expect(() => parseBaseConfigYaml(`dns:\n  ${key}: [123]`)).toThrow(`dns.${key}[0] 必须是非空字符串`);
  });

  it("validates TUN DNS hijack entries while allowing an empty list", () => {
    expect(parseBaseConfigYaml("tun:\n  dns-hijack: ['any:53', 'tcp://any:53']")).toEqual({ tun: { "dns-hijack": ["any:53", "tcp://any:53"] } });
    expect(parseBaseConfigYaml("tun:\n  dns-hijack: []")).toEqual({ tun: { "dns-hijack": [] } });
    expect(() => parseBaseConfigYaml("tun:\n  dns-hijack: any:53")).toThrow("tun.dns-hijack 必须是字符串数组");
    expect(() => parseBaseConfigYaml("tun:\n  dns-hijack: [null]")).toThrow("tun.dns-hijack[0] 必须是非空字符串");
  });

  it("keeps unknown fields and future enum values unchanged", () => {
    const input = [
      "mixed-port: 7897", "custom-future-feature: {enabled: true, limit: 42}",
      "dns:", "  enhanced-mode: future-mode", "  new-option: [one, two]",
      "tun:", "  stack: future-stack", "  vendor-setting: false",
    ].join("\n");
    expect(parseBaseConfigYaml(input)).toEqual({
      "mixed-port": 7897, "custom-future-feature": { enabled: true, limit: 42 },
      dns: { "enhanced-mode": "future-mode", "new-option": ["one", "two"] },
      tun: { stack: "future-stack", "vendor-setting": false },
    });
  });

  it.each(["proxies", "proxy-groups", "rule-providers", "rules"])("rejects generated %s sections in the shared parser", (key) => {
    expect(() => parseBaseConfigYaml(`${key}: []`)).toThrow(`不能包含 ${key}`);
  });

  it("blocks semantically invalid YAML in the actual generator", () => {
    expect(() => generateClashYaml({ nodes: [], userConfig: { dnsYaml: "dns: []" } })).toThrow(BaseConfigYamlError);
    expect(() => generateClashYaml({ nodes: [], userConfig: { dnsYaml: "mixed-port: 65536" } })).toThrow("mixed-port");
  });
});
