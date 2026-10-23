"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Copy,
  CopyPlus,
  Download,
  FileCode,
  MoreVertical,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
} from "lucide-react";

import { Button } from "@subboost/ui/components/coss/compat/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@subboost/ui/components/coss/compat/dropdown-menu";
import { Alert } from "@subboost/ui/components/coss/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@subboost/ui/components/coss/empty";
import { confirmDialog } from "@subboost/ui/components/ui/confirm-dialog";
import { toast } from "@subboost/ui/components/coss/compat/toaster";
import { useUserStore, type User } from "@subboost/ui/store/user-store";
import {
  autoUpdateIntervalHoursToSeconds,
  autoUpdateIntervalSecondsToHours,
  getAutoUpdateIntervalPolicyMinLabel,
  resolveAutoUpdateIntervalPolicy,
  type AutoUpdateIntervalPolicyOverride,
} from "@subboost/core/subscription/auto-update-interval";
import { formatDashboardDate, formatIntervalLabel } from "@subboost/ui/dashboard/dashboard-format";
import { buildRefreshSubscriptionSuccessToast } from "@subboost/ui/dashboard/dashboard-refresh-toast";
import { SubscriptionSettingsDialog } from "@subboost/ui/dashboard/subscription-settings-dialog";
import { SubscriptionQrCodeDialog } from "@subboost/ui/components/subscription/subscription-qr-code-dialog";
import type { RefreshSubscriptionResponse, Subscription } from "@subboost/ui/dashboard/dashboard-types";

type UpdateSettingsPayload = {
  name: string;
  smartNodeMatchingEnabled: boolean;
  autoUpdateInterval: number | null;
};

export type DashboardSurfaceAdapter = {
  loginHref?: string;
  newSubscriptionHref?: string;
  templatesHref?: string | null;
  settingsHref?: string | null;
  settingsTitle?: string;
  settingsDescription?: string;
  autoUpdateIntervalPolicy?: AutoUpdateIntervalPolicyOverride;
  editSubscriptionHref?: (subscription: Subscription) => string;
  copySubscriptionHref?: (subscription: Subscription) => string;
  fetchSubscriptions: () => Promise<Subscription[]>;
  deleteSubscription: (id: string) => Promise<void>;
  refreshSubscription: (id: string) => Promise<RefreshSubscriptionResponse>;
  updateSubscriptionSettings: (id: string, payload: UpdateSettingsPayload) => Promise<void>;
  resolveDownloadUrl?: (subscription: Subscription) => string;
  renderAnnouncement?: (context: { user: User }) => React.ReactNode;
  renderHeaderActions?: (context: { user: User }) => React.ReactNode;
  renderExtraQuickActions?: (context: { user: User }) => React.ReactNode;
  beforeStatsSlot?: React.ReactNode;
};

type Props = {
  adapter: DashboardSurfaceAdapter;
};

function buildYamlDownloadFilename(name: string): string {
  const base =
    String(name || "subboost-config")
      .trim()
      .replace(/[\r\n]/g, " ")
      .replace(/[<>:"/\\|?*]+/g, "")
      .replace(/\s+/g, "_")
      .replace(/\.(?:ya?ml)$/i, "")
      .slice(0, 80) || "subboost-config";
  return `${base}.yaml`;
}

function triggerBrowserDownload(href: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export function SubscriptionDashboardSurface({ adapter }: Props) {
  const { user, isLoading: userLoading, fetchUser } = useUserStore();
  const [subscriptions, setSubscriptions] = React.useState<Subscription[]>([]);
  const autoUpdateNoticeRef = React.useRef<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [refreshingId, setRefreshingId] = React.useState<string | null>(null);

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsSub, setSettingsSub] = React.useState<Subscription | null>(null);
  const [settingsName, setSettingsName] = React.useState("");
  const [smartNodeMatchingEnabled, setSmartNodeMatchingEnabled] = React.useState(true);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = React.useState(false);
  const autoUpdatePolicy = React.useMemo(
    () => resolveAutoUpdateIntervalPolicy(user?.isAdmin === true, adapter.autoUpdateIntervalPolicy),
    [adapter.autoUpdateIntervalPolicy, user?.isAdmin]
  );
  const [autoUpdateHours, setAutoUpdateHours] = React.useState<number>(autoUpdatePolicy.defaultHours);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const fetchSubscriptions = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextSubscriptions = await adapter.fetchSubscriptions();
      setSubscriptions(nextSubscriptions);
    } catch (error) {
      console.error("Failed to fetch subscriptions:", error);
      setLoadError(error instanceof Error ? error.message : "获取订阅失败");
    } finally {
      setIsLoading(false);
    }
  }, [adapter]);

  React.useEffect(() => {
    if (!user) {
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    void fetchSubscriptions();
  }, [user, fetchSubscriptions]);

  React.useEffect(() => {
    if (!user) return;
    const disabled = subscriptions.filter((sub) => sub.autoUpdateState.disabledAt && sub.autoUpdateState.disabledReason);
    if (disabled.length === 0) return;

    const unseen = disabled.filter((sub) => {
      const fingerprint = `${sub.autoUpdateState.disabledAt}:${sub.autoUpdateState.disabledReason}`;
      const storageKey = `subboost:notice:auto_update_disabled:${user.id}:${sub.id}`;
      try {
        if (localStorage.getItem(storageKey) === fingerprint) return false;
        localStorage.setItem(storageKey, fingerprint);
      } catch {}
      return true;
    });
    const firstDisabled = unseen[0];
    if (!firstDisabled) return;

    const eventKey = unseen.map((sub) => `${sub.id}:${sub.autoUpdateState.disabledAt}`).join("|");
    if (autoUpdateNoticeRef.current === eventKey) return;
    autoUpdateNoticeRef.current = eventKey;

    toast({
      title: unseen.length === 1 ? "自动更新已关闭" : `${unseen.length} 个订阅的自动更新已关闭`,
      description: (
        <div className="whitespace-pre-line">
          {[
            unseen.length === 1
              ? `「${firstDisabled.name}」的订阅源连续拉取失败，系统已关闭自动更新。`
              : "部分订阅源连续拉取失败，系统已关闭对应订阅的自动更新。",
            "当前可用配置仍会保留；请检查订阅 URL 是否失效、是否限制服务端/代理 IP，必要时重新复制订阅链接后再开启自动更新。",
          ].join("\n")}
        </div>
      ),
      variant: "warning",
    });
  }, [subscriptions, user]);

  const copyToClipboard = async (subscriptionUrl: string, id: string) => {
    const copied = await copyText(subscriptionUrl);
    if (!copied) {
      toast({ title: "复制失败，请手动复制订阅链接", variant: "destructive" });
      return;
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadSubscription = async (subscription: Subscription) => {
    const filename = buildYamlDownloadFilename(subscription.name);
    try {
      const response = await fetch(adapter.resolveDownloadUrl?.(subscription) ?? subscription.subscriptionUrl);
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      triggerBrowserDownload(objectUrl, filename);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      console.error("Failed to fetch subscription YAML for download:", error);
      toast({
        title: "下载失败",
        description: "请刷新页面后重试，或先复制订阅链接到代理软件。",
        variant: "destructive",
      });
    }
  };

  const deleteSubscription = async (id: string) => {
    const ok = await confirmDialog({
      title: "确定要删除这个订阅吗？",
      confirmText: "删除",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await adapter.deleteSubscription(id);
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Failed to delete subscription:", error);
      toast({ title: "删除失败，请稍后重试", variant: "destructive" });
    }
  };

  const refreshSubscription = async (id: string) => {
    if (refreshingId) return;
    setRefreshingId(id);
    try {
      const data = await adapter.refreshSubscription(id);
      await fetchSubscriptions();
      toast(buildRefreshSubscriptionSuccessToast(data));
    } catch (error) {
      console.error("Failed to refresh subscription:", error);
      toast({ title: error instanceof Error ? error.message : "刷新失败，请稍后重试", variant: "destructive" });
    } finally {
      setRefreshingId(null);
    }
  };

  const openSubscriptionSettings = (sub: Subscription) => {
    setSettingsSub(sub);
    setSettingsName(sub.name);
    setSmartNodeMatchingEnabled(sub.smartNodeMatchingEnabled !== false);
    const hours = sub.autoUpdateInterval ? autoUpdateIntervalSecondsToHours(sub.autoUpdateInterval) : autoUpdatePolicy.defaultHours;
    setAutoUpdateHours(Math.max(autoUpdatePolicy.minHours, Number.isFinite(hours) ? hours : autoUpdatePolicy.defaultHours));
    setAutoUpdateEnabled(Boolean(sub.autoUpdateInterval));
    setSettingsOpen(true);
  };

  const saveSubscriptionSettings = async () => {
    if (!settingsSub || savingSettings) return;

    const name = settingsName.trim();
    if (!name || name.length > 100) {
      toast({ title: "订阅名称不能为空且长度不能超过 100 字符", variant: "warning" });
      return;
    }

    const hoursValue = Number(autoUpdateHours);
    if (autoUpdateEnabled) {
      if (!Number.isFinite(hoursValue) || hoursValue <= 0) {
        toast({ title: "自动更新间隔必须是有效小时数", variant: "warning" });
        return;
      }
      if (autoUpdatePolicy.requireIntegerHours && !Number.isInteger(hoursValue)) {
        toast({ title: "自动更新间隔必须是整数小时", variant: "warning" });
        return;
      }
      if (hoursValue < autoUpdatePolicy.minHours) {
        toast({
          title: `自动更新最小间隔为 ${getAutoUpdateIntervalPolicyMinLabel(autoUpdatePolicy)}`,
          variant: "warning",
        });
        return;
      }
    }

    const nextAutoUpdateInterval = autoUpdateEnabled ? autoUpdateIntervalHoursToSeconds(hoursValue) : null;
    setSavingSettings(true);
    try {
      await adapter.updateSubscriptionSettings(settingsSub.id, {
        name,
        smartNodeMatchingEnabled,
        autoUpdateInterval: nextAutoUpdateInterval,
      });

      setSubscriptions((prev) =>
        prev.map((s) =>
          s.id === settingsSub.id
            ? {
                ...s,
                name,
                smartNodeMatchingEnabled,
                autoUpdateInterval: nextAutoUpdateInterval,
                ...(autoUpdateEnabled
                  ? {
                      autoUpdateState: {
                        externalFailureCount: 0,
                        failureSourceState: null,
                        lastFailedAt: null,
                        lastAttemptedAt: null,
                        disabledAt: null,
                        disabledReason: null,
                        disabledPreviousInterval: null,
                      },
                    }
                  : {}),
              }
            : s
        )
      );
      setSettingsOpen(false);
    } catch (error) {
      console.error("Failed to save subscription settings:", error);
      toast({ title: error instanceof Error ? error.message : "保存失败，请稍后重试", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  if (userLoading) return <DashboardSkeleton />;
  if (!user) return <LoginPrompt loginHref={adapter.loginHref ?? "/login"} />;

  const newSubscriptionHref = adapter.newSubscriptionHref ?? "/builder?newSubscription=1";
  const editSubscriptionHref = adapter.editSubscriptionHref ?? ((sub: Subscription) => `/builder?editSubscriptionId=${encodeURIComponent(sub.id)}`);
  const copySubscriptionHref = adapter.copySubscriptionHref ?? ((sub: Subscription) => `/builder?copySubscriptionId=${encodeURIComponent(sub.id)}`);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {adapter.renderAnnouncement?.({ user })}

      <div className="mb-10 flex items-center justify-between gap-4 sm:mt-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold">我的订阅</h1>
          {!isLoading && !loadError && <span className="text-sm tabular-nums text-muted-foreground">{subscriptions.length}</span>}
        </div>
        <div className="flex items-center gap-2">
          {adapter.renderHeaderActions?.({ user })}
          <Button render={<Link href={newSubscriptionHref} />}>
            <Plus aria-hidden="true" />
            新建订阅
          </Button>
        </div>
      </div>

      {adapter.beforeStatsSlot}

      <section aria-label="订阅列表" className="border-t">
          {isLoading ? (
            <div className="divide-y" aria-label="正在加载订阅" aria-busy="true">
              {[1, 2].map((i) => (
                <div key={i} className="flex h-28 animate-pulse items-center justify-between gap-6 px-2">
                  <div className="space-y-3"><div className="h-4 w-32 rounded bg-muted" /><div className="h-3 w-52 rounded bg-muted" /></div>
                  <div className="h-8 w-24 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <Alert variant="error" className="mt-6 grid-cols-[auto_1fr]">
              <AlertTriangle aria-hidden="true" />
              <div className="flex flex-col gap-3">
                <span className="font-medium">订阅列表加载失败</span>
                <span className="text-muted-foreground">{loadError}</span>
                <Button variant="outline" size="sm" className="w-fit" onClick={() => void fetchSubscriptions()}>
                  <RefreshCw aria-hidden="true" />
                  重试
                </Button>
              </div>
            </Alert>
          ) : subscriptions.length === 0 ? (
            <Empty className="min-h-72 rounded-none border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileCode aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>暂无订阅</EmptyTitle>
                <EmptyDescription>生成配置后即可保存和管理订阅链接</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button render={<Link href={newSubscriptionHref} />}>
                  <Plus aria-hidden="true" />
                  新建订阅
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_11rem_8rem_18rem] items-center gap-6 border-b px-2 py-3 text-xs text-muted-foreground xl:grid">
                <span>订阅名称</span><span>最近更新</span><span>自动更新</span><span className="text-right">操作</span>
              </div>
              <ul className="divide-y border-b">
              {subscriptions.map((sub) => (
                <SubscriptionRow
                  key={sub.id}
                  sub={sub}
                  copiedId={copiedId}
                  refreshingId={refreshingId}
                  editHref={editSubscriptionHref(sub)}
                  copyHref={copySubscriptionHref(sub)}
                  onCopy={copyToClipboard}
                  onDelete={deleteSubscription}
                  onDownload={downloadSubscription}
                  onRefresh={refreshSubscription}
                  onSettings={openSubscriptionSettings}
                />
              ))}
              </ul>
            </>
          )}
      </section>

      <SubscriptionSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        subscription={settingsSub}
        settingsName={settingsName}
        setSettingsName={setSettingsName}
        smartNodeMatchingEnabled={smartNodeMatchingEnabled}
        setSmartNodeMatchingEnabled={setSmartNodeMatchingEnabled}
        autoUpdateEnabled={autoUpdateEnabled}
        setAutoUpdateEnabled={setAutoUpdateEnabled}
        autoUpdateHours={autoUpdateHours}
        setAutoUpdateHours={setAutoUpdateHours}
        savingSettings={savingSettings}
        onSave={saveSubscriptionSettings}
        userIsAdmin={user?.isAdmin === true}
        autoUpdatePolicy={autoUpdatePolicy}
      />

      {adapter.renderExtraQuickActions?.({ user })}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-28 border-y bg-muted/30" />
      </div>
    </div>
  );
}

function LoginPrompt({ loginHref }: { loginHref: string }) {
  return (
    <Empty className="mx-auto min-h-[calc(100vh-4rem)] max-w-md">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Shield aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>请先登录</EmptyTitle>
        <EmptyDescription>登录后管理订阅与模板</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="lg" render={<Link href={loginHref} />}>登录</Button>
      </EmptyContent>
    </Empty>
  );
}

function SubscriptionRow({
  sub,
  copiedId,
  refreshingId,
  editHref,
  copyHref,
  onCopy,
  onDelete,
  onDownload,
  onRefresh,
  onSettings,
}: {
  sub: Subscription;
  copiedId: string | null;
  refreshingId: string | null;
  editHref: string;
  copyHref: string;
  onCopy: (subscriptionUrl: string, id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDownload: (sub: Subscription) => Promise<void>;
  onRefresh: (id: string) => Promise<void>;
  onSettings: (sub: Subscription) => void;
}) {
  return (
    <li className="grid min-w-0 gap-x-6 gap-y-4 px-2 py-6 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center xl:grid-cols-[minmax(0,1fr)_11rem_8rem_18rem]">
      <div className="min-w-0">
        <div className="min-w-0">
          <h2 className="truncate font-medium"><Link href={editHref} className="rounded-sm hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" title={sub.name}>{sub.name}</Link></h2>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground tabular-nums">创建于 {formatDashboardDate(sub.createdAt)}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground xl:hidden">
            <span>更新于 {formatDashboardDate(sub.lastUpdatedAt)}</span>
            <span>{sub.autoUpdateInterval ? `每 ${formatIntervalLabel(sub.autoUpdateInterval)} 更新` : "自动更新关闭"}</span>
          </div>
        </div>
      </div>
      <time dateTime={sub.lastUpdatedAt ?? undefined} className="hidden text-xs text-muted-foreground tabular-nums xl:block">{formatDashboardDate(sub.lastUpdatedAt)}</time>
      <span className="hidden text-sm text-muted-foreground xl:block">{sub.autoUpdateInterval ? `每 ${formatIntervalLabel(sub.autoUpdateInterval)}` : "已关闭"}</span>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <Button variant="ghost" size="sm" title="进入配置生成器编辑该订阅（更新后链接不变）" render={<Link href={editHref} />}>
          <Settings aria-hidden="true" />
          编辑
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void onCopy(sub.subscriptionUrl, sub.id)}
          title="复制订阅链接"
        >
          {copiedId === sub.id ? (
            <>
              <Check className="h-4 w-4 text-success-foreground" />
              <span className="text-success-foreground" role="status">已复制</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>复制链接</span>
            </>
          )}
        </Button>
        <SubscriptionQrCodeDialog subscriptionUrl={sub.subscriptionUrl} subscriptionName={sub.name} />
        {refreshingId === sub.id && (
          <span role="status" className="inline-flex items-center gap-1 text-xs text-muted-foreground"><RefreshCw className="size-3.5 animate-spin" />刷新中…</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`${sub.name}的更多操作`}><MoreVertical aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href={copyHref}><CopyPlus className="mr-2 h-4 w-4" />复制配置</Link></DropdownMenuItem>
            <DropdownMenuItem title="订阅设置（改名 / 自动更新）" onSelect={() => onSettings(sub)}><Settings className="mr-2 h-4 w-4" />订阅设置</DropdownMenuItem>
            <DropdownMenuItem title="重新生成配置并刷新缓存" disabled={refreshingId === sub.id} onSelect={() => void onRefresh(sub.id)}><RefreshCw className="mr-2 h-4 w-4" />刷新订阅</DropdownMenuItem>
            <DropdownMenuItem title="下载订阅配置" onSelect={() => void onDownload(sub)}><Download className="mr-2 h-4 w-4" />下载配置</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive-foreground focus:text-destructive-foreground" onSelect={() => void onDelete(sub.id)}><Trash2 className="mr-2 h-4 w-4" />删除订阅</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!sub.autoUpdateInterval && sub.autoUpdateState.disabledAt && sub.autoUpdateState.disabledReason && (
        <p className="flex items-start gap-2 text-xs text-warning-foreground sm:col-span-2 xl:col-span-4">
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
          自动更新已关闭：{sub.autoUpdateState.disabledReason}
        </p>
      )}
    </li>
  );
}
