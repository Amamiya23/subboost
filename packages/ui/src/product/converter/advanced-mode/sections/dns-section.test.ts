import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captures = vi.hoisted(() => ({
  store: {
    dnsYaml: "dns:\n  enable: true",
    generatedYamlError: "",
    setDnsYaml: vi.fn(),
  },
  headers: [] as any[],
  textareas: [] as any[],
}));

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

describe("DnsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captures.headers = [];
    captures.textareas = [];
    captures.store = {
      dnsYaml: "dns:\n  enable: true",
      generatedYamlError: "",
      setDnsYaml: vi.fn(),
    };
  });

  it("renders only the header when collapsed", () => {
    const html = renderToStaticMarkup(
      React.createElement(DnsSection, { isExpanded: false, onToggle: vi.fn() })
    );

    expect(html).toContain("基础和DNS配置");
    expect(captures.headers[0]).toMatchObject({ isExpanded: false });
    expect(captures.textareas).toHaveLength(0);
  });

  it("renders editable DNS YAML and errors when expanded", () => {
    captures.store.generatedYamlError = "dns failed";
    const html = renderToStaticMarkup(
      React.createElement(DnsSection, { isExpanded: true, onToggle: vi.fn() })
    );

    expect(html).toContain("YAML");
    expect(html).toContain("dns failed");
    expect(captures.textareas[0]).toMatchObject({
      value: "dns:\n  enable: true",
    });

    captures.textareas[0].onChange({ target: { value: "mixed-port: 7890" } });
    expect(captures.store.setDnsYaml).toHaveBeenCalledWith("mixed-port: 7890");
  });
});
