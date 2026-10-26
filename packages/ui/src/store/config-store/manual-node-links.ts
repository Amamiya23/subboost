import { parseSubscription } from "@subboost/core/parser";
import { buildNodeContentKey } from "@subboost/core/node-identity";
import { getNodeSourceIds } from "@subboost/core/subscription/node-source-state";
import type { ParsedNode } from "@subboost/core/types/node";
import type { SubscriptionSource } from "./definitions";

export function parseManualNodeLink(link: string): ParsedNode {
  const trimmed = link.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(trimmed)) {
    throw new Error("请输入一条完整的节点分享链接");
  }
  // HTTP proxies use an endpoint, whereas subscription URLs point to a resource.
  if (/^https?:\/\//i.test(trimmed)) {
    const endpoint = new URL(trimmed);
    if ((endpoint.pathname && endpoint.pathname !== "/") || (!endpoint.port && !endpoint.username)) {
      throw new Error("请填写节点分享链接；订阅地址请通过订阅导入添加");
    }
  }
  const result = parseSubscription(trimmed);
  if (result.errors.length || result.nodes.length !== 1) {
    throw new Error("节点链接无效，请检查协议和连接参数");
  }
  return result.nodes[0];
}

export type NodeShareLinkMatch = { sourceId: string; lineIndex: number; link: string };

export function findNodeShareLinks(node: ParsedNode, sources: SubscriptionSource[]): NodeShareLinkMatch[] {
  const sourceIds = getNodeSourceIds(node);
  const key = buildNodeContentKey(node);
  const matches: NodeShareLinkMatch[] = [];
  for (const source of sources) {
    if (source.type !== "nodes" || (sourceIds.length > 0 && !sourceIds.includes(source.id))) continue;
    source.content.split(/\r?\n/).forEach((line, lineIndex) => {
      try {
        if (buildNodeContentKey(parseManualNodeLink(line)) === key) {
          matches.push({ sourceId: source.id, lineIndex, link: line.trim() });
        }
      } catch {
        // Existing sources may contain comments or unsupported lines.
      }
    });
  }
  return matches;
}

export function getNodeShareLink(node: ParsedNode, sources: SubscriptionSource[]): string | null {
  return findNodeShareLinks(node, sources)[0]?.link ?? null;
}
