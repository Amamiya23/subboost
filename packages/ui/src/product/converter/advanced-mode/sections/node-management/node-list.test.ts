import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedNode } from "@subboost/core/types/node";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  Check: () => React.createElement("span", null, "Check"),
  ChevronDown: () => React.createElement("span", null, "ChevronDown"),
  ChevronUp: () => React.createElement("span", null, "ChevronUp"),
  Pencil: () => React.createElement("span", null, "Pencil"),
  RotateCcw: () => React.createElement("span", null, "RotateCcw"),
  Trash2: () => React.createElement("span", null, "Trash2"),
  X: () => React.createElement("span", null, "X"),
}));
vi.mock("@subboost/ui/components/coss/compat/badge", () => ({
  Badge: (props: any) => React.createElement("span", props, props.children),
}));
vi.mock("@subboost/ui/components/coss/compat/input", () => ({
  Input: (props: any) => React.createElement("input", props),
}));
vi.mock("@subboost/ui/components/coss/compat/switch", () => ({
  Switch: (props: any) => React.createElement("button", { role: "switch", "aria-label": props["aria-label"], "aria-checked": props.checked }),
}));
vi.mock("@subboost/ui/components/ui/protocol-badge", () => ({
  ProtocolBadge: (props: any) => React.createElement("span", null, `protocol:${props.type}`),
}));
vi.mock("@subboost/ui/components/coss/compat/toaster", () => ({ toast: mocks.toast }));
vi.mock("@subboost/core/node-name-template", () => ({
  formatNodeNameFromTemplate: ({ originName, tag }: { originName: string; tag: string }) => `[${tag}] ${originName}`,
}));
vi.mock("@subboost/ui/lib/utils", () => ({ cn: (...parts: unknown[]) => parts.filter(Boolean).join(" ") }));

import { NodeManagementNodeList } from "./node-list";

const alpha = {
  name: "[HK] Alpha",
  type: "ss",
  server: "alpha.test",
  port: 443,
  cipher: "aes-128-gcm",
  password: "secret",
  _originName: "Original Alpha",
} as ParsedNode;

const beta = {
  name: "[LOCK] Beta",
  type: "vless",
  server: "beta.test",
  port: 8443,
  uuid: "00000000-0000-4000-8000-000000000000",
  _originName: "Beta",
} as ParsedNode;

function collectElements(
  node: React.ReactNode,
  predicate: (element: React.ReactElement<Record<string, any>>) => boolean,
  out: Array<React.ReactElement<Record<string, any>>> = [],
) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    const element = child as React.ReactElement<Record<string, any>>;
    if (predicate(element)) out.push(element);
    collectElements((element.props as { children?: React.ReactNode }).children, predicate, out);
  });
  return out;
}

function collectInputs(node: React.ReactNode) {
  return collectElements(node, (element) => {
    const props = element.props as Record<string, unknown>;
    return typeof element.type !== "string" && "value" in props && typeof props.onChange === "function";
  });
}

function callSetter<T>(initial: T) {
  return vi.fn((next: React.SetStateAction<T>) => (typeof next === "function" ? (next as (prev: T) => T)(initial) : next));
}

function makeProps(overrides: Partial<React.ComponentProps<typeof NodeManagementNodeList>> = {}) {
  return {
    nodes: [alpha, beta],
    deletedMarkedNodes: [{ originName: "Deleted", name: "[HK] Deleted" }],
    visibleNodes: [alpha, beta],
    visibleDeletedMarkedNodes: [{ originName: "Deleted", name: "[HK] Deleted" }],
    nodeSearchKeyword: "",
    resolveNodeNameParts: vi.fn((node: ParsedNode) =>
      node.name === alpha.name
        ? { baseName: "Alpha", tag: "HK", template: "[{tag}] {name}", canEditBase: true }
        : { baseName: "Beta", tag: "LOCK", template: "[{tag}]", canEditBase: false }
    ),
    onEditNode: vi.fn(),
    restoreNodeName: vi.fn(),
    listenerPortDrafts: { [alpha.name]: "7001" },
    setListenerPortDrafts: callSetter<Record<string, string>>({ [alpha.name]: "7001" }),
    listenerPorts: { [alpha.name]: 7891, [beta.name]: 7892 },
    listenerPortErrors: { [alpha.name]: "端口冲突" },
    setListenerPortErrors: callSetter<Record<string, string>>({ [alpha.name]: "端口冲突" }),
    commitListenerPort: vi.fn(),
    orderDrafts: { [alpha.name]: "2" },
    setOrderDrafts: callSetter<Record<string, string>>({ [alpha.name]: "2" }),
    nodeIndexByName: new Map([
      [alpha.name, 0],
      [beta.name, 1],
    ]),
    setNodeOrder: vi.fn(),
    moveNode: vi.fn(),
    isListenerPortVisible: true,
    removeNode: vi.fn(),
    restoreDeletedNode: vi.fn(),
    setNodeRealityMlkemEnabled: vi.fn(),
    ...overrides,
  };
}

function renderTree(props: React.ComponentProps<typeof NodeManagementNodeList>) {
  return NodeManagementNodeList(props);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NodeManagementNodeList", () => {
  it("offers independent switches only for REALITY nodes", () => {
    const selected = { ...beta, name: "New REALITY", "reality-opts": { "public-key": "key" }, _realityMlkemEnabled: true };
    const old = { ...beta, name: "Old REALITY", "reality-opts": { "public-key": "old-key" } };
    const props = makeProps({ nodes: [selected, old, alpha], visibleNodes: [selected, old, alpha] });
    const switches = collectElements(renderTree(props), (element) => typeof element.props.onCheckedChange === "function");
    expect(switches).toHaveLength(2);
    expect(switches[0].props.checked).toBe(true);
    expect(switches[1].props.checked).toBe(false);
    expect(switches[0].props["aria-label"]).toBe("New REALITY：ML-KEM 兼容");
    switches[0].props.onCheckedChange(false);
    switches[1].props.onCheckedChange(true);
    expect(props.setNodeRealityMlkemEnabled.mock.calls).toEqual([["New REALITY", false], ["Old REALITY", true]]);
  });

  it("renders empty and search-empty states", () => {
    expect(
      renderToStaticMarkup(
        React.createElement(NodeManagementNodeList, {
          ...makeProps({
            nodes: [],
            deletedMarkedNodes: [],
            visibleNodes: [],
            visibleDeletedMarkedNodes: [],
          }),
        })
      )
    ).toContain("添加节点");

    expect(
      renderToStaticMarkup(
        React.createElement(NodeManagementNodeList, {
          ...makeProps({
            visibleNodes: [],
            visibleDeletedMarkedNodes: [],
            nodeSearchKeyword: "hk",
          }),
        })
      )
    ).toContain("未找到匹配节点");
  });

  it("renders active, renamed, listener-port, order, and deleted-node rows", () => {
    const html = renderToStaticMarkup(React.createElement(NodeManagementNodeList, makeProps()));

    expect(html).toContain("protocol:ss");
    expect(html).toContain("Alpha");
    expect(html).toContain("监听端口:");
    expect(html).toContain("顺序:");
    expect(html).toContain("已删除节点");
    expect(html).toContain("源名: Deleted");
  });

  it("handles list actions for editing, listener ports, ordering, delete, and restore", () => {
    const props = makeProps();
    const tree = renderTree(props);
    const buttons = collectElements(tree, (element) => element.type === "button");
    const inputs = collectInputs(tree);

    buttons.find((button) => button.props.title === "恢复原名: Original Alpha")?.props.onClick();
    expect(props.restoreNodeName).toHaveBeenCalledWith(alpha.name);

    const editButtons = buttons.filter((button) => button.props.title === "编辑节点");
    expect(editButtons).toHaveLength(2);
    editButtons[0].props.onClick();
    editButtons[1].props.onClick();
    expect(props.onEditNode.mock.calls).toEqual([[alpha], [beta]]);

    const listenerInput = inputs[0];
    listenerInput.props.onChange({ target: { value: "7002" } });
    listenerInput.props.onKeyDown({ key: "Enter" });
    listenerInput.props.onKeyDown({ key: "Escape" });
    listenerInput.props.onBlur();
    expect(props.commitListenerPort).toHaveBeenCalledWith(alpha.name);
    expect(props.setListenerPortDrafts).toHaveBeenCalled();
    expect(props.setListenerPortErrors).toHaveBeenCalled();

    const orderInput = inputs[1];
    orderInput.props.onChange({ target: { value: "2" } });
    orderInput.props.onKeyDown({ key: "Enter" });
    orderInput.props.onKeyDown({ key: "Escape" });
    orderInput.props.onBlur();
    expect(props.setNodeOrder).toHaveBeenCalledWith(alpha.name, 2);
    expect(props.setOrderDrafts).toHaveBeenCalled();

    buttons.find((button) => button.props.title === "上移")?.props.onClick();
    buttons.find((button) => button.props.title === "下移")?.props.onClick();
    expect(props.moveNode).toHaveBeenCalledWith(alpha.name, "up");
    expect(props.moveNode).toHaveBeenCalledWith(alpha.name, "down");

    buttons.find((button) => button.props.title === "删除")?.props.onClick();
    expect(props.removeNode).toHaveBeenCalledWith(alpha.name);

    buttons.find((button) => button.props.title === "恢复")?.props.onClick();
    expect(props.restoreDeletedNode).toHaveBeenCalledWith("Deleted");
  });

  it("offers one explicit edit action per node without showing an inline rename field", () => {
    const props = makeProps({ isListenerPortVisible: false });
    const tree = renderTree(props);
    const buttons = collectElements(tree, (element) => element.type === "button");
    expect(buttons.filter((button) => button.props.title === "编辑节点")).toHaveLength(2);
    expect(collectInputs(tree).every((input) => input.props.inputMode === "numeric")).toBe(true);
    expect(renderToStaticMarkup(React.createElement(NodeManagementNodeList, props))).toContain("编辑");
  });
});
