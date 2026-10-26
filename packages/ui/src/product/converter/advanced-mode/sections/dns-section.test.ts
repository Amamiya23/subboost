import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BASE_CONFIG_YAML } from "@subboost/core/config/defaults";

const captures = vi.hoisted(() => ({
  store: {
    dnsYaml: "dns:\n  enable: true",
    baseConfigDraft: null as string | null,
    generatedYamlError: "",
    setDnsYaml: vi.fn(),
    setBaseConfigDraft: vi.fn(),
  },
  error: null as string | null,
  headers: [] as any[],
  textareas: [] as any[],
  buttons: [] as any[],
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: () => [captures.error, (value: string | null) => { captures.error = value; }],
  };
});

vi.mock("lucide-react", () => ({
  AlertTriangle: () => React.createElement("span", null, "alert-icon"),
  Globe: () => React.createElement("span", null, "globe-icon"),
}));

vi.mock("@subboost/ui/store/config-store", () => ({
  useConfigStore: () => captures.store,
}));

vi.mock("@subboost/ui/components/coss/compat/badge", () => ({
  Badge: (props: any) => React.createElement("span", props, props.children),
}));

vi.mock("@subboost/ui/components/coss/compat/button", () => ({
  Button: (props: any) => {
    captures.buttons.push(props);
    return React.createElement("button", { type: props.type, disabled: props.disabled }, props.children);
  },
}));

vi.mock("@subboost/ui/components/coss/compat/textarea", () => ({
  Textarea: (props: any) => {
    captures.textareas.push(props);
    return React.createElement("textarea", props);
  },
}));

vi.mock("../section-header", () => ({
  SectionHeader: (props: any) => {
    captures.headers.push(props);
    return React.createElement("header", null, props.title, props.badge);
  },
}));

import { DnsSection } from "./dns-section";

function renderSection(isExpanded = true) {
  captures.headers = [];
  captures.textareas = [];
  captures.buttons = [];
  return renderToStaticMarkup(React.createElement(DnsSection, { isExpanded, onToggle: vi.fn() }));
}

function clickButton(label: string) {
  const button = captures.buttons.find((item) => item.children === label);
  expect(button).toBeDefined();
  expect(button.disabled).not.toBe(true);
  button.onClick();
}

describe("DnsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captures.error = null;
    captures.store = {
      dnsYaml: "dns:\n  enable: true",
      baseConfigDraft: null,
      generatedYamlError: "",
      setDnsYaml: vi.fn((value: string) => {
        captures.store.dnsYaml = value;
        captures.store.baseConfigDraft = null;
      }),
      setBaseConfigDraft: vi.fn((value: string | null) => { captures.store.baseConfigDraft = value; }),
    };
  });

  it("keeps pending edits visible in the collapsed header", () => {
    captures.store.baseConfigDraft = "mixed-port: 7890";
    const html = renderSection(false);

    expect(html).toContain("基础与 DNS");
    expect(html).toContain("未应用");
    expect(captures.headers[0]).toMatchObject({ isExpanded: false });
    expect(captures.textareas).toHaveLength(0);
  });

  it("labels the complete YAML editor and disables browser spell checking", () => {
    const html = renderSection();
    const editor = captures.textareas[0];

    expect(html).toContain(`for="${editor.id}"`);
    expect(html).toContain("基础与 DNS YAML");
    expect(html).toContain("清空会移除基础配置，不会恢复默认");
    expect(editor).toMatchObject({ value: captures.store.dnsYaml, spellCheck: false, "aria-invalid": false });
    expect(captures.buttons.every((button) => button.type === "button")).toBe(true);
  });

  it("keeps edits in the shared draft across folding without changing the effective configuration", () => {
    const effective = captures.store.dnsYaml;
    renderSection();
    captures.textareas[0].onChange({ target: { value: "mixed-port: 7890" } });

    expect(captures.store.setBaseConfigDraft).toHaveBeenCalledWith("mixed-port: 7890");
    expect(captures.store.setDnsYaml).not.toHaveBeenCalled();
    expect(captures.store.dnsYaml).toBe(effective);
    renderSection(false);
    renderSection();
    expect(captures.textareas[0].value).toBe("mixed-port: 7890");
  });

  it("clears the draft when the user types the effective YAML back", () => {
    captures.store.baseConfigDraft = "mixed-port: 7890";
    renderSection();
    captures.textareas[0].onChange({ target: { value: captures.store.dnsYaml } });

    expect(captures.store.setBaseConfigDraft).toHaveBeenCalledWith(null);
    expect(captures.store.setDnsYaml).not.toHaveBeenCalled();
  });

  it("applies validated YAML with comments and custom fields intact", () => {
    const draft = "# custom base\nmixed-port: 7890\ncustom-field: keep\n";
    captures.store.baseConfigDraft = draft;
    renderSection();
    clickButton("应用修改");

    expect(captures.store.setDnsYaml).toHaveBeenCalledWith(draft);
    expect(captures.store.dnsYaml).toBe(draft);
    expect(captures.store.baseConfigDraft).toBeNull();
  });

  it.each([
    ["dns: [", "YAML 解析失败"],
    ['dns:\n  enable: "true"', "dns.enable 必须是 true 或 false"],
    ["proxies: []", "不能包含 proxies"],
  ])("keeps invalid YAML pending without changing the effective preview: %s", (draft, message) => {
    const effective = captures.store.dnsYaml;
    captures.store.baseConfigDraft = draft;
    renderSection();
    clickButton("应用修改");

    expect(captures.store.setDnsYaml).not.toHaveBeenCalled();
    expect(captures.store.dnsYaml).toBe(effective);
    expect(captures.store.baseConfigDraft).toBe(draft);
    const html = renderSection();
    expect(html).toContain('role="alert"');
    expect(html).toContain(message);
    expect(captures.textareas[0]["aria-invalid"]).toBe(true);
    expect(captures.textareas[0].value).toBe(draft);
  });

  it("clears validation feedback while the user corrects the draft", () => {
    captures.store.baseConfigDraft = "dns: [";
    renderSection();
    clickButton("应用修改");
    expect(captures.error).toBeTruthy();
    renderSection();
    captures.textareas[0].onChange({ target: { value: "dns: {}" } });

    expect(captures.error).toBeNull();
    expect(captures.store.setDnsYaml).not.toHaveBeenCalled();
  });

  it("cancels pending changes without replacing effective YAML", () => {
    const effective = captures.store.dnsYaml;
    captures.store.baseConfigDraft = "mixed-port: 7890";
    renderSection();
    clickButton("取消");

    expect(captures.store.baseConfigDraft).toBeNull();
    expect(captures.store.dnsYaml).toBe(effective);
    expect(captures.store.setDnsYaml).not.toHaveBeenCalled();
    renderSection();
    expect(captures.textareas[0].value).toBe(effective);
  });

  it("stages restored defaults for review before applying them", () => {
    const effective = captures.store.dnsYaml;
    renderSection();
    clickButton("恢复默认");

    expect(captures.store.setBaseConfigDraft).toHaveBeenCalledWith(DEFAULT_BASE_CONFIG_YAML);
    expect(captures.store.setDnsYaml).not.toHaveBeenCalled();
    expect(captures.store.dnsYaml).toBe(effective);
    renderSection();
    expect(captures.textareas[0].value).toBe(DEFAULT_BASE_CONFIG_YAML);
  });

  it("applies an empty draft without implicitly restoring defaults", () => {
    captures.store.baseConfigDraft = "";
    renderSection();
    expect(captures.textareas[0].value).toBe("");
    clickButton("应用修改");

    expect(captures.store.setDnsYaml).toHaveBeenCalledWith("");
    expect(captures.store.dnsYaml).toBe("");
  });

  it("describes the applied DNS behavior and keeps pending behavior separate", () => {
    const proxyDns = 'dns:\n  enable: true\n  nameserver: ["https://1.1.1.1/dns-query#SubBoost DNS"]';
    captures.store.baseConfigDraft = proxyDns;
    let html = renderSection();
    expect(html).toContain("自定义配置");
    expect(html).not.toContain("业务 DNS 经代理");
    expect(html).toContain("未应用");

    captures.store.dnsYaml = proxyDns;
    captures.store.baseConfigDraft = "dns: {}";
    html = renderSection();
    expect(html).toContain("业务 DNS 经代理 · TUN 由客户端管理");
    expect(html).toContain("未应用");
  });

  it("does not infer proxy DNS from a comment or show unrelated generation errors", () => {
    captures.store.dnsYaml = "#SubBoost DNS\ndns: {}";
    captures.store.generatedYamlError = "代理组配置错误";
    const html = renderSection();

    expect(html).toContain("自定义配置");
    expect(html).not.toContain("业务 DNS 经代理");
    expect(html).not.toContain("代理组配置错误");
    expect(html).not.toContain('role="alert"');
  });

  it("accounts for legacy top-level nameserver policies in the effective DNS summary", () => {
    captures.store.dnsYaml = 'nameserver-policy: {"+.example.com": "223.5.5.5"}\ndns:\n  enable: true\n  nameserver: ["https://1.1.1.1/dns-query#SubBoost DNS"]';
    const html = renderSection();
    expect(html).toContain("自定义配置");
    expect(html).not.toContain("业务 DNS 经代理");
  });

  it.each([
    ['enable: false\n  nameserver: ["https://1.1.1.1/dns-query#SubBoost DNS"]'],
    ['enable: true\n  nameserver: []'],
    ['enable: true\n  nameserver: ["https://1.1.1.1/dns-query#SubBoost DNS", "223.5.5.5"]'],
    ['enable: true\n  nameserver: ["https://1.1.1.1/dns-query#SubBoost DNS"]\n  fallback: ["8.8.8.8"]'],
    ['enable: true\n  nameserver: ["https://1.1.1.1/dns-query#SubBoost DNS"]\n  direct-nameserver: ["223.5.5.5"]'],
    ['enable: true\n  nameserver: ["https://1.1.1.1/dns-query#SubBoost DNS"]\n  nameserver-policy: {"+.example.com": "223.5.5.5"}'],
    ['enable: true\n  nameserver: ["https://1.1.1.1/dns-query#SubBoost DNS"]\n  nameserver-policy: {"+.example.com": ["https://dns.google/dns-query#SubBoost DNS", "223.5.5.5"]}'],
    ['enable: true\n  nameserver: ["https://1.1.1.1/dns-query#SubBoost DNS-bad"]'],
  ])("labels disabled, mixed, or unrelated resolver policies as custom: %s", (dns) => {
    captures.store.dnsYaml = `dns:\n  ${dns}`;
    const html = renderSection();

    expect(html).toContain("自定义配置");
    expect(html).not.toContain("业务 DNS 经代理");
  });

  it("recognizes exact encoded group fragments while allowing direct bootstrap DNS", () => {
    captures.store.dnsYaml = `dns:
  enable: true
  nameserver: ["https://1.1.1.1/dns-query#h3=true&SubBoost%20DNS"]
  fallback: ["https://dns.google/dns-query#SubBoost DNS&h3=true"]
  direct-nameserver: []
  default-nameserver: ["223.5.5.5"]
  proxy-server-nameserver: ["119.29.29.29"]
  nameserver-policy:
    "+.example.com": "https://dns.google/dns-query#SubBoost%20DNS"
    "+.example.net": ["https://1.1.1.1/dns-query#SubBoost DNS"]`;
    const html = renderSection();

    expect(html).toContain("业务 DNS 经代理 · TUN 由客户端管理");
    expect(html).not.toContain("自定义配置");
  });
});
