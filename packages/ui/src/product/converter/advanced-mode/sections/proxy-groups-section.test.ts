import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  store: {} as Record<string, unknown>,
  headerProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("lucide-react", () => ({
  Layers: () => React.createElement("span", null, "layers-icon"),
}));

vi.mock("@subboost/core/generator/proxy-groups", () => ({
  PROXY_GROUP_MODULES: [
    { id: "select" },
    { id: "auto" },
    { id: "cn" },
  ],
}));

vi.mock("@subboost/ui/components/coss/compat/badge", () => ({
  Badge: (props: any) => React.createElement("span", props, props.children),
}));

vi.mock("@subboost/ui/store/config-store", () => ({
  useConfigStore: () => mocks.store,
}));

vi.mock("../section-header", () => ({
  SectionHeader: (props: any) => {
    mocks.headerProps = props;
    return React.createElement("button", { onClick: props.onToggle }, props.title, props.badge);
  },
}));

vi.mock("./proxy-groups-categories", () => ({
  ProxyGroupsCategories: () => React.createElement("div", null, "categories-content"),
}));

import { ProxyGroupsSection } from "./proxy-groups-section";

describe("ProxyGroupsSection", () => {
  beforeEach(() => {
    mocks.store = {
      enabledProxyGroups: ["select", "auto", "cn"],
      hiddenProxyGroups: ["cn"],
    };
    mocks.headerProps = undefined;
  });

  it("renders enabled/visible group counts and expanded content", () => {
    const onToggle = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(ProxyGroupsSection, {
        isExpanded: true,
        onToggle,
      }),
    );

    expect(html).toContain("分流代理组");
    expect(html).toContain("2/2");
    expect(html).toContain("categories-content");
    expect(mocks.headerProps).toMatchObject({
      isExpanded: true,
      title: "分流代理组",
    });
    (mocks.headerProps?.onToggle as () => void)();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("omits categories while collapsed", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProxyGroupsSection, {
        isExpanded: false,
        onToggle: vi.fn(),
      }),
    );

    expect(html).not.toContain("categories-content");
    expect(mocks.headerProps).toMatchObject({ isExpanded: false });
  });
});
