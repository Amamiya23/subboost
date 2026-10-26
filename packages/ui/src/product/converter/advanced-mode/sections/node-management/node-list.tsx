"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@subboost/ui/components/coss/compat/badge";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Switch } from "@subboost/ui/components/coss/compat/switch";
import { ProtocolBadge } from "@subboost/ui/components/ui/protocol-badge";
import { cn } from "@subboost/ui/lib/utils";
import type { ParsedNode } from "@subboost/core/types/node";
import { hasRealityConfig, REALITY_MLKEM_ENABLED_KEY } from "@subboost/core/mihomo/reality";

type NodeNameParts = {
  baseName: string;
  tag: string;
  template?: string;
  canEditBase: boolean;
};

type DeletedMarkedNode = { originName: string; name: string };

const ORIGIN_NAME_KEY = "_originName";
const NODE_LIST_HEIGHT_CLASS = "space-y-1 max-h-96 overflow-y-auto custom-scrollbar pr-1";

export function NodeManagementNodeList({
  nodes,
  deletedMarkedNodes,
  visibleNodes,
  visibleDeletedMarkedNodes,
  nodeSearchKeyword,
  resolveNodeNameParts,
  onEditNode,
  restoreNodeName,
  listenerPortDrafts,
  setListenerPortDrafts,
  listenerPorts,
  listenerPortErrors,
  setListenerPortErrors,
  commitListenerPort,
  orderDrafts,
  setOrderDrafts,
  nodeIndexByName,
  setNodeOrder,
  moveNode,
  isListenerPortVisible,
  removeNode,
  restoreDeletedNode,
  setNodeRealityMlkemEnabled,
}: {
  nodes: ParsedNode[];
  deletedMarkedNodes: DeletedMarkedNode[];
  visibleNodes: ParsedNode[];
  visibleDeletedMarkedNodes: DeletedMarkedNode[];
  nodeSearchKeyword: string;
  resolveNodeNameParts: (node: ParsedNode) => NodeNameParts;
  onEditNode: (node: ParsedNode) => void;
  restoreNodeName: (name: string) => void;
  listenerPortDrafts: Record<string, string>;
  setListenerPortDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  listenerPorts: Record<string, number>;
  listenerPortErrors: Record<string, string>;
  setListenerPortErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  commitListenerPort: (nodeName: string) => void;
  orderDrafts: Record<string, string>;
  setOrderDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  nodeIndexByName: Map<string, number>;
  setNodeOrder: (nodeName: string, order: number) => void;
  moveNode: (nodeName: string, direction: "up" | "down") => void;
  isListenerPortVisible: boolean;
  removeNode: (nodeName: string) => void;
  restoreDeletedNode: (originName: string) => void;
  setNodeRealityMlkemEnabled: (nodeName: string, enabled: boolean) => void;
}) {
  return (
    <>
          {nodes.length === 0 && deletedMarkedNodes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">暂无节点，点击「添加节点」粘贴分享链接</div>
          ) : nodeSearchKeyword.trim() && visibleNodes.length === 0 && visibleDeletedMarkedNodes.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">未找到匹配节点</div>
          ) : (
            <div className={NODE_LIST_HEIGHT_CLASS}>
              {visibleNodes.map((node) => {
                const parts = resolveNodeNameParts(node);
                const primaryTag = parts.canEditBase ? parts.tag : "";
                const record = node as unknown as Record<string, unknown>;
                const originName = typeof record[ORIGIN_NAME_KEY] === "string" && String(record[ORIGIN_NAME_KEY]).trim()
                  ? String(record[ORIGIN_NAME_KEY]).trim()
                  : "";
                const isRenamed = originName && originName !== parts.baseName;

                return (
                  <div
                    key={node.name}
                    className="space-y-1.5 text-xs bg-muted rounded px-2 py-1.5 group"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <ProtocolBadge type={node.type} node={node} />
                        <span className="flex-1 min-w-20 flex items-center gap-1">
                          {primaryTag && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-muted text-foreground/85 text-[10px] border border-border"
                              title={`来源标签：${primaryTag}`}
                            >
                              {primaryTag}
                            </span>
                          )}
                          <span className="text-foreground truncate" title={node.name}>
                            {parts.canEditBase ? parts.baseName : node.name}
                          </span>
                          {isRenamed && (
                            <button
                              type="button"
                              onClick={() => restoreNodeName(node.name)}
                              className="p-0.5 text-muted-foreground hover:text-warning-foreground transition-colors"
                              title={`恢复原名: ${originName}`}
                            >
                              <RotateCcw className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </span>
                        {isListenerPortVisible && (
                          <>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">监听端口:</span>
                            <Input
                              value={
                                Object.prototype.hasOwnProperty.call(listenerPortDrafts, node.name)
                                  ? listenerPortDrafts[node.name]
                                  : typeof listenerPorts[node.name] === "number"
                                    ? String(listenerPorts[node.name])
                                    : ""
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                setListenerPortDrafts((prev) => ({ ...prev, [node.name]: v }));
                                setListenerPortErrors((prev) => {
                                  if (!Object.prototype.hasOwnProperty.call(prev, node.name)) return prev;
                                  const { [node.name]: _removed, ...rest } = prev;
                                  return rest;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitListenerPort(node.name);
                                if (e.key === "Escape") {
                                  setListenerPortDrafts((prev) => {
                                    if (!Object.prototype.hasOwnProperty.call(prev, node.name)) return prev;
                                    const { [node.name]: _removed, ...rest } = prev;
                                    return rest;
                                  });
                                  setListenerPortErrors((prev) => {
                                    if (!Object.prototype.hasOwnProperty.call(prev, node.name)) return prev;
                                    const { [node.name]: _removed, ...rest } = prev;
                                    return rest;
                                  });
                                }
                              }}
                              onBlur={() => commitListenerPort(node.name)}
                              inputMode="numeric"
                              placeholder="-"
                              title={listenerPortErrors[node.name] || "为该节点生成 listeners（mixed）本地监听端口"}
                              className={cn(
                                "h-6 w-16 md:w-[4.5rem] text-[10px] bg-muted border-border text-center",
                                listenerPortErrors[node.name] && "border-destructive/30 focus:border-destructive/30"
                              )}
                            />
                          </>
                        )}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">顺序:</span>
                        <div className="flex items-center gap-0.5">
                          <Input
                            value={
                              Object.prototype.hasOwnProperty.call(orderDrafts, node.name)
                                ? orderDrafts[node.name]
                                : String((nodeIndexByName.get(node.name) ?? 0) + 1)
                            }
                            onChange={(e) => setOrderDrafts((prev) => ({ ...prev, [node.name]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = parseInt(orderDrafts[node.name] ?? "", 10);
                                if (Number.isFinite(val)) setNodeOrder(node.name, val);
                                setOrderDrafts((prev) => {
                                  const { [node.name]: _removed, ...rest } = prev;
                                  return rest;
                                });
                              }
                              if (e.key === "Escape") {
                                setOrderDrafts((prev) => {
                                  const { [node.name]: _removed, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }}
                            onBlur={() => {
                              const val = parseInt(orderDrafts[node.name] ?? "", 10);
                              if (Number.isFinite(val)) setNodeOrder(node.name, val);
                              setOrderDrafts((prev) => {
                                const { [node.name]: _removed, ...rest } = prev;
                                return rest;
                              });
                            }}
                            inputMode="numeric"
                            title="排序位置（1=最前）"
                            className="h-6 w-10 text-[10px] bg-muted border-border text-center px-1"
                          />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moveNode(node.name, "up")}
                              disabled={(nodeIndexByName.get(node.name) ?? 0) <= 0}
                              className="h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="上移"
                            >
                              <ChevronUp className="h-2.5 w-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveNode(node.name, "down")}
                              disabled={(nodeIndexByName.get(node.name) ?? 0) >= nodes.length - 1}
                              className="h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="下移"
                            >
                              <ChevronDown className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEditNode(node)}
                          className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-8"
                          title="编辑节点"
                          aria-label={`编辑节点：${node.name}`}
                        >
                          <Pencil className="h-3 w-3" />
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => removeNode(node.name)}
                          className="p-1 text-muted-foreground hover:text-destructive-foreground transition-colors"
                          title="删除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                    {hasRealityConfig(node) && (
                      <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5">
                        <span className="text-muted-foreground">ML-KEM 兼容</span>
                        <Switch
                          checked={record[REALITY_MLKEM_ENABLED_KEY] === true}
                          onCheckedChange={(checked) => setNodeRealityMlkemEnabled(node.name, checked)}
                          aria-label={`${node.name}：ML-KEM 兼容`}
                          title="仅为此节点启用 ML-KEM 和 Chrome 指纹；关闭后保留来源配置"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleDeletedMarkedNodes.length > 0 && (
                <details
                  className={cn(
                    "pt-2 mt-2 border-t border-border",
                    visibleNodes.length === 0 && "pt-0 mt-0 border-t-0"
                  )}
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                    已删除节点（{visibleDeletedMarkedNodes.length}）
                  </summary>
                  <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                    不会生成到配置；点击“恢复”可立即恢复。缺少来源信息时可能需要重新导入。
                  </p>
                  <div className="space-y-1">
                    {visibleDeletedMarkedNodes.map(({ originName, name }) => (
                      <div
                        key={`deleted:${originName}`}
                        className="flex items-center gap-2 text-xs bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5"
                      >
                        <span className="text-destructive-foreground text-[10px] w-4">DEL</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-muted-foreground line-through truncate" title={name}>
                            {name}
                          </div>
                          {originName !== name && (
                            <div className="text-[10px] text-muted-foreground truncate" title={`源名: ${originName}`}>
                              源名: {originName}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="h-5 px-2 text-[10px] font-medium border-destructive/30 bg-destructive/10 text-destructive-foreground"
                        >
                          已删除
                        </Badge>
                        <button
                          type="button"
                          onClick={() => restoreDeletedNode(originName)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="恢复"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
    </>
  );
}
