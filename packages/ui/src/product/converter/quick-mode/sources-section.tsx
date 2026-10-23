import * as Popover from "@subboost/ui/components/coss/compat/popover";
import { Plus, X, AlertCircle, Check, Loader2, Maximize2, HelpCircle, Menu, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Textarea } from "@subboost/ui/components/coss/compat/textarea";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Badge } from "@subboost/ui/components/coss/compat/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@subboost/ui/components/coss/compat/dialog";
import { Switch } from "@subboost/ui/components/coss/compat/switch";
import { cn } from "@subboost/ui/lib/utils";
import { DEFAULT_NODE_NAME_TEMPLATE } from "@subboost/core/node-name-template";
import type { SourceType } from "@subboost/ui/store/config-store";
import { SubscriptionImportErrorBadge } from "@subboost/ui/product/converter/subscription-import-error";
import { getSubscriptionUserInfoDisplay } from "@subboost/ui/product/subscription/subscription-userinfo-display";
import { buildSourceDisplayLabel } from "@subboost/ui/product/converter/source-display-label";
import { useSubscriptionSourcesController } from "@subboost/ui/product/converter/use-subscription-sources-controller";
import { sourceTypeInfo } from "./constants";

export function SourcesSection() {
  const {
    addSource,
    closeExpandedSourceEditor,
    error,
    expandedSource,
    expandedSourcePreviewName,
    handleImportSource,
    moveSource,
    nodeCount,
    nodesBySourceId,
    removeSource,
    setExpandedSourceId,
    setShowAddMenu,
    showAddMenu,
    sources,
    updateSource,
    updateSourceMeta,
    updateSourceType,
  } = useSubscriptionSourcesController({ mode: "quick" });

  return (
    <>
      {/* Sources List */}
      <div className="flex flex-col gap-5">
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
              {/* Source Header */}
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

              {/* Source Input */}
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
                  className={cn(
                    "source-editor-input resize-y",
                    sources.length === 1 ? "flex-1 min-h-[100px]" : "min-h-[140px] md:min-h-[180px] xl:min-h-[80px]"
                  )}
                />
              )}
            </div>
          );
        })}

        {/* Add Source Button */}
        <div className="relative flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-11 sm:h-9 text-sm border-dashed border-bone/15 text-ink-700 hover:text-bone hover:border-bone/30"
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-medium text-foreground">{info.label}</div>
                      <div className="text-[10px] text-muted-foreground">{info.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Status */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive-foreground flex-shrink-0">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}
        {nodeCount > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="success">{nodeCount} 个节点已解析</Badge>
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(expandedSource)}
        onOpenChange={(open) => {
          if (!open) closeExpandedSourceEditor();
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{expandedSource ? `高级编辑：${sourceTypeInfo[expandedSource.type].label}` : "高级编辑"}</DialogTitle>
          </DialogHeader>

          {expandedSource && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">标签（tag）</div>
                  <Input
                    value={expandedSource.tag ?? ""}
                    onChange={(e) => updateSourceMeta(expandedSource.id, { tag: e.target.value })}
                    placeholder="例如：A / 订阅1 / 自建1"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">节点命名模板</div>
                  <Input
                    value={expandedSource.nameTemplate ?? DEFAULT_NODE_NAME_TEMPLATE}
                    onChange={(e) => updateSourceMeta(expandedSource.id, { nameTemplate: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">预览</div>
                  <Input value={expandedSourcePreviewName} readOnly className="text-xs font-mono" />
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground">
                可用占位符：{"{tag}"}、{"{name}"}；留空则默认：{DEFAULT_NODE_NAME_TEMPLATE}
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{sourceTypeInfo[expandedSource.type].label}</div>
                {expandedSource.type === "url" ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Input
                        value={expandedSource.content}
                        onChange={(e) => updateSource(expandedSource.id, e.target.value)}
                        placeholder={sourceTypeInfo[expandedSource.type].placeholder}
                        className="text-xs min-w-0 flex-1"
                      />

                      <div className="flex h-10 flex-none items-center gap-2 rounded-md border border-border bg-muted px-3">
                        <div className="text-xs text-muted-foreground whitespace-nowrap">proxy-providers模式</div>
                        <Popover.Root>
                          <Popover.Trigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                              aria-label="proxy-providers 模式说明"
                              title="proxy-providers 模式说明"
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content
                              side="bottom"
                              align="end"
                              sideOffset={8}
                              className="z-50 w-[360px] rounded-md border border-border bg-background/88 backdrop-blur-md shadow-2xl p-3"
                            >
                              <div className="space-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <HelpCircle className="h-4 w-4 text-warning-foreground" />
                                  <div className="text-foreground font-medium">proxy-providers 模式</div>
                                </div>
                                <div className="text-muted-foreground leading-relaxed">
                                  部分订阅限制 CN IP 导入，url 无法在 SubBoost 内拉取解析。开启后 SubBoost
                                  不再拉取/解析该 url，而是在最终配置中写入{" "}
                                  <span className="font-mono">proxy-providers</span>，交由客户端自行拉取节点。
                                </div>
                                <div className="pt-2 border-t border-border text-muted-foreground space-y-1">
                                  <div className="font-medium text-foreground/85">注意开启后：</div>
                                  <ul className="ml-4 list-disc space-y-1">
                                    <li>无法在预览中查看/管理该 url 的节点</li>
                                    <li>无法将这些节点用于中转代理组、分流组高级模式等高级功能</li>
                                    <li>节点命名模板与 tag 在该模式下不生效</li>
                                  </ul>
                                </div>
                                <div className="pt-2 border-t border-border text-[10px] text-muted-foreground">
                                  若导入 url 报“未解析到有效节点/获取失败”等，可尝试开启此模式。
                                </div>
                              </div>
                              <Popover.Arrow className="fill-white/10" />
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                        <Switch
                          checked={Boolean(expandedSource.useProxyProviders)}
                          onCheckedChange={(checked) =>
                            updateSourceMeta(expandedSource.id, { useProxyProviders: Boolean(checked) })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">流量/到期信息 URL（可选）</div>
                        <Input
                          value={expandedSource.userinfoUrl ?? ""}
                          onChange={(e) => updateSourceMeta(expandedSource.id, { userinfoUrl: e.target.value })}
                          placeholder="留空则默认使用当前订阅源 URL"
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">流量信息 User-Agent（可选）</div>
                        <Input
                          value={expandedSource.userinfoUserAgent ?? ""}
                          onChange={(e) =>
                            updateSourceMeta(expandedSource.id, { userinfoUserAgent: e.target.value })
                          }
                          placeholder="例如 clash.meta/v1.19.16"
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      有些订阅源不会直接返回 <span className="font-mono">subscription-userinfo</span>，但会提供独立的流量接口。
                      设置后，SubBoost 会在导入/刷新时额外抓取该接口，用来更新这个源自己的流量与到期快照。
                    </div>
                  </div>
                ) : (
                  <Textarea
                    value={expandedSource.content}
                    onChange={(e) => updateSource(expandedSource.id, e.target.value)}
                    placeholder={sourceTypeInfo[expandedSource.type].placeholder}
                    className="min-h-[60vh] text-xs font-mono"
                  />
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeExpandedSourceEditor}>
              完成
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
