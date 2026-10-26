import { buildNodeContentKey } from "@subboost/core/node-identity";
import { makeUniqueName, ORIGIN_NAME_KEY, SOURCE_IDS_KEY } from "@subboost/core/subscription/node-source-state";
import type { ParsedNode } from "@subboost/core/types/node";
import type { ConfigActions, SubscriptionSource } from "../definitions";
import { findNodeShareLinks, parseManualNodeLink } from "../manual-node-links";
import type { GetState, SetAndGenerateConfig, StoreState } from "../store-types";

type ManualNodeActions = Pick<ConfigActions, "addManualNodes" | "updateManualNode">;

function importedSource(source: SubscriptionSource, content: string, nodeCount: number): SubscriptionSource {
  return {
    ...source, content, lastParsedContent: content, nodeCount,
    parsed: true, parsing: false, error: undefined, errorInfo: undefined,
  };
}

function restoreExplicitNodes(state: StoreState, nodes: ParsedNode[]) {
  const origins = new Set(nodes.map((node) => String(node[ORIGIN_NAME_KEY] ?? node.name)));
  const keys = new Set(nodes.map((node) => buildNodeContentKey(node)));
  return {
    deletedNodeNames: state.deletedNodeNames.filter((name) => !origins.has(name)),
    deletedNodes: state.deletedNodes.filter((item) => item.node
      ? !keys.has(buildNodeContentKey(item.node))
      : !origins.has(item.originName)),
  };
}

export function createManualNodeActions(get: GetState, setAndGenerateConfig: SetAndGenerateConfig): ManualNodeActions {
  return {
    addManualNodes: (content) => {
      const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (!lines.length) throw new Error("请粘贴节点分享链接");
      const parsed = lines.map((link, index) => {
        try {
          return { link, node: parseManualNodeLink(link) };
        } catch (error) {
          throw new Error(`第 ${index + 1} 条链接：${error instanceof Error ? error.message : "节点链接无效"}`);
        }
      });
      const state = get();
      const seen = new Set(state.nodes.map((node) => buildNodeContentKey(node)));
      const additions = parsed.filter(({ node }) => {
        const key = buildNodeContentKey(node);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (!additions.length) throw new Error("这些节点已在列表中");
      const existingSource = state.sources.find((source) => source.type === "nodes" && !source.tag?.trim());
      const source: SubscriptionSource = existingSource ?? {
        id: crypto.randomUUID(), type: "nodes", content: "",
      };
      const usedNames = new Set(state.nodes.map((node) => node.name));
      const newNodes = additions.map(({ node }) => {
        const name = makeUniqueName(node.name, usedNames);
        usedNames.add(name);
        return { ...node, name, [ORIGIN_NAME_KEY]: node.name, [SOURCE_IDS_KEY]: [source.id] } as ParsedNode;
      });
      const sourceKeys = new Set<string>();
      for (const line of source.content.split(/\r?\n/)) {
        try { sourceKeys.add(buildNodeContentKey(parseManualNodeLink(line))); } catch { /* Keep existing source text. */ }
      }
      const addedLinks = additions.filter(({ node }) => !sourceKeys.has(buildNodeContentKey(node))).map(({ link }) => link);
      const nextContent = [source.content.trim(), ...addedLinks].filter(Boolean).join("\n");
      const nextSource = importedSource(source, nextContent, sourceKeys.size + addedLinks.length);
      setAndGenerateConfig(() => ({
        nodes: [...state.nodes, ...newNodes],
        ...restoreExplicitNodes(state, newNodes),
        sources: existingSource
          ? state.sources.filter((item) => item.id === source.id || item.content.trim()).map((item) => item.id === source.id ? nextSource : item)
          : [...state.sources.filter((item) => item.content.trim()), nextSource],
      }));
      return newNodes.length;
    },

    updateManualNode: (nodeName, patch) => {
      const state = get();
      const target = state.nodes.find((node) => node.name === nodeName);
      if (!target) throw new Error("未找到该节点，请重新打开编辑");
      const requestedName = patch.name.trim();
      if (!requestedName) throw new Error("请输入节点名称");
      const name = makeUniqueName(requestedName, new Set(state.nodes.filter((node) => node !== target).map((node) => node.name)));
      let nextNode: ParsedNode = { ...target, name, [ORIGIN_NAME_KEY]: target[ORIGIN_NAME_KEY] ?? target.name };
      let sources = state.sources;
      if (patch.link !== undefined) {
        const parsed = parseManualNodeLink(patch.link);
        const matches = findNodeShareLinks(target, state.sources);
        if (!matches.length) throw new Error("未找到该节点的原始分享链接，请通过来源编辑修改");
        if (state.nodes.some((node) => node !== target && buildNodeContentKey(node) === buildNodeContentKey(parsed))) {
          throw new Error("该链接对应的节点已在列表中");
        }
        const metadata = Object.fromEntries(Object.entries(target).filter(([key]) => key.startsWith("_")));
        nextNode = { ...parsed, ...metadata, name, [ORIGIN_NAME_KEY]: parsed.name } as ParsedNode;
        sources = state.sources.map((source) => {
          const lineIndices = new Set(matches.filter((match) => match.sourceId === source.id).map((match) => match.lineIndex));
          if (!lineIndices.size) return source;
          const newline = source.content.includes("\r\n") ? "\r\n" : "\n";
          const content = source.content.split(/\r?\n/).map((line, index) => lineIndices.has(index) ? patch.link!.trim() : line).join(newline);
          return importedSource(source, content, source.nodeCount ?? state.nodes.filter((node) => (node[SOURCE_IDS_KEY] as string[] | undefined)?.includes(source.id)).length);
        });
      }
      const replaceName = (names: string[]) => Array.from(new Set(names.map((item) => item === nodeName ? name : item)));
      const listenerPorts = { ...state.listenerPorts };
      if (nodeName !== name && typeof listenerPorts[nodeName] === "number") {
        listenerPorts[name] = listenerPorts[nodeName];
        delete listenerPorts[nodeName];
      }
      setAndGenerateConfig(() => ({
        nodes: state.nodes.map((node) => node === target ? nextNode : node),
        ...restoreExplicitNodes(state, [nextNode]),
        sources,
        listenerPorts,
        dialerProxyGroups: state.dialerProxyGroups.map((group) => ({
          ...group, relayNodes: replaceName(group.relayNodes), targetNodes: replaceName(group.targetNodes),
        })),
      }));
    },
  };
}
