import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captures = vi.hoisted(() => ({
  initialSections: undefined as Set<string> | undefined,
  stateSetter: vi.fn(),
  lastSections: undefined as Set<string> | undefined,
  sections: {} as Record<string, any>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const value = captures.initialSections ?? (typeof initial === "function" ? (initial as () => unknown)() : initial);
      captures.stateSetter = vi.fn((updater: unknown) => {
        captures.lastSections =
          typeof updater === "function"
            ? (updater as (prev: Set<string>) => Set<string>)(value as Set<string>)
            : (updater as Set<string>);
      });
      return [value, captures.stateSetter];
    },
  };
});

function section(name: string) {
  const SectionMock = (props: any) => {
    captures.sections[name] = props;
    return React.createElement("div", null, name);
  };
  SectionMock.displayName = `${name}SectionMock`;
  return SectionMock;
}

vi.mock("@subboost/ui/store/config-store", () => ({
  useConfigStore: vi.fn(),
}));

vi.mock("./sections/input-section", () => ({ InputSection: section("input") }));
vi.mock("./sections/node-management-section", () => ({ NodeManagementSection: section("filter") }));
vi.mock("./sections/dialer-proxy-groups-section", () => ({ DialerProxyGroupsSection: section("chain") }));
vi.mock("./sections/proxy-groups-section", () => ({ ProxyGroupsSection: section("proxy") }));
vi.mock("./sections/rules-management-section", () => ({ RulesManagementSection: section("rules") }));
vi.mock("./sections/dns-section", () => ({ DnsSection: section("dns") }));

import { AdvancedMode } from "./root";

describe("AdvancedMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captures.initialSections = undefined;
    captures.sections = {};
    captures.lastSections = undefined;
  });

  it("renders a unified node section and the other advanced sections expanded by default", () => {
    const html = renderToStaticMarkup(React.createElement(AdvancedMode));

    expect(html).toContain("filter");
    expect(captures.sections.input).toBeUndefined();
    expect(Object.keys(captures.sections).sort()).toEqual([
      "chain",
      "dns",
      "filter",
      "proxy",
      "rules",
    ]);
    for (const props of Object.values(captures.sections)) {
      expect(props.isExpanded).toBe(true);
      expect(props.onToggle).toBeTypeOf("function");
    }
  });

  it("toggles sections through the captured callback", () => {
    renderToStaticMarkup(React.createElement(AdvancedMode));

    captures.sections.filter.onToggle();
    expect(captures.stateSetter).toHaveBeenCalled();
    expect(captures.lastSections?.has("filter")).toBe(false);
    expect(captures.lastSections?.has("dns")).toBe(true);
  });

  it("expands a collapsed section through the same toggle callback", () => {
    captures.initialSections = new Set(["dns"]);
    renderToStaticMarkup(React.createElement(AdvancedMode));

    expect(captures.sections.filter.isExpanded).toBe(false);
    captures.sections.filter.onToggle();

    expect(captures.lastSections?.has("filter")).toBe(true);
    expect(captures.lastSections?.has("dns")).toBe(true);
  });
});
