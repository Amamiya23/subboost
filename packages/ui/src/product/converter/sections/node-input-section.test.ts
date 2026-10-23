import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedNode } from "@subboost/core/types/node";
import type { SubscriptionSource } from "@subboost/ui/store/config-store";

const mocks = vi.hoisted(() => ({
  buttons: [] as any[],
  inputs: [] as any[],
  intrinsics: [] as any[],
  textareas: [] as any[],
  sectionHeaders: [] as any[],
}));

const stateMock = vi.hoisted(() => ({
  enabled: false,
  callIndex: 0,
  overrides: {} as Record<number, unknown>,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useMemo: (factory: () => unknown) => factory(),
    useState: (initial: unknown) => {
      if (!stateMock.enabled) return actual.useState(initial);
      const index = stateMock.callIndex++;
      const value = Object.prototype.hasOwnProperty.call(stateMock.overrides, index)
        ? stateMock.overrides[index]
        : initial;
      const setter = vi.fn((next: unknown) => {
        const resolved = typeof next === "function" ? (next as (prev: unknown) => unknown)(value) : next;
        (setter as any).lastValue = resolved;
        return resolved;
      });
      stateMock.setters[index] = setter;
      return [value, setter];
    },
  };
});

vi.mock("react/jsx-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react/jsx-runtime")>();
  const capture = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => {
    if (typeof type === "string") {
      mocks.intrinsics.push({ type, props: props ?? {}, key });
    }
  };
  return {
    ...actual,
    jsx: (type: unknown, props: Record<string, unknown> | null, key?: unknown) => {
      capture(type, props, key);
      return actual.jsx(type as any, props, key as any);
    },
    jsxs: (type: unknown, props: Record<string, unknown> | null, key?: unknown) => {
      capture(type, props, key);
      return actual.jsxs(type as any, props, key as any);
    },
  };
});

vi.mock("lucide-react", () => ({
  Plus: () => React.createElement("span", null, "plus"),
  Trash2: () => React.createElement("span", null, "trash"),
  Link2: () => React.createElement("span", null, "link"),
  FileCode: () => React.createElement("span", null, "file"),
  Server: () => React.createElement("span", null, "server"),
  Check: () => React.createElement("span", null, "check"),
  Loader2: () => React.createElement("span", null, "loading"),
  Pencil: () => React.createElement("span", null, "pencil"),
  X: () => React.createElement("span", null, "x"),
  Search: () => React.createElement("span", null, "search"),
}));

vi.mock("@subboost/ui/components/coss/compat/button", () => ({
  Button: (props: any) => {
    mocks.buttons.push(props);
    return React.createElement("button", props, props.children);
  },
}));

vi.mock("@subboost/ui/components/coss/compat/input", () => ({
  Input: (props: any) => {
    mocks.inputs.push(props);
    return React.createElement("input", props);
  },
}));

vi.mock("@subboost/ui/components/coss/compat/textarea", () => ({
  Textarea: (props: any) => {
    mocks.textareas.push(props);
    return React.createElement("textarea", props);
  },
}));

vi.mock("@subboost/ui/components/coss/compat/badge", () => ({
  Badge: (props: any) => React.createElement("span", { className: props.className }, props.children),
}));

vi.mock("@subboost/ui/lib/utils", () => ({
  cn: (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" "),
}));

vi.mock("./section-header", () => ({
  SectionHeader: (props: any) => {
    mocks.sectionHeaders.push(props);
    return React.createElement("header", null, props.title, props.badge);
  },
}));

vi.mock("@subboost/ui/product/converter/subscription-import-error", () => ({
  SubscriptionImportErrorBadge: () => React.createElement("span", null, "import-error"),
}));

import { NodeInputSection } from "./node-input-section";

function source(overrides: Partial<SubscriptionSource> = {}): SubscriptionSource {
  return {
    id: "source-1",
    type: "url",
    content: "https://example.test/sub",
    parsed: false,
    parsing: false,
    ...overrides,
  } as SubscriptionSource;
}

function node(name: string): ParsedNode {
  return { name, type: "direct" } as ParsedNode;
}

function renderSection(
  props: Partial<React.ComponentProps<typeof NodeInputSection>> = {},
  stateOverrides: Record<number, unknown> = {}
) {
  const callbacks = {
    onToggle: vi.fn(),
    onAddSource: vi.fn(),
    onRemoveSource: vi.fn(),
    onUpdateSourceType: vi.fn(),
    onUpdateSourceContent: vi.fn(),
    onParseSource: vi.fn(),
    onRemoveNode: vi.fn(),
    onRenameNode: vi.fn(),
  };
  const fullProps: React.ComponentProps<typeof NodeInputSection> = {
    expanded: true,
    sources: [source()],
    nodes: [],
    ...callbacks,
    ...props,
  };

  stateMock.enabled = true;
  stateMock.callIndex = 0;
  stateMock.overrides = stateOverrides;
  stateMock.setters = [];
  mocks.buttons = [];
  mocks.inputs = [];
  mocks.intrinsics = [];
  mocks.textareas = [];
  mocks.sectionHeaders = [];
  try {
    const html = renderToStaticMarkup(React.createElement(NodeInputSection, fullProps));
    return {
      html,
      callbacks,
      setters: stateMock.setters,
      buttons: mocks.buttons,
      inputs: mocks.inputs,
      intrinsics: mocks.intrinsics,
      textareas: mocks.textareas,
    };
  } finally {
    stateMock.enabled = false;
  }
}

function textOf(children: unknown): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (React.isValidElement(children)) return textOf((children.props as { children?: unknown }).children);
  return "";
}

function findIntrinsic(type: string, predicate: (props: any) => boolean) {
  const found = mocks.intrinsics.find((item: any) => item.type === type && predicate(item.props));
  expect(found).toBeTruthy();
  return found.props;
}

describe("NodeInputSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders only the section header when collapsed", () => {
    const { html } = renderSection({ expanded: false, sources: [source(), source({ id: "source-2", type: "yaml" })] });

    expect(html).toContain("节点导入");
    expect(html).toContain("2 个导入源");
    expect(html).not.toContain("添加订阅源");
  });

  it("renders subscription sources and dispatches source actions", () => {
    const { html, callbacks, buttons, textareas } = renderSection({
      sources: [
        source({ id: "url", type: "url", parsed: true, nodeCount: 3 }),
        source({ id: "yaml", type: "yaml", content: "proxies: []", error: "bad yaml" }),
      ],
    });

    expect(html).toContain("订阅链接 #1");
    expect(html).toContain("YAML 配置 #2");
    expect(html).toContain("✓ 3");
    expect(html).toContain("import-error");

    textareas[0].onChange({ target: { value: "https://new.example/sub" } });
    expect(callbacks.onUpdateSourceContent).toHaveBeenCalledWith("url", "https://new.example/sub");

    buttons[0].onClick();
    expect(callbacks.onAddSource).toHaveBeenCalled();

    findIntrinsic("button", (props) => props.title === "YAML 配置").onClick();
    expect(callbacks.onUpdateSourceType).toHaveBeenCalledWith("url", "yaml");

    findIntrinsic("button", (props) => props.title === "节点链接").onClick();
    expect(callbacks.onUpdateSourceType).toHaveBeenCalledWith("url", "nodes");

    findIntrinsic("button", (props) => props.title === "解析导入").onClick();
    expect(callbacks.onParseSource).toHaveBeenCalledWith("url");

    findIntrinsic("button", (props) => props.title === "删除").onClick();
    expect(callbacks.onRemoveSource).toHaveBeenCalledWith("url");
  });

  it("limits very large node lists and toggles show-all state", () => {
    const nodes = Array.from({ length: 201 }, (_, index) => node(`node-${index}`));
    const { html, buttons, setters } = renderSection({ nodes });

    expect(html).toContain("已导入节点");
    expect(html).toContain("仅显示前 200 个节点");
    expect(html).toContain("显示全部 (201)");

    const showAllButton = buttons.find((button) => String(button.children).includes("显示全部"));
    showAllButton.onClick();
    expect(setters[3]).toHaveBeenCalled();
    expect((setters[3] as any).lastValue).toBe(true);
  });

  it("renders search empty state without list limiting", () => {
    const { html, inputs, setters } = renderSection({ nodes: [node("Alpha"), node("Beta")] }, { 2: "missing" });

    expect(inputs[0]).toMatchObject({ value: "missing", placeholder: "搜索节点..." });
    inputs[0].onChange({ target: { value: "Alpha" } });
    expect(setters[2]).toHaveBeenCalledWith("Alpha");
    expect(html).toContain("未找到匹配节点");
    expect(html).not.toContain("仅显示前 200 个节点");
  });

  it("renders node edit mode and saves with Enter", () => {
    const { callbacks, html, setters } = renderSection({ nodes: [node("Old")] }, { 0: "Old", 1: "New" });

    expect(html).toContain('value="New"');
    expect(html).toContain("check");
    expect(html).toContain("x");

    const editInput = findIntrinsic("input", (props) => props.type === "text" && props.value === "New");
    editInput.onChange({ target: { value: "Next" } });
    expect(setters[1]).toHaveBeenCalledWith("Next");
    editInput.onKeyDown({ key: "Enter" });
    expect(callbacks.onRenameNode).toHaveBeenCalledWith("Old", "New");
    expect(setters[0]).toHaveBeenCalledWith(null);
    expect(setters[1]).toHaveBeenCalledWith("");

    const sameName = renderSection({ nodes: [node("Old")] }, { 0: "Old", 1: "Old" });
    findIntrinsic("button", (props) => typeof props.className === "string" && props.className.includes("text-success-foreground")).onClick();
    expect(sameName.callbacks.onRenameNode).not.toHaveBeenCalledWith("Old", "Old");

    const cancel = renderSection({ nodes: [node("Old")] }, { 0: "Old", 1: "New" });
    findIntrinsic("button", (props) => typeof props.className === "string" && props.className.includes("text-destructive-foreground")).onClick();
    expect(cancel.setters[0]).toHaveBeenCalledWith(null);
  });

  it("starts node editing and removes nodes from action buttons", () => {
    const { callbacks, setters } = renderSection({ nodes: [node("Alpha")] });

    findIntrinsic("button", (props) => props.title === "重命名").onClick();
    expect(setters[0]).toHaveBeenCalledWith("Alpha");
    expect(setters[1]).toHaveBeenCalledWith("Alpha");

    findIntrinsic("button", (props) => props.title === "删除").onClick();
    expect(callbacks.onRemoveNode).toHaveBeenCalledWith("Alpha");
  });
});
