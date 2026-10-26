"use client";

import * as React from "react";
import type { ParsedNode } from "@subboost/core/types/node";
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Textarea } from "@subboost/ui/components/coss/compat/textarea";
import { useConfigStore, type SubscriptionSource } from "@subboost/ui/store/config-store";
import { getNodeShareLink } from "@subboost/ui/store/config-store/manual-node-links";

type NodeEditorPanelProps = {
  node: ParsedNode | null;
  sources: SubscriptionSource[];
  onClose: () => void;
  onEditSource?: () => void;
};

export function NodeEditorPanel(props: NodeEditorPanelProps) {
  return <NodeEditorForm key={props.node?.name ?? "new"} {...props} />;
}

function NodeEditorForm({ node, sources, onClose, onEditSource }: NodeEditorPanelProps) {
  const { addManualNodes, updateManualNode } = useConfigStore();
  const originalLink = React.useMemo(() => node ? getNodeShareLink(node, sources) : null, [node, sources]);
  const canEditLink = !node || originalLink !== null;
  const [name, setName] = React.useState(node?.name ?? "");
  const [link, setLink] = React.useState(originalLink ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const fieldId = React.useId();

  const applyChanges = () => {
    setError(null);
    try {
      if (node) {
        if (!name.trim()) throw new Error("请输入节点名称");
        updateManualNode(node.name, {
          name: name.trim(),
          ...(canEditLink && link !== originalLink ? { link } : {}),
        });
      } else {
        addManualNodes(link);
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试");
    }
  };

  return (
    <section
      aria-labelledby={`${fieldId}-title`}
      className="space-y-4 rounded-md border border-border bg-background p-3 sm:p-4"
    >
      <h3 id={`${fieldId}-title`} className="text-sm font-medium text-foreground">
        {node ? "编辑节点" : "添加节点"}
      </h3>

      {node && (
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-name`} className="text-xs text-muted-foreground">
            节点名称
          </label>
          <Input
            id={`${fieldId}-name`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                applyChanges();
              }
            }}
            autoFocus={!canEditLink}
            autoComplete="off"
            aria-describedby={error ? `${fieldId}-error` : undefined}
          />
        </div>
      )}

      {canEditLink ? (
        <div className="space-y-1.5">
          <label htmlFor={`${fieldId}-link`} className="text-xs text-muted-foreground">
            分享链接
          </label>
          <Textarea
            id={`${fieldId}-link`}
            value={link}
            onChange={(event) => {
              setLink(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
                event.preventDefault();
                applyChanges();
              }
            }}
            placeholder={node ? "vless://…" : "vless://…\nss://…"}
            rows={node ? 3 : 5}
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby={error ? `${fieldId}-error` : !node ? `${fieldId}-hint` : undefined}
            className="resize-y break-all text-xs"
          />
          {!node && (
            <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
              每行一条分享链接
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>此节点的连接配置由来源维护。</span>
          {onEditSource && (
            <Button type="button" variant="outline" size="sm" onClick={onEditSource}>
              编辑来源
            </Button>
          )}
        </div>
      )}

      {error && (
        <p id={`${fieldId}-error`} role="alert" className="break-words text-xs text-destructive-foreground">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button type="button" size="sm" onClick={applyChanges}>
          {node ? "应用修改" : "添加节点"}
        </Button>
      </div>
    </section>
  );
}
