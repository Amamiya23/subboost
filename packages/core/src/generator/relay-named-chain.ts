import type { ParsedNode } from "../types/node";
import type { DialerProxyGroup } from "../types/template-config";

/** Validate before sanitizing references: a broken binding must never become a direct exit. */
export function validateRelayNamedChain(group: DialerProxyGroup, nodes: ParsedNode[], groups: DialerProxyGroup[]): string[] {
  if (!group.preserveRelayNames || group.enabled === false) return [];
  const errors: string[] = [];
  const names = new Set(nodes.map((node) => node.name));
  const relays = new Set(group.relayNodes);
  const targets = new Set(group.targetNodes);
  if (group.relayNodes.length === 0) errors.push("请选择至少一个中转节点");
  if (group.targetNodes.length !== 1) errors.push("保留入口名称模式必须选择一个落地节点");
  for (const name of [...relays, ...targets]) {
    if (!names.has(name) || ["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE"].includes(name)) {
      errors.push(`节点「${name}」不存在或不受支持，请重新绑定真实节点`);
    }
  }
  for (const name of relays) {
    if (targets.has(name)) errors.push(`节点「${name}」不能同时作为入口和落地`);
    if (groups.some((other) => other !== group && other.enabled !== false && (
      other.targetNodes.includes(name) || other.relayNodes.includes(name)
    ))) errors.push(`入口「${name}」已被其他中转组使用`);
  }
  for (const name of targets) {
    if (groups.some((other) => other !== group && other.enabled !== false && (
      other.relayNodes.includes(name) || (!other.preserveRelayNames && other.targetNodes.includes(name))
    ))) errors.push(`落地「${name}」与其他中转组存在冲突`);
  }
  return errors;
}

export function getRelayNamedSelectionNodes(nodes: ParsedNode[], groups: DialerProxyGroup[]): ParsedNode[] {
  const preserved = groups.filter((group) => group && group.enabled !== false && group.preserveRelayNames);
  const hiddenLandings = new Set(preserved.flatMap((group) => group.targetNodes));
  for (const group of preserved) {
    if (group.exposeLanding) for (const name of group.targetNodes) hiddenLandings.delete(name);
  }
  return nodes.filter((node) => !hiddenLandings.has(node.name));
}

/** Selection metadata belongs to the entrance; connection credentials belong to the landing. */
export function buildRelayNamedChains(
  nodes: ParsedNode[], groups: DialerProxyGroup[], reservedNames: Iterable<string> = []
): { outputNodes: ParsedNode[]; selectionNodes: ParsedNode[] } {
  const preserved = groups.filter((group) => group.enabled !== false && group.preserveRelayNames);
  for (const group of preserved) {
    const errors = validateRelayNamedChain(group, nodes, groups);
    if (errors.length) throw new Error(`中转组「${group.name}」：${errors.join("；")}`);
  }
  const byName = new Map(nodes.map((node) => [node.name, node]));
  const usedNames = new Set([...byName.keys(), ...reservedNames]);
  const replacements = new Map<string, ParsedNode>();
  const entrances: ParsedNode[] = [];
  for (const group of preserved) {
    const landing = byName.get(group.targetNodes[0])!;
    for (const relay of new Set(group.relayNodes)) {
      const entrance = byName.get(relay)!;
      const baseName = `__subboost_entry_${relay}`;
      let internalName = baseName;
      for (let suffix = 2; usedNames.has(internalName); suffix++) internalName = `${baseName} (${suffix})`;
      usedNames.add(internalName);
      // Imported control fields must not create an accidental extra hop.
      const { ["dialer-proxy"]: _dialer, dialer_proxy: _legacyDialer, ...connection } = entrance;
      entrances.push({ ...connection, name: internalName } as ParsedNode);
      replacements.set(relay, { ...landing, name: relay, "dialer-proxy": internalName } as ParsedNode);
    }
  }
  const selectionNodes = getRelayNamedSelectionNodes(nodes, groups);
  return {
    selectionNodes,
    outputNodes: [...selectionNodes.map((node) => replacements.get(node.name) ?? node), ...entrances],
  };
}
