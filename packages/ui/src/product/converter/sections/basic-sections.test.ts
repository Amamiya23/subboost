import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captures = vi.hoisted(() => ({
  inputs: [] as any[],
  textareas: [] as any[],
}));

vi.mock("lucide-react", () => ({
  ChevronDown: () => React.createElement("span", null, "down-icon"),
  ChevronRight: () => React.createElement("span", null, "right-icon"),
  Filter: () => React.createElement("span", null, "filter-icon"),
  Globe: () => React.createElement("span", null, "globe-icon"),
}));

vi.mock("@subboost/ui/components/coss/compat/badge", () => ({
  Badge: (props: any) => React.createElement("span", props, props.children),
}));

vi.mock("@subboost/ui/components/coss/compat/input", () => ({
  Input: (props: any) => {
    captures.inputs.push(props);
    return React.createElement("input", props);
  },
}));

vi.mock("@subboost/ui/components/coss/compat/textarea", () => ({
  Textarea: (props: any) => {
    captures.textareas.push(props);
    return React.createElement("textarea", props);
  },
}));

vi.mock("@subboost/ui/lib/utils", () => ({
  cn: (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" "),
}));

import { DNSConfigSection } from "./dns-config-section";
import { NodeFilterSection } from "./node-filter-section";
import { SectionHeader } from "./section-header";

function TestIcon() {
  return React.createElement("span", null, "test-icon");
}

describe("converter shared sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captures.inputs = [];
    captures.textareas = [];
  });

  it("renders section headers and forwards the toggle callback", () => {
    const onToggle = vi.fn();
    const expanded = renderToStaticMarkup(
      React.createElement(SectionHeader, {
        expanded: true,
        onToggle,
        icon: TestIcon,
        title: "标题",
        badge: React.createElement("span", null, "badge"),
      })
    );
    const collapsed = renderToStaticMarkup(
      React.createElement(SectionHeader, {
        expanded: false,
        onToggle,
        icon: TestIcon,
        title: "折叠",
      })
    );

    expect(expanded).toContain("down-icon");
    expect(expanded).toContain("test-icon");
    expect(expanded).toContain("badge");
    expect(collapsed).toContain("right-icon");

    const element = SectionHeader({
      expanded: true,
      onToggle,
      icon: TestIcon,
      title: "标题",
    }) as React.ReactElement<{ onClick: () => void }>;
    element.props.onClick();
    expect(onToggle).toHaveBeenCalled();
  });

  it("renders and updates DNS config when expanded", () => {
    const onDnsYamlChange = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(DNSConfigSection, {
        expanded: true,
        onToggle: vi.fn(),
        dnsYaml: "dns: {}",
        onDnsYamlChange,
      })
    );

    expect(html).toContain("基础和 DNS 配置");
    expect(html).toContain("直接编辑 YAML 格式的基础配置");
    expect(captures.textareas[0]).toMatchObject({ value: "dns: {}" });

    captures.textareas[0].onChange({ target: { value: "mixed-port: 7890" } });
    expect(onDnsYamlChange).toHaveBeenCalledWith("mixed-port: 7890");
  });

  it("hides DNS config body when collapsed", () => {
    const html = renderToStaticMarkup(
      React.createElement(DNSConfigSection, {
        expanded: false,
        onToggle: vi.fn(),
        dnsYaml: "dns: {}",
        onDnsYamlChange: vi.fn(),
      })
    );

    expect(html).toContain("基础和 DNS 配置");
    expect(html).not.toContain("直接编辑 YAML 格式的基础配置");
    expect(captures.textareas).toHaveLength(0);
  });

  it("renders node filter controls and dispatches include/exclude changes", () => {
    const onFilterChange = vi.fn();
    const onFilterModeChange = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(NodeFilterSection, {
        expanded: true,
        onToggle: vi.fn(),
        filterKeyword: "香港",
        onFilterChange,
        filterMode: "include",
        onFilterModeChange,
        totalNodes: 10,
        filteredCount: 3,
      })
    );

    expect(html).toContain("节点筛选");
    expect(html).toContain("3/10");
    expect(html).toContain("包含");
    expect(html).toContain("排除");
    expect(captures.inputs[0]).toMatchObject({ value: "香港" });

    captures.inputs[0].onChange({ target: { value: "日本" } });
    expect(onFilterChange).toHaveBeenCalledWith("日本");
    expect(html).toContain("bg-success/10");
  });

  it("omits filter body and badge when collapsed or empty", () => {
    const html = renderToStaticMarkup(
      React.createElement(NodeFilterSection, {
        expanded: false,
        onToggle: vi.fn(),
        filterKeyword: "   ",
        onFilterChange: vi.fn(),
        filterMode: "exclude",
        onFilterModeChange: vi.fn(),
        totalNodes: 0,
        filteredCount: 0,
      })
    );

    expect(html).toContain("节点筛选");
    expect(html).not.toContain("0/0");
    expect(html).not.toContain("输入关键词过滤节点");
  });
});
