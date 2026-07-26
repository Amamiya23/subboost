"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  Link2,
  FileCode,
  Server,
  Check,
  Loader2,
  Pencil,
  X,
  Search,
} from "lucide-react";
import { Button } from "@subboost/ui/components/ui/button";
import { Input } from "@subboost/ui/components/ui/input";
import { Textarea } from "@subboost/ui/components/ui/textarea";
import { Badge } from "@subboost/ui/components/ui/badge";
import { cn } from "@subboost/ui/lib/utils";
import { SectionHeader } from "./section-header";
import type { SubscriptionSource, SourceType } from "@subboost/ui/store/config-store";
import type { ParsedNode } from "@subboost/core/types/node";
import { SubscriptionImportErrorBadge } from "@subboost/ui/product/converter/subscription-import-error";

const sourceTypeInfo: Record<
  SourceType,
  { label: string; icon: typeof Link2; placeholder: string }
> = {
  url: {
    label: "订阅链接",
    icon: Link2,
    placeholder: "https://example.com/sub?token=xxx",
  },
  yaml: {
    label: "YAML 配置",
    icon: FileCode,
    placeholder: "proxies:\n  - name: 节点名称\n    type: vmess\n    ...",
  },
  nodes: {
    label: "节点链接",
    icon: Server,
    placeholder:
      "ss://...\nssr://...\nvmess://...\nvless://...\ntrojan://...\nanytls://...\nhysteria2://... / hy2://...\ntuic://...\n(socks5://... / socks4://...)",
  },
};

interface NodeInputSectionProps {
  expanded: boolean;
  onToggle: () => void;
  sources: SubscriptionSource[];
  nodes: ParsedNode[];
  onAddSource: () => void;
  onRemoveSource: (id: string) => void;
  onUpdateSourceType: (id: string, type: SourceType) => void;
  onUpdateSourceContent: (id: string, content: string) => void;
  onParseSource: (id: string) => void;
  onRemoveNode: (name: string) => void;
  onRenameNode: (oldName: string, newName: string) => void;
}

export function NodeInputSection({
  expanded,
  onToggle,
  sources,
  nodes,
  onAddSource,
  onRemoveSource,
  onUpdateSourceType,
  onUpdateSourceContent,
  onParseSource,
  onRemoveNode,
  onRenameNode,
}: NodeInputSectionProps) {
  const [editingNodeName, setEditingNodeName] = React.useState<string | null>(null);
  const [editNodeValue, setEditNodeValue] = React.useState("");
  const [nodeSearch, setNodeSearch] = React.useState("");
  const [showAllNodes, setShowAllNodes] = React.useState(false);

  const NODE_RENDER_LIMIT = 200;
  const normalizedSearch = nodeSearch.trim().toLowerCase();

  const filteredNodes = React.useMemo(() => {
    if (!normalizedSearch) return nodes;
    return nodes.filter((n) => n.name.toLowerCase().includes(normalizedSearch));
  }, [nodes, normalizedSearch]);

  const shouldLimit = !showAllNodes && !normalizedSearch && filteredNodes.length > NODE_RENDER_LIMIT;
  const displayedNodes = shouldLimit ? filteredNodes.slice(0, NODE_RENDER_LIMIT) : filteredNodes;

  const handleStartEdit = (name: string) => {
    setEditingNodeName(name);
    setEditNodeValue(name);
  };

  const handleSaveEdit = (oldName: string) => {
    if (editNodeValue.trim() && editNodeValue !== oldName) {
      onRenameNode(oldName, editNodeValue.trim());
    }
    setEditingNodeName(null);
    setEditNodeValue("");
  };

  const handleCancelEdit = () => {
    setEditingNodeName(null);
    setEditNodeValue("");
  };

  const sourceCount = sources.length;

  return (
    <div>
      <SectionHeader
        expanded={expanded}
        onToggle={onToggle}
        icon={Server}
        title="节点导入"
        badge={
          sourceCount > 0 && (
            <Badge variant="outline" className="ml-auto border-blue-500/50 bg-blue-500/10 text-blue-300">
              {sourceCount} 个导入源
            </Badge>
          )
        }
      />
      {expanded && (
        <div className="mt-2 space-y-2 pl-6">
          {sources.map((source, index) => {
            const typeInfo = sourceTypeInfo[source.type];
            return (
              <div key={source.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {(Object.keys(sourceTypeInfo) as SourceType[]).map(
                        (type) => {
                          const info = sourceTypeInfo[type];
                          const Icon = info.icon;
                          return (
                            <button
                              key={type}
                              onClick={() => onUpdateSourceType(source.id, type)}
                              className={cn(
                                "p-1 rounded transition-colors",
                                source.type === type
                                  ? "bg-white/12 text-white/65"
                                  : "text-white/30 hover:text-white/50 hover:bg-white/5"
                              )}
                              title={info.label}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </button>
                          );
                        }
                      )}
                    </div>
                    <span className="text-xs text-white/50">
                      {typeInfo.label} {sources.length > 1 && `#${index + 1}`}
                    </span>
                    {source.parsed && source.nodeCount !== undefined && (
                      <span className="text-xs text-green-400">
                        ✓ {source.nodeCount}
                      </span>
                    )}
                    {(source.errorInfo || source.error) && (
                      <SubscriptionImportErrorBadge errorInfo={source.errorInfo} errorMessage={source.error} />
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onParseSource(source.id)}
                      disabled={!source.content.trim() || source.parsing}
                      className={cn(
                        "p-1 rounded transition-colors",
                        source.parsing
                          ? "text-white/65"
                          : source.parsed
                          ? "text-green-400 hover:text-green-300"
                          : source.content.trim()
                          ? "text-white/30 hover:text-white/65 hover:bg-white/8"
                          : "text-white/10 cursor-not-allowed"
                      )}
                      title="解析导入"
                    >
                      {source.parsing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : source.parsed ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {sources.length > 1 && (
                      <button
                        onClick={() => onRemoveSource(source.id)}
                        className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <Textarea
                  value={source.content}
                  onChange={(e) =>
                    onUpdateSourceContent(source.id, e.target.value)
                  }
                  placeholder={typeInfo.placeholder}
                  className={cn(
                    "min-h-[60px] max-h-[120px] text-xs font-mono resize-y",
                    source.type === "url" && "min-h-[36px] max-h-[36px]"
                  )}
                />
              </div>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={onAddSource}
            className="w-full text-xs h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            添加订阅源
          </Button>

          {/* 已导入节点列表 */}
          {nodes.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <div className="text-xs text-white/40 mb-1.5">已导入节点</div>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                  <Input
                    value={nodeSearch}
                    onChange={(e) => setNodeSearch(e.target.value)}
                    placeholder="搜索节点..."
                    className="h-8 pl-7 text-xs"
                  />
                </div>
                {nodes.length > NODE_RENDER_LIMIT && !normalizedSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-white/60 hover:text-white"
                    onClick={() => setShowAllNodes((v) => !v)}
                    title={showAllNodes ? "仅显示部分节点" : "显示全部节点"}
                  >
                    {showAllNodes ? "收起" : `显示全部 (${nodes.length})`}
                  </Button>
                )}
              </div>

              {!normalizedSearch && shouldLimit && (
                <div className="text-[10px] text-white/40 mb-1">
                  为避免卡顿，仅显示前 {NODE_RENDER_LIMIT} 个节点；可用搜索查看其它节点
                </div>
              )}

              <div className="flex flex-wrap gap-1 max-h-[150px] overflow-y-auto">
                {displayedNodes.map((node) => (
                  <div
                    key={node.name}
                    className="group flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 text-xs"
                  >
                    {editingNodeName === node.name ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editNodeValue}
                          onChange={(e) => setEditNodeValue(e.target.value)}
                          className="w-20 px-1 py-0.5 bg-white/5 border border-white/20 rounded text-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(node.name);
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                        />
                        <button
                          onClick={() => handleSaveEdit(node.name)}
                          className="p-0.5 text-green-400 hover:bg-green-500/20 rounded"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-0.5 text-red-400 hover:bg-red-500/20 rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-white/70 truncate max-w-[100px]">
                          {node.name}
                        </span>
                        <button
                          onClick={() => handleStartEdit(node.name)}
                          className="p-0.5 opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/65 transition-opacity"
                          title="重命名"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={() => onRemoveNode(node.name)}
                          className="p-0.5 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-opacity"
                          title="删除"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {displayedNodes.length === 0 && (
                  <div className="text-[10px] text-white/40 py-1">未找到匹配节点</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
