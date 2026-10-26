import { describe, expect, it } from "vitest";
import { parseSubscription } from "@subboost/core/parser";
import { initialState } from "../definitions";
import { getNodeShareLink } from "../manual-node-links";
import type { StoreState } from "../store-types";
import { createManualNodeActions } from "./manual-node-actions";
import { createSourceActions } from "../source-actions";
import { createNodeActions } from "./node-actions";

const link = (server = "hk.example.com", name = "Hong Kong") =>
  `vless://00000000-0000-4000-8000-000000000001@${server}:443?encryption=none&security=tls#${encodeURIComponent(name)}`;

function harness(overrides: Partial<StoreState> = {}) {
  let state = { ...structuredClone(initialState), ...overrides } as StoreState;
  const set = (patch: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  };
  const actions = {
    ...createManualNodeActions(() => state, set),
    ...createSourceActions(set, () => state, set),
    ...createNodeActions(set, () => state, set),
  };
  return { actions, getState: () => state };
}

describe("manual node actions", () => {
  it("adds multiple share links to a shared source and reuses it for later additions", () => {
    const h = harness();
    expect(h.actions.addManualNodes(`${link()}\n${link("jp.example.com", "Japan")}`)).toBe(2);
    h.actions.addManualNodes(link("sg.example.com", "Singapore"));
    const state = h.getState();
    expect(state.sources).toHaveLength(1);
    expect(state.sources[0]).toMatchObject({ type: "nodes", parsed: true, nodeCount: 3 });
    expect(state.nodes.map((node) => node.name)).toEqual(["Hong Kong", "Japan", "Singapore"]);
    expect(getNodeShareLink(state.nodes[1], state.sources)).toBe(link("jp.example.com", "Japan"));
  });

  it("validates the entire batch before changing state", () => {
    const h = harness();
    const before = h.getState();
    expect(() => h.actions.addManualNodes(`${link()}\ninvalid-link`)).toThrow("第 2 条链接");
    expect(h.getState()).toBe(before);
    expect(() => h.actions.addManualNodes("https://airport.example.com/sub?token=secret")).toThrow("订阅地址");
    expect(() => h.actions.addManualNodes("proxies: []")).toThrow("分享链接");
  });

  it("allows a deleted node to be added again without duplicate source lines or deletion markers", async () => {
    const h = harness();
    h.actions.addManualNodes(link());
    h.actions.removeNode("Hong Kong");
    h.actions.addManualNodes(link());
    expect(h.getState().sources[0].content).toBe(link());
    expect(h.getState().deletedNodes).toEqual([]);
    expect(h.getState().deletedNodeNames).toEqual([]);
    await h.actions.parseSingleSource(h.getState().sources[0].id);
    expect(h.getState().nodes).toHaveLength(1);
  });

  it("deduplicates additions and gives distinct endpoints unique display names", () => {
    const h = harness();
    h.actions.addManualNodes(`${link()}\n${link()}\n${link("other.example.com")}`);
    expect(h.getState().nodes.map((node) => node.name)).toEqual(["Hong Kong", "Hong Kong (2)"]);
    expect(() => h.actions.addManualNodes(link())).toThrow("已在列表中");
    expect(h.getState().nodes).toHaveLength(2);
  });

  it("replaces one original link in place and preserves names, order and node settings", async () => {
    const h = harness();
    h.actions.addManualNodes(`${link()}\n${link("jp.example.com", "Japan")}`);
    const first = h.getState().nodes[0];
    const sourceId = h.getState().sources[0].id;
    const configured = harness({
      ...h.getState(),
      nodes: [{ ...first, name: "My Hong Kong", _realityMlkemEnabled: true }, h.getState().nodes[1]],
      listenerPorts: { "My Hong Kong": 1081 },
      dialerProxyGroups: [{ id: "chain", name: "Chain", relayNodes: ["My Hong Kong"], targetNodes: ["Japan"] }],
    });
    const replacement = link("new-hk.example.com", "New Origin");
    configured.actions.updateManualNode("My Hong Kong", { name: "My Hong Kong", link: replacement });
    let state = configured.getState();
    expect(state.nodes.map((node) => node.name)).toEqual(["My Hong Kong", "Japan"]);
    expect(state.nodes[0]).toMatchObject({ server: "new-hk.example.com", _originName: "New Origin", _realityMlkemEnabled: true });
    expect(state.listenerPorts).toEqual({ "My Hong Kong": 1081 });
    expect(state.dialerProxyGroups[0].relayNodes).toEqual(["My Hong Kong"]);
    expect(state.sources[0].content).toBe(`${replacement}\n${link("jp.example.com", "Japan")}`);
    expect(getNodeShareLink(state.nodes[0], state.sources)).toBe(replacement);
    await configured.actions.parseSingleSource(sourceId);
    state = configured.getState();
    expect(state.nodes.map((node) => node.name)).toEqual(["My Hong Kong", "Japan"]);
    expect(state.nodes.some((node) => node.server === "hk.example.com")).toBe(false);
  });

  it("renames the node and updates listener and dialer references in one change", () => {
    const node = parseSubscription(link()).nodes[0];
    const h = harness({
      nodes: [node], listenerPorts: { "Hong Kong": 1081 },
      dialerProxyGroups: [{ id: "chain", name: "Chain", relayNodes: ["Hong Kong", "DIRECT"], targetNodes: ["Hong Kong"] }],
    });
    h.actions.updateManualNode("Hong Kong", { name: "Home" });
    expect(h.getState().nodes[0].name).toBe("Home");
    expect(h.getState().listenerPorts).toEqual({ Home: 1081 });
    expect(h.getState().dialerProxyGroups[0]).toMatchObject({ relayNodes: ["Home", "DIRECT"], targetNodes: ["Home"] });
  });

  it("does not change nodes or source content when an edit is invalid", () => {
    const h = harness();
    h.actions.addManualNodes(link());
    const before = h.getState();
    expect(() => h.actions.updateManualNode("Hong Kong", { name: "Changed", link: "invalid" })).toThrow();
    expect(h.getState()).toBe(before);
    expect(() => h.actions.updateManualNode("Hong Kong", { name: "Changed", link: `${link()}\n${link("other.example.com")}` })).toThrow();
    expect(h.getState()).toBe(before);
  });

  it("finds the original link for a renamed legacy node and preserves other source lines", () => {
    const original = link();
    const node = { ...parseSubscription(original).nodes[0], name: "Custom Name", _originName: "Hong Kong", _sourceIds: ["legacy"] };
    const h = harness({
      nodes: [node], sources: [{ id: "legacy", type: "nodes", content: `\r\n${original}\r\n${link("jp.example.com", "Japan")}\r\n` }],
    });
    expect(getNodeShareLink(node, h.getState().sources)).toBe(original);
    h.actions.updateManualNode("Custom Name", { name: "Custom Name", link: link("new.example.com") });
    expect(h.getState().sources[0].content).toBe(`\r\n${link("new.example.com")}\r\n${link("jp.example.com", "Japan")}\r\n`);
  });
});
