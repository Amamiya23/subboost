"use client";

import * as React from "react";
import Link from "next/link";
import {
  Download,
  AlertTriangle,
  ExternalLink,
  Eye,
  Loader2,
  Settings2,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@subboost/ui/components/coss/compat/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@subboost/ui/components/coss/compat/tabs";
import { QuickMode } from "@subboost/ui/product/converter/quick-mode";
import { AdvancedMode } from "@subboost/ui/product/converter/advanced-mode";
import { UnsavedPrompt } from "@subboost/ui/product/home/unsaved-prompt";
import { VisualGraph } from "@subboost/ui/product/preview/visual-graph";
import { YamlPreviewEditor } from "@subboost/ui/product/preview/yaml-preview-editor";
import { SubscriptionLinkDialog } from "@subboost/ui/product/home/subscription-link-dialog";
import { artisticTabsIconClassName, artisticTabsListClassName, artisticTabsTriggerClassName } from "@subboost/ui/components/ui/artistic-nav";
import { useProductInteractionAdapter, type ProductMode } from "@subboost/ui/product/interactions";
import { cn } from "@subboost/ui/lib/utils";
import type { User } from "@subboost/ui/store/user-store";
import type { AutoUpdateIntervalPolicy } from "@subboost/core/subscription/auto-update-interval";

type EditingSubscription = {
  id: string;
  token: string;
  name: string;
  autoUpdateInterval: number | null;
  smartNodeMatchingEnabled: boolean;
};

type SubscriptionLinkState = {
  subscriptionDialog: boolean;
  setSubscriptionDialog: (open: boolean) => void;
  subscriptionName: string;
  setSubscriptionName: (value: string) => void;
  subscriptionUrl: string;
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (value: boolean) => void;
  autoUpdateHours: number;
  setAutoUpdateHours: (value: number) => void;
  autoUpdatePolicy: AutoUpdateIntervalPolicy;
  smartNodeMatchingEnabled: boolean;
  setSmartNodeMatchingEnabled: (value: boolean) => void;
  isCreatingSubscription: boolean;
  copied: boolean;
  saveRequirementDialog: boolean;
  setSaveRequirementDialog: (open: boolean) => void;
  isEditingExistingSubscription: boolean;
  handleGenerateSubscription: (mode: ProductMode) => void;
  handleAcceptSaveRequirement: () => void;
  handleCreateSubscription: () => void;
  handleCopyUrl: () => void;
};

type Props = {
  showAiColumn: boolean;
  user: User | null;
  authChecked: boolean;

  editingSubscription: EditingSubscription | null;
  isLoadingEditingSubscription: boolean;
  subscriptionLoadError?: string | null;
  editSubscriptionId: string | null;
  copySubscriptionId?: string | null;

  generatedYaml: string;
  generatedYamlError: string | null;
  configLoading: boolean;
  pendingSourceCount?: number;
  hasImportedNodes?: boolean;
  hasValidSources: boolean;

  handleGenerate: (mode: ProductMode, importPending?: boolean) => void;
  handleDownload: (mode: ProductMode) => void;
  onGeneratedYamlChange: (yaml: string) => void;

  subscription: SubscriptionLinkState;
  noticeSlot?: React.ReactNode;
  renderAnnouncement?: (context: {
    placement: "home" | "advanced";
    authChecked: boolean;
    user: User | null;
  }) => React.ReactNode;
  saveRequirementSlot?: React.ReactNode;
  templateUploadHref?: string | null;
  onTemplateUploadOpen?: () => void;
};

const DESKTOP_PANEL_MIN_HEIGHT_CLASS = "lg:min-h-[39rem]";
const DESKTOP_PANEL_CONTENT_MIN_HEIGHT_CLASS = "lg:min-h-[30rem]";

export function HomeLayout({
  showAiColumn,
  user,
  authChecked,
  editingSubscription,
  isLoadingEditingSubscription,
  subscriptionLoadError,
  editSubscriptionId,
  copySubscriptionId,
  generatedYaml,
  generatedYamlError,
  configLoading,
  pendingSourceCount = 0,
  hasImportedNodes = false,
  hasValidSources,
  handleGenerate,
  handleDownload,
  onGeneratedYamlChange,
  subscription,
  noticeSlot,
  renderAnnouncement,
  saveRequirementSlot,
  templateUploadHref = "/templates?upload=1",
  onTemplateUploadOpen,
}: Props) {
  const [configTab, setConfigTab] = React.useState<"quick" | "advanced">(editSubscriptionId || copySubscriptionId ? "advanced" : "quick");
  const interactions = useProductInteractionAdapter();
  const copyNotReady = Boolean(copySubscriptionId && subscriptionLoadError);

  React.useEffect(() => {
    if (!editSubscriptionId && !copySubscriptionId) return;
    setConfigTab("advanced");
  }, [editSubscriptionId, copySubscriptionId]);

  const handleConfigTabChange = React.useCallback((value: string) => {
    const nextMode: ProductMode = value === "advanced" ? "advanced" : "quick";
    setConfigTab(nextMode);
    interactions.modeChanged?.({ mode: nextMode });
  }, [interactions]);

  return (
    <div className="builder-workspace w-full max-w-[clamp(1200px,95vw,2400px)] mx-auto px-3 sm:px-6 lg:px-8 xl:px-12 py-4 lg:py-6 min-h-[calc(100vh-64px)] flex flex-col">
      {renderAnnouncement?.({
        placement: configTab === "advanced" ? "advanced" : "home",
        authChecked,
        user,
      })}

      {noticeSlot}
      {copySubscriptionId && !editingSubscription && (
        <div role="status" className="mb-4 rounded-md border border-primary-500/20 bg-primary-500/5 px-4 py-3 text-sm text-muted-foreground">
          {isLoadingEditingSubscription
            ? "正在复制配置…"
            : copyNotReady
              ? "配置未能复制，请返回我的订阅重试。"
              : "复用配置创建新订阅：请在订阅源中替换链接或节点，重新导入后生成订阅链接。规则、分组和 DNS 设置已保留，原订阅不会被修改。"}
        </div>
      )}

      {/* Main Content - Three Column Layout */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 lg:flex-1 ${DESKTOP_PANEL_MIN_HEIGHT_CLASS}`}>
        {/* Left Column - Configuration */}
        <div
          id="config"
          className={`${
            showAiColumn ? "lg:col-span-4 xl:col-span-4" : "lg:col-span-6 xl:col-span-6"
          } flex flex-col gap-3 min-h-0 ${DESKTOP_PANEL_MIN_HEIGHT_CLASS}`}
        >
          <Tabs
            value={configTab}
            onValueChange={handleConfigTabChange}
            className={`flex flex-col lg:flex-1 ${DESKTOP_PANEL_MIN_HEIGHT_CLASS}`}
          >
            <Card className={`workspace-panel w-full flex flex-col overflow-visible lg:flex-1 lg:overflow-hidden ${DESKTOP_PANEL_MIN_HEIGHT_CLASS}`}>
              <CardHeader className="workspace-panel-header flex-shrink-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base lg:text-lg flex items-center gap-2 min-w-0">
                    <span className="mono-label text-acid/90">01</span>
                    <Settings2 className="h-5 w-5 text-muted-foreground" />
                    <span className="shrink-0">{editingSubscription ? "编辑订阅" : "配置生成器"}</span>
                    {isLoadingEditingSubscription && (editSubscriptionId || copySubscriptionId) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-foreground/85">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        加载订阅中...
                      </span>
                    )}
                    {editingSubscription && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-foreground/85 min-w-0">
                        <span className="max-w-[10rem] sm:max-w-[16rem] truncate">
                          {editingSubscription.name}
                        </span>
                      </span>
                    )}
                  </CardTitle>
                  <TabsList className={cn(artisticTabsListClassName, "self-start")}>
                    <TabsTrigger value="quick" className={cn(artisticTabsTriggerClassName, "min-w-[7rem]")}>
                      <Zap className={artisticTabsIconClassName} />
                      快捷模式
                    </TabsTrigger>
                    <TabsTrigger value="advanced" className={cn(artisticTabsTriggerClassName, "min-w-[7rem]")}>
                      <Settings2 className={artisticTabsIconClassName} />
                      高级模式
                    </TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>
              <CardContent className={`pt-0 relative lg:flex-1 lg:overflow-hidden ${DESKTOP_PANEL_CONTENT_MIN_HEIGHT_CLASS}`}>
                <TabsContent
                  value="quick"
                  className="mt-0 flex flex-col data-[state=inactive]:hidden lg:absolute lg:inset-0 lg:overflow-y-auto custom-scrollbar lg:pr-1"
                >
                  <QuickMode />
                </TabsContent>
                <TabsContent
                  value="advanced"
                  className="mt-0 data-[state=inactive]:hidden lg:absolute lg:inset-0 lg:overflow-y-auto custom-scrollbar lg:pr-1"
                >
                  <AdvancedMode />
                </TabsContent>
              </CardContent>
              <CardFooter className="justify-center gap-2 flex-shrink-0 pt-3 flex-row flex-wrap">
                {pendingSourceCount > 0 && (
                  <p role="status" className="w-full text-center text-xs text-warning-foreground">
                    {pendingSourceCount} 个来源尚未导入。导入后才能保存最新订阅。
                  </p>
                )}
                <Button variant={editingSubscription ? "outline" : "default"} className="h-10" onClick={() => handleGenerate(configTab)} disabled={configLoading || isLoadingEditingSubscription || copyNotReady || !hasValidSources}>
                  {configLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      {pendingSourceCount > 0 ? "导入并生成" : "生成配置"}
                    </>
                  )}
                </Button>
                {pendingSourceCount > 0 && hasImportedNodes && (
                  <Button variant="ghost" className="h-10" disabled={configLoading || isLoadingEditingSubscription || copyNotReady} onClick={() => handleGenerate(configTab, false)}>
                    仅使用当前节点
                  </Button>
                )}
                {user && templateUploadHref && (
                  <Link href={templateUploadHref}>
                    <Button
                      variant="outline"
                      className="h-10 gap-2"
                      onClick={() => {
                        onTemplateUploadOpen?.();
                        interactions.templateUploadOpened?.({ entry: "home" });
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      上传模板
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
          </Tabs>
        </div>

        {/* Middle Column - Preview */}
        <div
          id="preview"
          className={`${
            showAiColumn ? "lg:col-span-4 xl:col-span-4" : "lg:col-span-6 xl:col-span-6"
          } flex flex-col gap-3 min-h-0 ${DESKTOP_PANEL_MIN_HEIGHT_CLASS}`}
        >
          <Tabs defaultValue="visual" className={`w-full flex flex-col lg:flex-1 ${DESKTOP_PANEL_MIN_HEIGHT_CLASS}`}>
            <Card className={`workspace-panel w-full flex flex-col lg:flex-1 ${DESKTOP_PANEL_MIN_HEIGHT_CLASS}`}>
              <CardHeader className="workspace-panel-header flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base lg:text-lg flex items-center gap-2">
                    <span className="mono-label text-acid/90">02</span>
                    <Eye className="h-5 w-5 text-muted-foreground" />
                    预览
                  </CardTitle>
                  <TabsList className={artisticTabsListClassName}>
                    <TabsTrigger value="yaml" className={artisticTabsTriggerClassName}>
                      YAML
                    </TabsTrigger>
                    <TabsTrigger value="visual" className={artisticTabsTriggerClassName}>
                      可视化
                    </TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>
              <CardContent className={`pt-0 relative lg:flex-1 lg:overflow-hidden ${DESKTOP_PANEL_CONTENT_MIN_HEIGHT_CLASS}`}>
                <TabsContent value="yaml" className="mt-0 data-[state=inactive]:hidden lg:absolute lg:inset-0">
                  <div className="h-[clamp(420px,70vh,820px)] lg:h-full rounded-md bg-muted border border-border overflow-auto custom-scrollbar">
                    {generatedYamlError ? (
                      <div className="h-full p-4 text-sm text-destructive-foreground">
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <div>
                            <div className="font-medium">配置生成失败</div>
                            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                              {generatedYamlError}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ) : generatedYaml ? (
                      <YamlPreviewEditor
                        content={generatedYaml}
                        onContentChange={onGeneratedYamlChange}
                        className="h-full"
                      />
                    ) : (
                      <pre className="p-4 font-mono text-xs text-muted-foreground whitespace-pre">
                        {`# 请先添加订阅或节点
# 配置将在此处预览

# 示例配置结构:
# proxies:
#   - name: "节点名称"
#     type: vmess
#     ...
#
# proxy-groups:
#   - name: "🚀 节点选择"
#     type: select
#     ...
#
# rules:
#   - RULE-SET,xxx,代理组
#   ...`}
                      </pre>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="visual" className="mt-0 data-[state=inactive]:hidden lg:absolute lg:inset-0">
                  <div className="h-[clamp(420px,70vh,820px)] lg:h-full rounded-md bg-muted border border-border overflow-hidden">
                    <VisualGraph />
                  </div>
                </TabsContent>
              </CardContent>
              <CardFooter className="justify-center gap-2 flex-shrink-0 pt-3 flex-row flex-wrap">
                <Button
                  className="h-10"
                  variant="outline"
                  disabled={configLoading || isLoadingEditingSubscription || copyNotReady || !generatedYaml || Boolean(generatedYamlError)}
                  onClick={() => handleDownload(configTab)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载配置
                </Button>
                <Button
                  className="h-10"
                  variant="default"
                  disabled={configLoading || pendingSourceCount > 0 || isLoadingEditingSubscription || copyNotReady || !generatedYaml || Boolean(generatedYamlError) || !authChecked}
                  onClick={() => subscription.handleGenerateSubscription(configTab)}
                >
                  {user && subscription.isEditingExistingSubscription ? "保存订阅" : "生成订阅链接"}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
                {subscription.isEditingExistingSubscription && (
                  <Button asChild
                    className="h-10"
                    variant="outline"
                    title="退出编辑模式"
                  >
                    <Link href="/builder">返回新建</Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          </Tabs>
        </div>

        {/* Right Column - AI (施工中占位) */}
        {showAiColumn && (
          <div id="ai" className={`lg:col-span-4 xl:col-span-4 flex flex-col gap-3 min-h-0 ${DESKTOP_PANEL_MIN_HEIGHT_CLASS}`}>
            <Card className={`w-full flex-1 flex flex-col overflow-hidden min-h-0 ${DESKTOP_PANEL_MIN_HEIGHT_CLASS}`}>
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-base lg:text-lg flex items-center gap-2 text-foreground">
                  <span className="mono-label text-acid/90">03</span>
                  AI 助手
                </CardTitle>
              </CardHeader>
              <CardContent className={`flex-1 min-h-0 flex items-center justify-center ${DESKTOP_PANEL_CONTENT_MIN_HEIGHT_CLASS}`}>
                <p className="mono-label text-muted-foreground">AI 助手施工中</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="h-20 md:hidden" aria-hidden="true" />
      <div className="fixed bottom-16 inset-x-0 z-40 flex items-center justify-end gap-2 border-t border-border bg-ink-50 px-4 py-3 md:hidden" aria-label="配置操作">
        <Button variant="outline" onClick={() => document.getElementById("preview")?.scrollIntoView({ block: "start" })}>
          查看预览
        </Button>
        {!generatedYaml || pendingSourceCount > 0 ? (
          <Button onClick={() => handleGenerate(configTab)} disabled={configLoading || isLoadingEditingSubscription || copyNotReady || !hasValidSources}>
            {configLoading ? "处理中…" : pendingSourceCount > 0 ? "导入并生成" : "生成配置"}
          </Button>
        ) : (
          <Button onClick={() => subscription.handleGenerateSubscription(configTab)} disabled={configLoading || isLoadingEditingSubscription || copyNotReady || Boolean(generatedYamlError) || !authChecked || subscription.isCreatingSubscription}>
            {subscription.isCreatingSubscription ? "保存中…" : subscription.isEditingExistingSubscription ? "保存订阅" : "生成订阅链接"}
          </Button>
        )}
      </div>

      {/* 未保存提醒 */}
      <UnsavedPrompt />

      {saveRequirementSlot}

      {/* 订阅链接对话框 */}
      <SubscriptionLinkDialog
        open={subscription.subscriptionDialog}
        onOpenChange={subscription.setSubscriptionDialog}
        subscriptionUrl={subscription.subscriptionUrl}
        subscriptionName={subscription.subscriptionName}
        setSubscriptionName={subscription.setSubscriptionName}
        autoUpdateEnabled={subscription.autoUpdateEnabled}
        setAutoUpdateEnabled={subscription.setAutoUpdateEnabled}
        autoUpdateHours={subscription.autoUpdateHours}
        setAutoUpdateHours={subscription.setAutoUpdateHours}
        autoUpdatePolicy={subscription.autoUpdatePolicy}
        smartNodeMatchingEnabled={subscription.smartNodeMatchingEnabled}
        setSmartNodeMatchingEnabled={subscription.setSmartNodeMatchingEnabled}
        isCreatingSubscription={subscription.isCreatingSubscription}
        copied={subscription.copied}
        isEditingExistingSubscription={subscription.isEditingExistingSubscription}
        handleCopyUrl={subscription.handleCopyUrl}
        handleCreateSubscription={subscription.handleCreateSubscription}
      />
    </div>
  );
}
