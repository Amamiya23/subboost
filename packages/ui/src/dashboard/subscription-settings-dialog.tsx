"use client";

import { Button } from "@subboost/ui/components/coss/compat/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@subboost/ui/components/coss/compat/dialog";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Label } from "@subboost/ui/components/coss/compat/label";
import { Switch } from "@subboost/ui/components/coss/compat/switch";
import { SmartNodeMatchingHelp } from "@subboost/ui/components/subscription/smart-node-matching-help";
import {
  getAutoUpdateIntervalPolicyMinLabel,
  resolveAutoUpdateIntervalPolicy,
  type AutoUpdateIntervalPolicy,
} from "@subboost/core/subscription/auto-update-interval";
import type { Subscription } from "./dashboard-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription | null;
  settingsName: string;
  setSettingsName: (value: string) => void;
  smartNodeMatchingEnabled: boolean;
  setSmartNodeMatchingEnabled: (value: boolean) => void;
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (value: boolean) => void;
  autoUpdateHours: number;
  setAutoUpdateHours: (value: number) => void;
  savingSettings: boolean;
  onSave: () => void;
  userIsAdmin: boolean;
  autoUpdatePolicy?: AutoUpdateIntervalPolicy;
};

export function SubscriptionSettingsDialog({
  open,
  onOpenChange,
  subscription,
  settingsName,
  setSettingsName,
  smartNodeMatchingEnabled,
  setSmartNodeMatchingEnabled,
  autoUpdateEnabled,
  setAutoUpdateEnabled,
  autoUpdateHours,
  setAutoUpdateHours,
  savingSettings,
  onSave,
  userIsAdmin,
  autoUpdatePolicy,
}: Props) {
  const policy = autoUpdatePolicy ?? resolveAutoUpdateIntervalPolicy(userIsAdmin);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>订阅设置</DialogTitle>
          <DialogDescription>
            改名与自动更新配置（最小 {getAutoUpdateIntervalPolicyMinLabel(policy)}，按创建时间计时）
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-5" aria-busy={savingSettings}>
          <div className="space-y-2">
            <Label htmlFor="subscription-settings-name">订阅名称</Label>
            <Input
              id="subscription-settings-name"
              disabled={savingSettings}
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              maxLength={100}
              placeholder="例如：我的配置"
            />
          </div>

          <div className="flex items-center justify-between gap-4 border-t pt-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Label htmlFor="subscription-smart-matching">更新时智能匹配节点</Label>
                <SmartNodeMatchingHelp enabled={smartNodeMatchingEnabled} />
              </div>
            </div>
            <Switch id="subscription-smart-matching" checked={smartNodeMatchingEnabled} onCheckedChange={setSmartNodeMatchingEnabled} disabled={savingSettings} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="subscription-auto-update">启用自动更新</Label>
              <p id="subscription-auto-update-hint" className="mt-1 text-xs leading-5 text-muted-foreground">开启后服务器会按间隔刷新缓存</p>
            </div>
            <Switch id="subscription-auto-update" aria-describedby="subscription-auto-update-hint" checked={autoUpdateEnabled} onCheckedChange={setAutoUpdateEnabled} disabled={savingSettings} />
          </div>

          {!autoUpdateEnabled && subscription?.autoUpdateState.disabledAt && subscription.autoUpdateState.disabledReason && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning-foreground">
              自动更新已关闭：{subscription.autoUpdateState.disabledReason}。当前可用配置仍会保留；检查订阅 URL 后可重新开启自动更新。
            </div>
          )}

          {autoUpdateEnabled && (
            <div className="space-y-2">
              <Label htmlFor="subscription-update-hours">自动更新间隔（小时）</Label>
              <Input
                id="subscription-update-hours"
                disabled={savingSettings}
                type="number"
                min={policy.minHours}
                step={policy.stepHours}
                value={autoUpdateHours}
                onChange={(e) => setAutoUpdateHours(Number(e.target.value))}
              />
            </div>
          )}
        </DialogPanel>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={savingSettings}>
            取消
          </Button>
          <Button onClick={onSave} disabled={savingSettings}>
            {savingSettings ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
