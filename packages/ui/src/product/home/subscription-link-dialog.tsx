"use client";

import type * as React from "react";
import { Check, Copy, Link as LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Label } from "@subboost/ui/components/coss/compat/label";
import { Switch } from "@subboost/ui/components/coss/compat/switch";
import { SmartNodeMatchingHelp } from "@subboost/ui/components/subscription/smart-node-matching-help";
import { SubscriptionQrCode } from "@subboost/ui/components/subscription/subscription-qr-code";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@subboost/ui/components/coss/compat/dialog";
import {
  getAutoUpdateIntervalPolicyMinLabel,
  type AutoUpdateIntervalPolicy,
} from "@subboost/core/subscription/auto-update-interval";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionUrl: string;
  subscriptionName: string;
  setSubscriptionName: (value: string) => void;
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (value: boolean) => void;
  autoUpdateHours: number;
  setAutoUpdateHours: (value: number) => void;
  autoUpdatePolicy: AutoUpdateIntervalPolicy;
  smartNodeMatchingEnabled: boolean;
  setSmartNodeMatchingEnabled: (value: boolean) => void;
  isCreatingSubscription: boolean;
  copied: boolean;
  isEditingExistingSubscription: boolean;
  handleCopyUrl: () => void;
  handleCreateSubscription: () => void;
};

export function SubscriptionLinkDialog({
  open,
  onOpenChange,
  subscriptionUrl,
  subscriptionName,
  setSubscriptionName,
  autoUpdateEnabled,
  setAutoUpdateEnabled,
  autoUpdateHours,
  setAutoUpdateHours,
  autoUpdatePolicy,
  smartNodeMatchingEnabled,
  setSmartNodeMatchingEnabled,
  isCreatingSubscription,
  copied,
  isEditingExistingSubscription,
  handleCopyUrl,
  handleCreateSubscription,
}: Props) {
  const close = () => onOpenChange(false);
  const minAutoUpdateLabel = getAutoUpdateIntervalPolicyMinLabel(autoUpdatePolicy);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-muted-foreground" />
            {subscriptionUrl
              ? (isEditingExistingSubscription ? "订阅链接已更新" : "订阅链接已生成")
              : (isEditingExistingSubscription ? "保存订阅配置" : "生成订阅链接")}
          </DialogTitle>
          <DialogDescription>
            {subscriptionUrl
              ? "复制链接或使用其他设备的客户端扫码导入"
              : isEditingExistingSubscription
                ? "将覆盖该订阅的配置与订阅源，链接保持不变"
                : "生成持久化的订阅链接，支持在 Clash 客户端中自动更新"}
          </DialogDescription>
        </DialogHeader>

        {!subscriptionUrl ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subscription-name">订阅名称</Label>
              <Input
                id="subscription-name"
                placeholder="例如：我的配置"
                value={subscriptionName}
                onChange={(e) => setSubscriptionName(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="rounded-lg border border-border bg-muted p-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-foreground/85">更新时智能匹配节点</p>
                    <SmartNodeMatchingHelp enabled={smartNodeMatchingEnabled} />
                  </div>
                </div>
                <Switch aria-label="更新时智能匹配节点" checked={smartNodeMatchingEnabled} onCheckedChange={setSmartNodeMatchingEnabled} />
              </div>

              <div className="my-3 border-t border-border" />

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-foreground/85">启用自动更新</p>
                  <p className="mt-1 text-xs text-muted-foreground">开启后服务器会按设定间隔刷新缓存</p>
                </div>
                <Switch aria-label="启用自动更新" checked={autoUpdateEnabled} onCheckedChange={setAutoUpdateEnabled} />
              </div>

              {autoUpdateEnabled && (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="subscription-update-hours">自动更新间隔（小时）</Label>
                  <Input
                    id="subscription-update-hours"
                    type="number"
                    min={autoUpdatePolicy.minHours}
                    step={autoUpdatePolicy.stepHours}
                    value={autoUpdateHours}
                    onChange={(e) => setAutoUpdateHours(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">最小 {minAutoUpdateLabel}，按创建时间计时</p>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning-foreground">
              <p className="font-medium mb-1">注意事项</p>
              <ul className="text-xs text-warning-foreground space-y-1">
                <li>🔒 配置数据将加密存储于服务器</li>
                <li>🔑 订阅链接相当于访问凭证，请勿公开分享</li>
                <li>⏱️ 客户端高频拉取订阅会被封禁，请合理配置</li>
                {isEditingExistingSubscription ? (
                  <>
                    <li>⚠️ 更新将覆盖原订阅配置与订阅源</li>
                    <li>✅ 订阅链接保持不变（无需在客户端重新导入）</li>
                  </>
                ) : (
                  <li>🗑️ 您可以随时在仪表盘删除订阅</li>
                )}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <SubscriptionQrCode subscriptionUrl={subscriptionUrl} />
            <div className="space-y-2">
              <label htmlFor="subscription-url" className="text-sm font-medium">订阅链接</label>
              <div className="flex gap-2">
                <Input id="subscription-url" value={subscriptionUrl} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  onClick={handleCopyUrl}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success-foreground" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "已复制" : "复制链接"}
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-sm">
              <p className="text-success-foreground font-medium mb-1">
                ✅ {isEditingExistingSubscription ? "更新成功" : "创建成功"}
              </p>
              <p className="text-xs text-success-foreground">
                {isEditingExistingSubscription ? "订阅链接保持不变，可在仪表盘查看" : "您可以在仪表盘中管理所有订阅"}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!subscriptionUrl ? (
            <>
              <Button variant="outline" onClick={close}>
                取消
              </Button>
              <Button
                onClick={handleCreateSubscription}
                disabled={!subscriptionName.trim() || isCreatingSubscription}
              >
                {isCreatingSubscription ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <LinkIcon className="h-4 w-4 mr-2" />
                )}
                {isEditingExistingSubscription ? "保存更新" : "生成链接"}
              </Button>
            </>
          ) : (
            <Button onClick={close}>完成</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

