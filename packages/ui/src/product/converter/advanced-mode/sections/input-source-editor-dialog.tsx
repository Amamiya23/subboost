"use client";

import * as Popover from "@subboost/ui/components/coss/compat/popover";
import { HelpCircle } from "lucide-react";
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@subboost/ui/components/coss/compat/dialog";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Switch } from "@subboost/ui/components/coss/compat/switch";
import { Textarea } from "@subboost/ui/components/coss/compat/textarea";
import { DEFAULT_NODE_NAME_TEMPLATE } from "@subboost/core/node-name-template";
import type { SubscriptionSource } from "@subboost/ui/store/config-store";
import { sourceTypeInfo } from "../constants";

type InputSourceEditorDialogProps = {
  source: SubscriptionSource | null;
  previewName: string;
  onClose: () => void;
  onUpdateContent: (id: string, content: string) => void;
  onUpdateMeta: (id: string, patch: Partial<SubscriptionSource>) => void;
};

export function InputSourceEditorDialog({
  source,
  previewName,
  onClose,
  onUpdateContent,
  onUpdateMeta,
}: InputSourceEditorDialogProps) {
  return (
    <Dialog
      open={Boolean(source)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {source ? `高级编辑：${sourceTypeInfo[source.type].label}` : "高级编辑"}
          </DialogTitle>
        </DialogHeader>

        {source && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">标签（tag）</div>
                <Input
                  value={source.tag ?? ""}
                  onChange={(e) => onUpdateMeta(source.id, { tag: e.target.value })}
                  placeholder="例如：A / 订阅1 / 自建1"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">节点命名模板</div>
                  <Input
                    value={source.nameTemplate ?? DEFAULT_NODE_NAME_TEMPLATE}
                    onChange={(e) => onUpdateMeta(source.id, { nameTemplate: e.target.value })}
                    className="text-xs font-mono"
                  />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">预览</div>
                <Input value={previewName} readOnly className="text-xs font-mono" />
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground">
              可用占位符：{"{tag}"}、{"{name}"}；留空则默认：{DEFAULT_NODE_NAME_TEMPLATE}
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">{sourceTypeInfo[source.type].label}</div>
              {source.type === "url" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Input
                      value={source.content}
                      onChange={(e) => onUpdateContent(source.id, e.target.value)}
                      placeholder={sourceTypeInfo[source.type].placeholder}
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
                        checked={Boolean(source.useProxyProviders)}
                        onCheckedChange={(checked) =>
                          onUpdateMeta(source.id, { useProxyProviders: Boolean(checked) })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">流量/到期信息 URL（可选）</div>
                      <Input
                        value={source.userinfoUrl ?? ""}
                        onChange={(e) => onUpdateMeta(source.id, { userinfoUrl: e.target.value })}
                        placeholder="留空则默认使用当前订阅源 URL"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">流量信息 User-Agent（可选）</div>
                      <Input
                        value={source.userinfoUserAgent ?? ""}
                        onChange={(e) => onUpdateMeta(source.id, { userinfoUserAgent: e.target.value })}
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
                  value={source.content}
                  onChange={(e) => onUpdateContent(source.id, e.target.value)}
                  placeholder={sourceTypeInfo[source.type].placeholder}
                  className="min-h-[60vh] text-xs font-mono"
                />
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            完成
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
