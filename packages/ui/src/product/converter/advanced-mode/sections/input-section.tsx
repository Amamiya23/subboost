"use client";

import * as Popover from "@subboost/ui/components/coss/compat/popover";
import { AlertCircle, Check, HelpCircle, Loader2, Maximize2, Plus, Server, X, Menu, ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@subboost/ui/components/coss/compat/badge";
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Textarea } from "@subboost/ui/components/coss/compat/textarea";
import { cn } from "@subboost/ui/lib/utils";
import type { SourceType } from "@subboost/ui/store/config-store";
import { getSubscriptionUserInfoDisplay } from "@subboost/ui/product/subscription/subscription-userinfo-display";
import { buildSourceDisplayLabel } from "@subboost/ui/product/converter/source-display-label";
import { useSubscriptionSourcesController } from "@subboost/ui/product/converter/use-subscription-sources-controller";
import { sourceTypeInfo } from "../constants";
import { SectionHeader } from "../section-header";
import { SubscriptionImportErrorBadge } from "@subboost/ui/product/converter/subscription-import-error";
import { InputSourceEditorDialog } from "./input-source-editor-dialog";

export function InputSection({
  isExpanded,
  onToggle,
  title = "节点导入",
}: {
  isExpanded: boolean;
  onToggle: () => void;
  title?: string;
}) {
  const {
    addSource,
    closeExpandedSourceEditor,
    error: globalError,
    expandedSource,
    expandedSourcePreviewName,
    handleImportSource,
    moveSource,
    nodesBySourceId,
    removeSource,
    setExpandedSourceId,
    setShowAddMenu,
    showAddMenu,
    sources,
    updateSource,
    updateSourceMeta,
    updateSourceType,
  } = useSubscriptionSourcesController({ mode: "advanced" });
  const sourceCount = sources.length;

  return (
    <div>
      <SectionHeader
        icon={Server}
        title={title}
        isExpanded={isExpanded}
        onToggle={onToggle}
        badge={
          sourceCount > 0 && (
            <Badge variant="outline" className="ml-auto border-bone/10 bg-bone/5 text-ink-700 tabular-nums">
              {sourceCount} 个导入源
            </Badge>
          )
        }
      />

      {isExpanded && (
        <div className="mt-4 space-y-5 sm:pl-6">
          {sources.map((source, index) => {
            const typeInfo = sourceTypeInfo[source.type];
            const sourceDisplayLabel = buildSourceDisplayLabel({
              typeLabel: typeInfo.label,
              tag: source.tag,
              order: index + 1,
              total: sources.length,
            });
            const sourceNodes = nodesBySourceId.get(source.id) ?? [];
            const userInfoDisplay = getSubscriptionUserInfoDisplay(source.subscriptionUserInfo, sourceNodes);
            const hasUserInfoDisplay = Boolean(userInfoDisplay && (userInfoDisplay.traffic || userInfoDisplay.expire));
            return (
              <div key={source.id} className="source-editor">
                <div className="source-editor-header">
                  <div className="source-editor-heading">
                    <div className="source-type-picker">
                      {(Object.keys(sourceTypeInfo) as SourceType[]).map((type) => {
                        const info = sourceTypeInfo[type];
                        const Icon = info.icon;
                        return (
                          <button
                            key={type}
                            onClick={() => updateSourceType(source.id, type)}
                            className={cn(
                              "source-type-button",
                              source.type === type
                                ? "bg-muted text-muted-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent"
                            )}
                            title={info.label}
                            aria-label={info.label}
                            aria-pressed={source.type === type}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        );
                      })}
                    </div>
                    <span className="source-editor-label">
                      {sourceDisplayLabel}
                    </span>
                    {source.parsed && source.nodeCount !== undefined && (
                      <Popover.Root>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success-foreground transition-colors hover:bg-success/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background whitespace-nowrap"
                            title="查看流量/到期"
                            aria-label="查看流量/到期"
                          >
                            ✓ {source.nodeCount} 节点
                            <Menu className="h-3 w-3 text-success-foreground" aria-hidden="true" />
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            side="bottom"
                            align="start"
                            sideOffset={8}
                            className="z-50 w-[260px] rounded-md border border-border bg-background/88 backdrop-blur-md shadow-2xl p-3"
                          >
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center gap-2">
                                <HelpCircle className="h-4 w-4 text-success-foreground" />
                                <div className="text-foreground font-medium">订阅信息</div>
                              </div>
                              {hasUserInfoDisplay && userInfoDisplay ? (
                                <div className="space-y-1 text-muted-foreground">
                                  {userInfoDisplay.traffic ? <div>已用流量：{userInfoDisplay.traffic}</div> : null}
                                  {userInfoDisplay.expire ? <div>到期时间：{userInfoDisplay.expire}</div> : null}
                                </div>
                              ) : (
                                <div className="text-muted-foreground leading-relaxed">暂无已用流量/到期时间信息</div>
                              )}
                            </div>
                            <Popover.Arrow className="fill-white/10" />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    )}
                    {(source.errorInfo || source.error) && (
                      <SubscriptionImportErrorBadge errorInfo={source.errorInfo} errorMessage={source.error} />
                    )}
                  </div>
                  <div className="source-editor-actions">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveSource(source.id, "up")}
                        disabled={index <= 0}
                        className="source-icon-button"
                        title="上移"
                        aria-label="上移"
                      >
                        <ChevronUp className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => moveSource(source.id, "down")}
                        disabled={index >= sources.length - 1}
                        className="source-icon-button"
                        title="下移"
                        aria-label="下移"
                      >
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => setExpandedSourceId(source.id)}
                      className="source-icon-button"
                      title="高级编辑"
                      aria-label="高级编辑"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                    {/* 导入按钮 */}
                    <button
                      onClick={() => void handleImportSource(source.id)}
                      disabled={!source.content.trim() || source.parsing}
                      className="inline-flex h-11 sm:h-8 shrink-0 items-center gap-1.5 rounded border border-border px-3 text-xs text-foreground/85 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed"
                      title={source.parsing ? "导入中..." : source.parsed ? "重新导入" : "导入此源"}
                    >
                      {source.parsing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {source.parsing ? "导入中…" : source.parsed ? "重新导入" : "导入"}
                    </button>
                    {/* 删除按钮 */}
                    {sources.length > 1 && (
                      <button
                        onClick={() => removeSource(source.id)}
                        className="source-icon-button hover:text-destructive-foreground"
                        title="删除"
                        aria-label="删除来源"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {source.type === "url" ? (
                  <Input
                    aria-label={sourceDisplayLabel}
                    value={source.content}
                    onChange={(e) => updateSource(source.id, e.target.value)}
                    placeholder={typeInfo.placeholder}
                    className="source-editor-input h-11 sm:h-10"
                  />
                ) : (
                  <Textarea
                    aria-label={sourceDisplayLabel}
                    value={source.content}
                    onChange={(e) => updateSource(source.id, e.target.value)}
                    placeholder={typeInfo.placeholder}
                    className="source-editor-input resize-y min-h-[100px]"
                  />
                )}
              </div>
            );
          })}
          {globalError && (
            <div className="flex items-center gap-2 text-xs text-destructive-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="break-all">{globalError}</span>
            </div>
          )}
          {/* Add Source Button with Menu */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-11 sm:h-9 text-sm border-dashed border-bone/15 text-ink-700 hover:text-bone hover:border-bone/30"
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加订阅/节点源
            </Button>

            {showAddMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-10 overflow-hidden">
                {(Object.keys(sourceTypeInfo) as SourceType[]).map((type) => {
                  const info = sourceTypeInfo[type];
                  const Icon = info.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => addSource(type)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-xs font-medium text-foreground">{info.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <InputSourceEditorDialog
        source={expandedSource}
        previewName={expandedSourcePreviewName}
        onClose={closeExpandedSourceEditor}
        onUpdateContent={updateSource}
        onUpdateMeta={updateSourceMeta}
      />
    </div>
  );
}
