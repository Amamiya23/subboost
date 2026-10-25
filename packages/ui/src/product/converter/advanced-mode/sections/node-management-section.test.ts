import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captures: {} as Record<string, any>,
  store: {} as Record<string, any>,
  interactions: {
    listenerPortConfigured: vi.fn(),
  },
  confirmDialog: vi.fn(),
  toast: vi.fn(),
}));

const stateMock = vi.hoisted(() => ({
  enabled: false,
  callIndex: 0,
  overrides: {} as Record<number, unknown>,
  runEffects: false,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void), deps?: React.DependencyList) => {
      if (!stateMock.runEffects) return actual.useEffect(effect, deps);
      return effect();
    },
    useState: (initial: unknown) => {
      if (!stateMock.enabled) return actual.useState(initial);
      const index = stateMock.callIndex++;
      const value = Object.prototype.hasOwnProperty.call(stateMock.overrides, index) ? stateMock.overrides[index] : initial;
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

vi.mock("lucide-react", () => ({
  List: () => null,
  Search: () => null,
}));
vi.mock("@subboost/ui/components/coss/compat/badge", () => ({ Badge: () => null }));
vi.mock("@subboost/ui/components/coss/compat/button", () => ({
  Button: (props: any) => {
    mocks.captures.button = props;
    return null;
  },
}));
vi.mock("@subboost/ui/components/ui/confirm-dialog", () => ({ confirmDialog: mocks.confirmDialog }));
vi.mock("@subboost/ui/components/coss/compat/input", () => ({
  Input: (props: any) => {
    mocks.captures.input = props;
    return null;
  },
}));
vi.mock("@subboost/ui/components/coss/compat/switch", () => ({
  Switch: (props: any) => {
    mocks.captures.switch = props;
    return null;
  },
}));
vi.mock("@subboost/ui/components/coss/compat/toaster", () => ({ toast: mocks.toast }));
vi.mock("@subboost/core/node-name-template", () => ({ DEFAULT_NODE_NAME_TEMPLATE: "[{tag}] {name}" }));
vi.mock("@subboost/ui/store/config-store", () => ({ useConfigStore: () => mocks.store }));
vi.mock("@subboost/ui/product/interactions", () => ({ useProductInteractionAdapter: () => mocks.interactions }));
vi.mock("../section-header", () => ({
  SectionHeader: (props: any) => {
    mocks.captures.header = props;
    return null;
  },
}));
vi.mock("./node-management/bulk-edit-dialog", () => ({
  NodeManagementBulkEditDialog: (props: any) => {
    mocks.captures.bulkDialog = props;
    return null;
  },
}));
vi.mock("./node-management/node-list", () => ({
  NodeManagementNodeList: (props: any) => {
    mocks.captures.nodeList = props;
    return null;
  },
}));

import { NodeManagementSection } from "./node-management-section";

const nodes = [
  {
    name: "[HK] Alpha",
    type: "ss",
    server: "alpha.test",
    port: 443,
    _sourceIds: ["s1", " s1 ", "", "s2"],
    _originName: "Alpha",
  },
  {
    name: "Beta",
    type: "vless",
    server: "beta.test",
    port: 8443,
    _sourceIds: ["missing"],
    _originName: "Beta",
  },
];

function renderSection(overrides: Record<number, unknown> = {}, props = { isExpanded: true, onToggle: vi.fn() }) {
  stateMock.enabled = true;
  stateMock.callIndex = 0;
  stateMock.overrides = overrides;
  stateMock.setters = [];
  try {
    const html = renderToStaticMarkup(React.createElement(NodeManagementSection, props));
    return { html, setters: stateMock.setters, props };
  } finally {
    stateMock.enabled = false;
  }
}

describe("NodeManagementSection", () => {
  it("forwards the per-node REALITY action without rendering a global switch", () => {
    const setNodeRealityMlkemEnabled = vi.fn();
    mocks.store.setNodeRealityMlkemEnabled = setNodeRealityMlkemEnabled;
    const { html } = renderSection();
    expect(html).not.toContain("REALITY ML-KEM 兼容");
    expect(mocks.captures.nodeList.setNodeRealityMlkemEnabled).toBe(setNodeRealityMlkemEnabled);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.captures = {};
    mocks.confirmDialog.mockResolvedValue(true);
    stateMock.runEffects = false;
    mocks.store = {
      sources: [
        {
          id: "s1",
          tag: "HK",
          lastParsedTag: "HK",
          nameTemplate: "[{tag}] {name}",
          lastParsedNameTemplate: "[{tag}] {name}",
        },
        {
          id: "s2",
          tag: "JP",
          nameTemplate: "{tag}-{name}",
        },
      ],
      nodes,
      deletedNodeNames: [" Gone ", "Deleted", ""],
      deletedNodes: [
        { originName: "Deleted", name: "[HK] Deleted" },
        { originName: "Alpha", name: "[HK] Alpha" },
        null,
      ],
      removeNode: vi.fn(),
      restoreDeletedNode: vi.fn(),
      renameNode: vi.fn(),
      restoreNodeName: vi.fn(),
      bulkRenameNodes: vi.fn(),
      moveNode: vi.fn(),
      setNodeOrder: vi.fn(),
      listenerPorts: { "[HK] Alpha": 7891, Beta: 7892 },
      setListenerPort: vi.fn(),
      bulkSetListenerPorts: vi.fn(),
    };
  });

  it("summarizes active, deleted, and searched nodes for child sections", () => {
    renderSection({ 3: "gone" });

    expect(mocks.captures.header).toEqual(
      expect.objectContaining({
        title: "节点管理",
        isExpanded: true,
      })
    );
    expect(mocks.captures.input).toEqual(expect.objectContaining({ value: "gone", disabled: false }));
    expect(mocks.captures.nodeList.visibleNodes).toEqual([]);
    expect(mocks.captures.nodeList.visibleDeletedMarkedNodes).toEqual([{ originName: "Gone", name: "Gone" }]);
    expect(mocks.captures.nodeList.nodeIndexByName.get("[HK] Alpha")).toBe(0);
    expect(mocks.captures.nodeList.nodeIndexByName.get("Beta")).toBe(1);
  });

  it("resolves source tags, base names, duplicates, and deleted origin rows", () => {
    renderSection();

    expect(mocks.captures.nodeList.deletedMarkedNodes).toEqual([
      { originName: "Deleted", name: "[HK] Deleted" },
      { originName: "Gone", name: "Gone" },
    ]);

    expect(mocks.captures.nodeList.resolveNodeNameParts(nodes[0])).toEqual({
      tags: ["HK", "JP"],
      tag: "HK",
      template: "[{tag}] {name}",
      baseName: "Alpha",
      canEditBase: true,
    });
    expect(mocks.captures.nodeList.resolveNodeNameParts(nodes[1])).toEqual({
      tags: [],
      tag: "",
      template: undefined,
      baseName: "Beta",
      canEditBase: true,
    });

    mocks.store.sources = [{ id: "s3", tag: "NO", nameTemplate: "literal", lastParsedNameTemplate: "literal" }];
    mocks.store.nodes = [{ name: "NO", _sourceIds: ["s3"] }];
    renderSection();
    expect(mocks.captures.nodeList.resolveNodeNameParts(mocks.store.nodes[0])).toEqual(
      expect.objectContaining({
        tag: "NO",
        baseName: "NO",
        canEditBase: false,
      })
    );
  });

  it("protects listener-port enabling and validates listener-port commits", async () => {
    const { setters } = renderSection();

    await mocks.captures.switch.onCheckedChange(false);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "已有监听端口配置", variant: "warning" }));

    await mocks.captures.switch.onCheckedChange(true);
    expect(mocks.confirmDialog).toHaveBeenCalledWith(expect.objectContaining({ confirmText: "我已了解，开启" }));
    expect(setters[4]).toHaveBeenCalledWith(true);

    renderSection({ 5: { Beta: "" } });
    mocks.captures.nodeList.commitListenerPort("Beta");
    expect(mocks.store.setListenerPort).toHaveBeenCalledWith("Beta", null);

    renderSection({ 5: { Beta: "70000" } });
    mocks.captures.nodeList.commitListenerPort("Beta");
    expect(stateMock.setters[6]).toHaveBeenCalledWith(expect.any(Function));

    renderSection({ 5: { Beta: "7891" } });
    mocks.captures.nodeList.commitListenerPort("Beta");
    expect(stateMock.setters[6]).toHaveBeenCalledWith(expect.any(Function));

    renderSection({ 5: { Beta: "7893" }, 6: { Beta: "old" } });
    mocks.captures.nodeList.commitListenerPort("Beta");
    expect(mocks.store.setListenerPort).toHaveBeenCalledWith("Beta", 7893);
    expect(mocks.interactions.listenerPortConfigured).toHaveBeenCalledWith({ mode: "advanced" });

    mocks.store.listenerPorts = {};
    renderSection({ 5: {}, 6: {} });
    mocks.captures.nodeList.commitListenerPort("NoPort");
    expect(mocks.store.setListenerPort).toHaveBeenCalledWith("NoPort", null);

    mocks.captures.bulkDialog.onClearListenerPortUiState([" Beta ", "Beta", "", "[HK] Alpha"]);
    expect(stateMock.setters[5]).toHaveBeenCalledWith(expect.any(Function));
    expect(stateMock.setters[6]).toHaveBeenCalledWith(expect.any(Function));
  });

  it("covers listener-port warning storage and switch edge cases", async () => {
    stateMock.runEffects = true;
    let result = renderSection();
    expect(result.setters[4]).toHaveBeenCalledWith(true);
    stateMock.runEffects = false;

    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => "1"),
        setItem: vi.fn(),
      },
    });
    result = renderSection();
    await mocks.captures.switch.onCheckedChange(true);
    expect(mocks.confirmDialog).not.toHaveBeenCalled();
    expect(result.setters[4]).toHaveBeenCalledWith(true);

    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => {
          throw new Error("read denied");
        }),
        setItem: vi.fn(() => {
          throw new Error("write denied");
        }),
      },
    });
    result = renderSection();
    await mocks.captures.switch.onCheckedChange(true);
    expect(mocks.confirmDialog).toHaveBeenCalled();
    expect(result.setters[4]).toHaveBeenCalledWith(true);

    mocks.confirmDialog.mockResolvedValueOnce(false);
    result = renderSection();
    await mocks.captures.switch.onCheckedChange(true);
    expect(result.setters[4]).not.toHaveBeenCalledWith(true);

    mocks.store.listenerPorts = { Beta: 70000 };
    result = renderSection({ 4: true, 5: { Beta: "7890" }, 6: { Beta: "bad" } });
    await mocks.captures.switch.onCheckedChange(false);
    expect(result.setters[4]).toHaveBeenCalledWith(false);
    expect(result.setters[5]).toHaveBeenCalledWith({});
    expect(result.setters[6]).toHaveBeenCalledWith({});
  });

  it("covers search, bulk dialog opening, and extra name parsing edges", () => {
    const { setters } = renderSection();

    mocks.captures.input.onChange({ target: { value: "alpha" } });
    expect(setters[3]).toHaveBeenCalledWith("alpha");
    mocks.captures.button.onClick();
    expect(setters[2]).toHaveBeenCalledWith(true);

    expect(mocks.captures.nodeList.resolveNodeNameParts(null)).toEqual({
      tags: [],
      tag: "",
      template: undefined,
      baseName: "",
      canEditBase: true,
    });
    expect(mocks.captures.nodeList.resolveNodeNameParts({ name: "Gamma", _sourceIds: "s1" })).toEqual({
      tags: [],
      tag: "",
      template: undefined,
      baseName: "Gamma",
      canEditBase: true,
    });

    mocks.store.sources = [
      {
        id: "s3",
        tag: "Current",
        lastParsedTag: "Old",
        nameTemplate: "{tag}:{name}",
        lastParsedNameTemplate: "",
      },
    ];
    mocks.store.nodes = [{ name: "Current:Delta", _sourceIds: [123, "s3", "s3"] }];
    renderSection();
    expect(mocks.captures.nodeList.resolveNodeNameParts(mocks.store.nodes[0])).toEqual({
      tags: ["Current"],
      tag: "Current",
      template: "{tag}:{name}",
      baseName: "Delta",
      canEditBase: true,
    });

    mocks.store.sources = [{ id: "s4", tag: "HK" }];
    mocks.store.nodes = [{ name: "[HK] Default", _sourceIds: ["s4"] }];
    renderSection();
    expect(mocks.captures.nodeList.resolveNodeNameParts(mocks.store.nodes[0])).toEqual({
      tags: ["HK"],
      tag: "HK",
      template: undefined,
      baseName: "Default",
      canEditBase: true,
    });

    mocks.store.nodes = [{ name: "[HK]", _sourceIds: ["s4"] }];
    renderSection();
    expect(mocks.captures.nodeList.resolveNodeNameParts(mocks.store.nodes[0])).toEqual({
      tags: ["HK"],
      tag: "HK",
      template: undefined,
      baseName: "[HK]",
      canEditBase: false,
    });

    mocks.store.sources = [{ id: "s5", tag: 123 }];
    mocks.store.nodes = [{ name: "Numeric Tag", _sourceIds: ["s5"] }];
    renderSection();
    expect(mocks.captures.nodeList.resolveNodeNameParts(mocks.store.nodes[0])).toEqual({
      tags: [],
      tag: "",
      template: undefined,
      baseName: "Numeric Tag",
      canEditBase: true,
    });
  });

  it("ignores empty listener-port cleanup requests and keeps unchanged cleanup state", () => {
    renderSection({ 5: { Beta: "7890" }, 6: { Beta: "bad" } });

    mocks.captures.bulkDialog.onClearListenerPortUiState([]);
    mocks.captures.bulkDialog.onClearListenerPortUiState(["", "  "]);
    expect(stateMock.setters[5]).not.toHaveBeenCalled();
    expect(stateMock.setters[6]).not.toHaveBeenCalled();

    mocks.captures.bulkDialog.onClearListenerPortUiState(["Unknown"]);
    const unchangedDrafts = stateMock.setters[5].mock.calls.at(-1)?.[0]({ Beta: "7890" });
    const unchangedErrors = stateMock.setters[6].mock.calls.at(-1)?.[0]({ Beta: "bad" });
    expect(unchangedDrafts).toEqual({ Beta: "7890" });
    expect(unchangedErrors).toEqual({ Beta: "bad" });
  });

  it("renders the collapsed and empty states without node-list children", () => {
    renderSection({}, { isExpanded: false, onToggle: vi.fn() });
    expect(mocks.captures.nodeList).toBeUndefined();

    mocks.store.nodes = [];
    mocks.store.deletedNodeNames = [];
    mocks.store.deletedNodes = [];
    mocks.store.listenerPorts = {};
    renderSection();
    expect(mocks.captures.input).toEqual(expect.objectContaining({ disabled: true }));
    expect(mocks.captures.switch).toEqual(expect.objectContaining({ disabled: true, checked: false }));
  });
});
