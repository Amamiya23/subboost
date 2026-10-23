import * as React from "react";
import { Globe, Heart, Loader2 } from "lucide-react";
import { Button } from "@subboost/ui/components/ui/button";
import { Input } from "@subboost/ui/components/ui/input";
import { Card } from "@subboost/ui/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@subboost/ui/components/ui/dialog";
import { cn } from "@subboost/ui/lib/utils";
import { useConfigStore, type SubBoostTemplateConfig } from "@subboost/ui/store/config-store";
import type { TemplateType } from "@subboost/core/types/config";
import { useUserStore } from "@subboost/ui/store/user-store";
import { BUILTIN_TEMPLATE_IDS } from "@subboost/core/templates/builtin";
import { toast } from "@subboost/ui/components/ui/toaster";
import { useProductApiAdapter, type QuickTemplateSummary } from "@subboost/ui/product/api-adapter";
import { useProductInteractionAdapter } from "@subboost/ui/product/interactions";
import { templates } from "./constants";

export function TemplatesSection() {
  const [catalogOpen, setCatalogOpen] = React.useState(false);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [catalogTemplates, setCatalogTemplates] = React.useState<Array<{ id: string; name: string; description: string }>>([]);
  const [catalogSearch, setCatalogSearch] = React.useState("");
  const [catalogApplyingId, setCatalogApplyingId] = React.useState<string | null>(null);

  const { template: selectedTemplate, setTemplate, applyTemplateConfig, setAppliedTemplateId } = useConfigStore();
  const { user } = useUserStore();
  const templateApi = useProductApiAdapter().templates;
  const interactions = useProductInteractionAdapter();
  const templateLabels = templateApi?.labels;
  const catalogName = templateLabels?.catalogName ?? "模板目录";
  const catalogDescription = templateLabels?.catalogDescription ?? "选择并应用目录中的配置模板";
  const catalogSelectAction = templateLabels?.catalogSelectAction ?? "从目录选择";
  const engagementAction = templateLabels?.engagementAction ?? "收藏";
  const engagementLoginRequired = templateLabels?.engagementLoginRequired ?? "登录后可收藏";
  const loadBuiltinTemplateEngagement = templateApi?.loadBuiltinTemplateEngagement;
  const loadCatalogTemplates = templateApi?.loadCatalogTemplates;
  const catalogEnabled =
    templateApi?.catalogEnabled !== false &&
    Boolean(loadCatalogTemplates && templateApi?.loadTemplateDetail);
  const builtinEngagementEnabled =
    templateApi?.builtinEngagementEnabled !== false &&
    Boolean(loadBuiltinTemplateEngagement && templateApi?.toggleTemplateEngagement);

  const [builtinEngagement, setBuiltinEngagement] = React.useState<Record<TemplateType, { id: string; engagementCount: number; isEngaged: boolean }>>({
    minimal: { id: BUILTIN_TEMPLATE_IDS.minimal, engagementCount: 0, isEngaged: false },
    standard: { id: BUILTIN_TEMPLATE_IDS.standard, engagementCount: 0, isEngaged: false },
    full: { id: BUILTIN_TEMPLATE_IDS.full, engagementCount: 0, isEngaged: false },
  });
  const [builtinApplying, setBuiltinApplying] = React.useState<TemplateType | null>(null);
  const [builtinSummaries, setBuiltinSummaries] = React.useState<Record<string, QuickTemplateSummary>>({});
  const loadBuiltinTemplates = templateApi?.loadBuiltinTemplates;

  React.useEffect(() => {
    if (!loadBuiltinTemplates) return;
    let cancelled = false;
    void loadBuiltinTemplates().then((items) => {
      if (!cancelled) setBuiltinSummaries(Object.fromEntries(items.map((item) => [item.id, item])));
    }).catch(() => { /* Keep the bundled labels available when the server is unreachable. */ });
    return () => { cancelled = true; };
  }, [loadBuiltinTemplates, user?.id]);

  const selectBuiltinTemplate = async (type: TemplateType) => {
    if (!templateApi?.loadTemplateDetail) {
      setTemplate(type);
      interactions.templateSelected?.({ source: "builtin", templateType: type });
      return;
    }
    setBuiltinApplying(type);
    try {
      const detail = await templateApi.loadTemplateDetail(BUILTIN_TEMPLATE_IDS[type]);
      if (detail?.kind !== "config" || !detail.config || typeof detail.config !== "object") throw new Error("无法读取默认模板");
      setAppliedTemplateId(BUILTIN_TEMPLATE_IDS[type]);
      applyTemplateConfig(detail.config as SubBoostTemplateConfig);
      interactions.templateSelected?.({ source: "builtin", templateType: type });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "应用模板失败，请稍后重试", variant: "destructive" });
    } finally {
      setBuiltinApplying(null);
    }
  };

  React.useEffect(() => {
    if (!loadBuiltinTemplateEngagement) return;
    let cancelled = false;
    const run = async () => {
      try {
        const ids = [BUILTIN_TEMPLATE_IDS.minimal, BUILTIN_TEMPLATE_IDS.standard, BUILTIN_TEMPLATE_IDS.full].join(",");
        const stats = await loadBuiltinTemplateEngagement(ids.split(","));
        if (cancelled) return;
        setBuiltinEngagement({
          minimal: stats.minimal ?? { id: BUILTIN_TEMPLATE_IDS.minimal, engagementCount: 0, isEngaged: false },
          standard: stats.standard ?? { id: BUILTIN_TEMPLATE_IDS.standard, engagementCount: 0, isEngaged: false },
          full: stats.full ?? { id: BUILTIN_TEMPLATE_IDS.full, engagementCount: 0, isEngaged: false },
        });
      } catch {
        // ignore
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadBuiltinTemplateEngagement, user?.id]);

  const toggleBuiltinEngagement = async (type: TemplateType) => {
    if (!user || !templateApi?.toggleTemplateEngagement) return;
    const tpl = builtinEngagement[type];
    if (!tpl?.id) return;

    try {
      const data = await templateApi.toggleTemplateEngagement(tpl.id);
      setBuiltinEngagement((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          isEngaged: !!data.isEngaged,
          engagementCount: typeof data.engagementCount === "number" ? data.engagementCount : prev[type].engagementCount,
        },
      }));
      interactions.templateEngagementToggled?.({ source: "builtin", engaged: !!data.isEngaged });
    } catch {
      toast({ title: "操作失败", variant: "destructive" });
    }
  };

  React.useEffect(() => {
    if (!catalogOpen || !loadCatalogTemplates) return;

    let cancelled = false;
    const run = async () => {
      setCatalogLoading(true);
      try {
        const templates = await loadCatalogTemplates();
        if (!cancelled) setCatalogTemplates(templates);
      } catch (e) {
        console.error(e);
        if (!cancelled) setCatalogTemplates([]);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadCatalogTemplates, catalogOpen]);

  const filteredCatalogTemplates = React.useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalogTemplates;
    return catalogTemplates.filter((t) => {
      const name = (t.name || "").toLowerCase();
      const desc = (t.description || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [catalogTemplates, catalogSearch]);

  React.useEffect(() => {
    const q = catalogSearch.trim();
    if (!catalogOpen || !q) return;

    const timer = window.setTimeout(() => {
      interactions.templateSearchCompleted?.({
        source: "catalog",
        resultCount: filteredCatalogTemplates.length,
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [filteredCatalogTemplates.length, catalogOpen, catalogSearch, interactions]);

  const handleApplyCatalogTemplate = async (id: string) => {
    if (!templateApi?.loadTemplateDetail) return;
    setCatalogApplyingId(id);
    try {
      const tpl = await templateApi.loadTemplateDetail(id);
      if (!tpl) {
        interactions.templateApplied?.({
          source: "catalog",
          kind: "unknown",
          result: "runtimeError",
        });
        toast({ title: "获取模板失败", variant: "destructive" });
        return;
      }

      if (tpl.kind === "config" && tpl.config && typeof tpl.config === "object") {
        setAppliedTemplateId(id);
        applyTemplateConfig(tpl.config as SubBoostTemplateConfig);
        setCatalogOpen(false);
        setCatalogSearch("");
        interactions.templateApplied?.({
          source: "catalog",
          kind: "config",
          result: "success",
        });
        toast({ title: `已应用模板：${tpl.name || "未命名模板"}`, variant: "success" });
        return;
      }

      interactions.templateApplied?.({
        source: "catalog",
        kind: tpl.kind === "yaml" ? "yaml" : "unknown",
        result: "validationError",
      });
      toast({
        title: "YAML 模板无法一键应用到配置器。请使用“配置模板”重新发布。",
        variant: "warning",
      });
    } catch (e) {
      console.error(e);
      interactions.templateApplied?.({
        source: "catalog",
        kind: "unknown",
        result: "runtimeError",
      });
      toast({ title: "应用模板失败，请稍后重试", variant: "destructive" });
    } finally {
      setCatalogApplyingId(null);
    }
  };

  return (
    <>
      {/* Template Selection */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-bone/85">选择模板</p>
        <div className="grid gap-2">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={cn(
                "relative rounded-lg p-3 sm:p-3.5 cursor-pointer transition-colors border focus-within:ring-2 focus-within:ring-acid/60",
                selectedTemplate === template.id ? "border-acid/35 bg-acid/5" : "border-bone/10 bg-transparent hover:border-bone/25 hover:bg-bone/3"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="builtin-template"
                    id={`builtin-template-${template.id}`}
                    checked={selectedTemplate === template.id}
                    disabled={builtinApplying !== null}
                    onChange={() => void selectBuiltinTemplate(template.id)}
                    className="size-4 shrink-0 accent-acid"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <label htmlFor={`builtin-template-${template.id}`} className="cursor-pointer text-sm font-medium text-white after:absolute after:inset-0">{builtinSummaries[BUILTIN_TEMPLATE_IDS[template.id]]?.name ?? template.name}</label>
                      {builtinEngagementEnabled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleBuiltinEngagement(template.id);
                          }}
                          disabled={!user}
                          className={cn(
                            "relative z-10 inline-flex items-center gap-0.5 text-xs transition-colors",
                            builtinEngagement[template.id]?.isEngaged ? "text-red-400" : "text-white/40 hover:text-red-400",
                            !user && "cursor-not-allowed opacity-50"
                          )}
                          title={user ? engagementAction : engagementLoginRequired}
                        >
                          <Heart className={cn("h-3 w-3", builtinEngagement[template.id]?.isEngaged && "fill-current")} />
                          <span>{builtinEngagement[template.id]?.engagementCount ?? 0}</span>
                        </button>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-ink-600 mt-1">{builtinSummaries[BUILTIN_TEMPLATE_IDS[template.id]]?.description ?? template.description}</p>
                  </div>
                </div>
                <div className="shrink-0 pl-3 text-right text-xs text-ink-600 tabular-nums space-y-1">
                  <div>{builtinApplying === template.id ? <Loader2 aria-label="应用中" className="ml-auto h-4 w-4 animate-spin" /> : `${builtinSummaries[BUILTIN_TEMPLATE_IDS[template.id]]?.proxyGroupCount ?? template.groups} 代理组`}</div>
                  <div>{builtinSummaries[BUILTIN_TEMPLATE_IDS[template.id]]?.ruleCount ?? template.rules} 规则集</div>
                </div>
              </div>
            </Card>
          ))}

          {catalogEnabled && (
            <button
              type="button"
              className="rounded-lg p-3 sm:p-3.5 text-left cursor-pointer transition-colors border border-dashed border-bone/15 hover:border-bone/30 bg-transparent focus-visible:ring-2 focus-visible:ring-acid/60"
              onClick={() => {
                setCatalogOpen(true);
                interactions.templateCatalogOpened?.({ mode: "quick" });
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 flex items-center justify-center flex-shrink-0">
                    <Globe className="h-3 w-3 text-white/65" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-white">{catalogName}</span>
                    <p className="text-xs text-white/40 mt-0.5 truncate">{catalogDescription}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-white/40 flex-shrink-0">
                  <div>{catalogSelectAction}</div>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{catalogName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="搜索模板..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="text-sm"
            />

            {catalogLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
              </div>
            ) : filteredCatalogTemplates.length === 0 ? (
              <div className="text-center py-10 text-sm text-white/50">暂无可用模板</div>
            ) : (
              <div className="max-h-[420px] overflow-auto custom-scrollbar space-y-2 pr-1">
                {filteredCatalogTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{t.name}</div>
                      <div className="text-xs text-white/50 mt-1 line-clamp-2">{t.description || ""}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => void handleApplyCatalogTemplate(t.id)}
                      disabled={catalogApplyingId === t.id}
                      className="flex-shrink-0"
                    >
                      {catalogApplyingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "使用"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
