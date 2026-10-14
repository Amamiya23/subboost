"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { setConfigDraftUserScope, useConfigStore } from "@subboost/ui/store/config-store";
import { consumeAuthConfigHandoff } from "@subboost/ui/store/config-store/auth-handoff";
import { useUserStore, type User } from "@subboost/ui/store/user-store";
import { useUIStore } from "@subboost/ui/store/ui-store";
import { isSourcePendingImport } from "@subboost/ui/product/subscription/source-import-state";
import { getConfigSnapshot } from "./config-save-state";
import { HomeLayout } from "@subboost/ui/product/home/home-layout";
import { useHomeActions } from "@subboost/ui/product/home/use-home-actions";
import { useCleanNewSubscriptionIntent } from "@subboost/ui/product/home/use-clean-new-subscription-intent";
import { useEditingSubscriptionLoader } from "@subboost/ui/product/home/use-editing-subscription-loader";
import { useSubscriptionLink, type HomeSubscriptionAdapter } from "@subboost/ui/product/home/use-subscription-link";
import { ProductApiAdapterProvider, type ProductApiAdapter } from "@subboost/ui/product/api-adapter";
import {
  ProductInteractionAdapterProvider,
  type ProductInteractionAdapter,
} from "@subboost/ui/product/interactions";

type AnnouncementContext = {
  placement: "home" | "advanced";
  authChecked: boolean;
  user: User | null;
};

type SaveRequirementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
};

export type HomeSurfaceAdapter = {
  productApi?: ProductApiAdapter;
  interactions?: ProductInteractionAdapter;
  subscription?: HomeSubscriptionAdapter;
  loadSubscription?: (id: string) => Promise<Response>;
  loginHref?: string;
  templateUploadHref?: string | null;
  recordConfigDownload?: (templateId: string | null) => void;
  onAuthenticatedUserReady?: (context: { user: User }) => void;
  onTemplateUploadOpen?: () => void;
  renderNotice?: (context: { user: User | null; showAiColumn: boolean }) => React.ReactNode;
  renderAnnouncement?: (context: AnnouncementContext) => React.ReactNode;
  renderSaveRequirementDialog?: (props: SaveRequirementDialogProps) => React.ReactNode;
};

type Props = {
  adapter?: HomeSurfaceAdapter;
};

function HomeSurfaceInner({ adapter }: Props) {
  const {
    nodes,
    deletedNodeNames,
    deletedNodes,
    generatedYaml,
    generatedYamlError,
    isLoading: configLoading,
    sources: storeSources,
    setSources: setStoreSources,
    parseMultipleSources,
    clearNodes,
    generateConfig,
    setGeneratedYaml,
    template,
    enabledProxyGroups,
    hiddenProxyGroups,
    customProxyGroups,
    customRuleSets,
    builtinRuleEdits,
    moduleRuleEditWarningAccepted,
    customRules,
    ruleOrder,
    dialerProxyGroups,
    listenerPorts,
    dnsYaml,
    ruleProviderBaseUrl,
    testUrl,
    testInterval,
    cnIpNoResolve,
    experimentalCnUseCnRuleSet,
    proxyGroupNameOverrides,
    appliedTemplateId,
  } = useConfigStore();
  const { user, fetchUser, clearUser } = useUserStore();
  const userId = user?.id ?? null;
  const editingSubscription = useUIStore((state) => state.editingSubscription);
  const setEditingSubscription = useUIStore((state) => state.setEditingSubscription);
  const searchParams = useSearchParams();
  const editSubscriptionId = searchParams.get("editSubscriptionId");
  const copySubscriptionId = editSubscriptionId ? null : searchParams.get("copySubscriptionId");

  const showAiColumn = Boolean(user?.aiAssistantEnabled);
  const [authChecked, setAuthChecked] = React.useState(false);

  const subscription = useSubscriptionLink({
    authChecked,
    user,
    fetchUser,
    clearUser,
    subscriptionAdapter: adapter?.subscription,
    generatedYaml,
    editingSubscription,
    setEditingSubscription,
    appliedTemplateId,
    template,
    storeSources,
    nodes,
    deletedNodeNames,
    deletedNodes,
    enabledProxyGroups,
    hiddenProxyGroups,
    customRules,
    customProxyGroups,
    customRuleSets,
    builtinRuleEdits,
    moduleRuleEditWarningAccepted,
    ruleOrder,
    dialerProxyGroups,
    proxyGroupNameOverrides,
    listenerPorts,
    dnsYaml,
    ruleProviderBaseUrl,
    testUrl,
    testInterval,
    cnIpNoResolve,
    experimentalCnUseCnRuleSet,
  });
  const { setSubscriptionName, setSubscriptionUrl, setCopied } = subscription;

  React.useEffect(() => {
    let cancelled = false;
    fetchUser()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchUser]);

  React.useEffect(() => {
    setConfigDraftUserScope(userId);
    const scopedState = useConfigStore.getState();
    if (!scopedState.nodes.length && !scopedState.sources.some((source) => source.content.trim())) {
      useConfigStore.setState({ savedConfigSnapshot: getConfigSnapshot(scopedState) });
    }
    if (!userId) return;

    const handoff = consumeAuthConfigHandoff();
    if (!handoff) return;

    useConfigStore.setState((state) => ({
      ...state,
      ...handoff,
      parseErrors: [],
      isLoading: false,
      generatedYaml: "",
      generatedYamlError: null,
      history: [],
      historyIndex: -1,
    }));
    useConfigStore.getState().generateConfig();
  }, [userId]);

  React.useEffect(() => {
    if (!authChecked || !user) return;
    adapter?.onAuthenticatedUserReady?.({ user });
  }, [adapter, authChecked, user]);

  useCleanNewSubscriptionIntent({
    authChecked,
    searchParams,
    setCopied,
    setEditingSubscription,
    setSubscriptionName,
    setSubscriptionUrl,
  });

  const { isLoading: isLoadingEditingSubscription, error: subscriptionLoadError } = useEditingSubscriptionLoader({
    editSubscriptionId,
    copySubscriptionId,
    loadSubscription: adapter?.loadSubscription,
    loginHref: adapter?.loginHref ?? adapter?.subscription?.loginHref,
    setCopied,
    setEditingSubscription,
    setStoreSources,
    setSubscriptionName,
    setSubscriptionUrl,
  });

  const { handleDownload, handleGenerate, hasValidSources } = useHomeActions({
    generatedYaml,
    generatedYamlError,
    appliedTemplateId,
    recordConfigDownload: adapter?.recordConfigDownload,
    storeSources,
    nodes,
    clearNodes,
    parseMultipleSources,
    generateConfig,
  });

  return (
    <HomeLayout
      showAiColumn={showAiColumn}
      user={user}
      authChecked={authChecked}
      editingSubscription={editingSubscription}
      isLoadingEditingSubscription={isLoadingEditingSubscription}
      subscriptionLoadError={subscriptionLoadError}
      editSubscriptionId={editSubscriptionId}
      copySubscriptionId={copySubscriptionId}
      generatedYaml={generatedYaml}
      generatedYamlError={generatedYamlError}
      configLoading={configLoading || storeSources.some((source) => source.parsing)}
      pendingSourceCount={storeSources.filter(isSourcePendingImport).length}
      hasImportedNodes={nodes.length > 0}
      hasValidSources={hasValidSources}
      handleGenerate={handleGenerate}
      handleDownload={handleDownload}
      onGeneratedYamlChange={setGeneratedYaml}
      subscription={subscription}
      noticeSlot={adapter?.renderNotice?.({ user, showAiColumn })}
      renderAnnouncement={adapter?.renderAnnouncement}
      saveRequirementSlot={adapter?.renderSaveRequirementDialog?.({
        open: subscription.saveRequirementDialog,
        onOpenChange: subscription.setSaveRequirementDialog,
        onAccept: subscription.handleAcceptSaveRequirement,
      })}
      templateUploadHref={adapter?.templateUploadHref}
      onTemplateUploadOpen={adapter?.onTemplateUploadOpen}
    />
  );
}

/**
 * SSR 骨架：工作台占位保持大致高度，减少布局抖动。
 */
function HomeSurfaceFallback() {
  return (
    <div className="w-full max-w-[clamp(1200px,95vw,2400px)] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-3 lg:py-5 min-h-[calc(100vh-64px)] flex flex-col">
      <div className="mono-label flex h-[clamp(26rem,60vh,39rem)] items-center justify-center rounded-md border border-white/8 bg-white/[0.02] text-white/30">
        INITIALIZING WORKSPACE…
      </div>
    </div>
  );
}

export function HomeSurface({ adapter }: Props) {
  return (
    <ProductApiAdapterProvider adapter={adapter?.productApi}>
      <ProductInteractionAdapterProvider adapter={adapter?.interactions}>
        <React.Suspense fallback={<HomeSurfaceFallback />}>
          <HomeSurfaceInner adapter={adapter} />
        </React.Suspense>
      </ProductInteractionAdapterProvider>
    </ProductApiAdapterProvider>
  );
}
