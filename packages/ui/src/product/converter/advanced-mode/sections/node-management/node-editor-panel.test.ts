import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedNode } from "@subboost/core/types/node";

const mocks = vi.hoisted(() => ({
  stateIndex: 0,
  stateValues: {} as Record<number, unknown>,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
  buttons: [] as Array<Record<string, any>>,
  textareas: [] as Array<Record<string, any>>,
  inputs: [] as Array<Record<string, any>>,
  addManualNodes: vi.fn(),
  updateManualNode: vi.fn(),
  getNodeShareLink: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = mocks.stateIndex++;
      const setter = vi.fn();
      mocks.setters[index] = setter;
      return [Object.hasOwn(mocks.stateValues, index) ? mocks.stateValues[index] : initial, setter];
    },
  };
});

vi.mock("@subboost/ui/components/coss/compat/button", () => ({
  Button: (props: Record<string, any>) => {
    mocks.buttons.push(props);
    return React.createElement("button", { type: props.type }, props.children);
  },
}));
vi.mock("@subboost/ui/components/coss/compat/input", () => ({
  Input: (props: Record<string, any>) => {
    mocks.inputs.push(props);
    return React.createElement("input", props);
  },
}));
vi.mock("@subboost/ui/components/coss/compat/textarea", () => ({
  Textarea: (props: Record<string, any>) => {
    mocks.textareas.push(props);
    return React.createElement("textarea", props);
  },
}));
vi.mock("@subboost/ui/store/config-store", () => ({
  useConfigStore: () => ({
    addManualNodes: mocks.addManualNodes,
    updateManualNode: mocks.updateManualNode,
  }),
}));
vi.mock("@subboost/ui/store/config-store/manual-node-links", () => ({
  getNodeShareLink: mocks.getNodeShareLink,
}));

import { NodeEditorPanel } from "./node-editor-panel";

const node = { name: "我的香港节点", type: "vless", server: "example.com", port: 443 } as ParsedNode;

function renderPanel(nodeValue: ParsedNode | null = null, onEditSource?: () => void) {
  const onClose = vi.fn();
  const html = renderToStaticMarkup(React.createElement(NodeEditorPanel, {
    node: nodeValue,
    sources: [],
    onClose,
    onEditSource,
  }));
  return { html, onClose };
}

function clickButton(label: string) {
  const button = mocks.buttons.find((item) => item.children === label);
  expect(button).toBeDefined();
  button!.onClick();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stateIndex = 0;
  mocks.stateValues = {};
  mocks.setters = [];
  mocks.buttons = [];
  mocks.inputs = [];
  mocks.textareas = [];
  mocks.addManualNodes.mockReturnValue(2);
  mocks.getNodeShareLink.mockReturnValue("vless://original");
});

describe("NodeEditorPanel", () => {
  it("adds multiline links without submitting an enclosing subscription form", () => {
    mocks.stateValues[1] = "vless://one\nss://two";
    const { html, onClose } = renderPanel();

    expect(html).toContain("每行一条分享链接");
    expect(html).not.toContain("<form");
    expect(mocks.buttons.every((button) => button.type === "button")).toBe(true);
    expect(mocks.inputs).toHaveLength(0);

    clickButton("添加节点");

    expect(mocks.addManualNodes).toHaveBeenCalledWith("vless://one\nss://two");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("updates the existing node with the changed link and its current custom name", () => {
    mocks.stateValues[1] = "vless://replacement";
    const { onClose } = renderPanel(node);

    expect(mocks.inputs[0].value).toBe(node.name);
    clickButton("应用修改");

    expect(mocks.updateManualNode).toHaveBeenCalledWith(node.name, {
      name: node.name,
      link: "vless://replacement",
    });
    expect(mocks.addManualNodes).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps an unchanged link out of a rename-only update", () => {
    mocks.stateValues[0] = "  香港新名称  ";
    renderPanel(node);
    clickButton("应用修改");

    expect(mocks.updateManualNode).toHaveBeenCalledWith(node.name, { name: "香港新名称" });
  });

  it("keeps the editor open and retains input after link validation fails", () => {
    mocks.stateValues[1] = "invalid-link";
    mocks.updateManualNode.mockImplementationOnce(() => { throw new Error("请输入有效的分享链接"); });
    const { onClose } = renderPanel(node);
    clickButton("应用修改");

    expect(mocks.setters[2]).toHaveBeenLastCalledWith("请输入有效的分享链接");
    expect(mocks.textareas[0].value).toBe("invalid-link");
    expect(mocks.setters[1]).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("preserves Enter for multiline input and applies with Control-Enter", () => {
    renderPanel();
    const preventDefault = vi.fn();
    mocks.textareas[0].onKeyDown({ key: "Enter", ctrlKey: false, metaKey: false, nativeEvent: {}, preventDefault });
    expect(mocks.addManualNodes).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();

    mocks.textareas[0].onKeyDown({ key: "Enter", ctrlKey: true, metaKey: false, nativeEvent: {}, preventDefault });
    expect(mocks.addManualNodes).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("offers source editing instead of an unrelated empty share-link field", () => {
    mocks.getNodeShareLink.mockReturnValue(null);
    const onEditSource = vi.fn();
    const { html } = renderPanel(node, onEditSource);

    expect(mocks.textareas).toHaveLength(0);
    expect(html).toContain("此节点的连接配置由来源维护。");
    clickButton("编辑来源");
    expect(onEditSource).toHaveBeenCalledOnce();
  });

  it("associates validation feedback with editable fields", () => {
    mocks.stateValues[2] = "请输入有效的分享链接";
    const { html } = renderPanel(node);

    expect(html).toContain('role="alert"');
    expect(mocks.inputs[0]["aria-describedby"]).toMatch(/-error$/);
    expect(mocks.textareas[0]["aria-describedby"]).toBe(mocks.inputs[0]["aria-describedby"]);
  });
});
