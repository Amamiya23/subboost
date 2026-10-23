"use client";

import * as React from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { PROXY_GROUP_MODULES } from "@subboost/core/generator/proxy-groups";
import { buildGeneratedRuleEntries } from "@subboost/core/generator/rules";
import type { SubBoostTemplateConfig } from "@subboost/core/types/template-config";
import { Button } from "@subboost/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@subboost/ui/components/ui/dialog";
import { Input } from "@subboost/ui/components/ui/input";
import { Textarea } from "@subboost/ui/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@subboost/ui/components/ui/tabs";
import { confirmDialog } from "@subboost/ui/components/ui/confirm-dialog";
import { toast } from "@subboost/ui/components/ui/toaster";
import { parseTemplateDocument, serializeTemplateDocument } from "./template-document";
import { templateFieldClass, templateOutlineButtonClass, templatePrimaryButtonClass } from "./template-styles";

export type TemplateEditPayload = { name: string; description: string; config: SubBoostTemplateConfig };
export type EditableTemplate = TemplateEditPayload & { id: string; isModified?: boolean };

export function TemplateEditorDialog({ template, canEdit, onClose, onSave, onReset }: {
  template: EditableTemplate;
  canEdit: boolean;
  onClose: () => void;
  onSave: (payload: TemplateEditPayload) => Promise<void>;
  onReset?: () => Promise<void>;
}) {
  const [name, setName] = React.useState(template.name);
  const [description, setDescription] = React.useState(template.description);
  const [source, setSource] = React.useState(() => serializeTemplateDocument(template.config));
  const [busy, setBusy] = React.useState(false);
  const parsed = React.useMemo(() => parseTemplateDocument(source), [source]);
  const config = parsed.ok ? parsed.config : null;
  const rules = React.useMemo(() => config ? buildGeneratedRuleEntries({
    ...config, enabledModules: (config.enabledProxyGroups ?? []).filter((id) => !config.hiddenProxyGroups?.includes(id)), customRules: config.customRules ?? [],
  }) : [], [config]);
  const dirty = name !== template.name || description !== template.description || source !== serializeTemplateDocument(template.config);

  const close = async () => {
    if (busy) return;
    if (canEdit && dirty && !await confirmDialog({ title: "放弃尚未保存的修改？", confirmText: "放弃修改", variant: "destructive" })) return;
    onClose();
  };
  const save = async () => {
    if (!canEdit || !parsed.ok || !name.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), config: parsed.config });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "保存失败", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!onReset || busy || !await confirmDialog({ title: "恢复内置模板？保存的修改将被清除。", confirmText: "恢复内置" })) return;
    setBusy(true);
    try { await onReset(); } catch (error) {
      toast({ title: error instanceof Error ? error.message : "恢复失败", variant: "destructive" });
    } finally { setBusy(false); }
  };
  const toggleGroup = (id: string) => {
    if (!canEdit || !config || busy) return;
    const groups = config.enabledProxyGroups ?? [];
    const isEnabled = groups.includes(id) && !config.hiddenProxyGroups?.includes(id);
    if (isEnabled && groups.filter((item) => !config.hiddenProxyGroups?.includes(item)).length <= 1) return;
    setSource(serializeTemplateDocument({
      ...config,
      enabledProxyGroups: isEnabled ? groups.filter((item) => item !== id) : Array.from(new Set([...groups, id])),
      hiddenProxyGroups: (config.hiddenProxyGroups ?? []).filter((item) => item !== id),
    }));
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) void close(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] sm:max-w-4xl border-[var(--gray-6)] bg-[var(--gray-2)] text-[var(--gray-12)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--gray-12)]">{canEdit ? "编辑模板" : "查看模板"}</DialogTitle>
          <DialogDescription className="text-[var(--gray-11)]">{template.name}</DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>模板名称</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} readOnly={!canEdit} maxLength={100} className={templateFieldClass} />
            </label>
            <label className="space-y-2 text-sm">
              <span>描述</span>
              <Input value={description} onChange={(event) => setDescription(event.target.value)} readOnly={!canEdit} maxLength={500} className={templateFieldClass} />
            </label>
          </div>
          <Tabs defaultValue="groups" className="space-y-4">
            <TabsList className="max-w-full border border-[var(--gray-6)] bg-[var(--gray-3)]">
              {[["groups", "代理组"], ["rules", "规则"], ["source", "配置源码"]].map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="text-[var(--gray-11)] data-[state=active]:bg-[var(--gray-5)] data-[state=active]:text-[var(--gray-12)]">{label}</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="groups" className="max-h-[45vh] overflow-y-auto">
              {config && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PROXY_GROUP_MODULES.filter((module) => !module.pinned).map((module) => (
                  <label key={module.id} className="flex items-center gap-3 rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] p-3 text-sm hover:bg-[var(--gray-4)]">
                    <input type="checkbox" checked={Boolean(config.enabledProxyGroups?.includes(module.id) && !config.hiddenProxyGroups?.includes(module.id))} disabled={!canEdit} onChange={() => toggleGroup(module.id)} className="size-4 shrink-0 accent-[var(--lime-9)]" />
                    <span>{config.proxyGroupNameOverrides?.[module.id] || module.name}</span>
                  </label>
                ))}
                {config.customProxyGroups?.map((group) => <div key={group.id} className="rounded-md border border-[var(--gray-6)] p-3 text-sm">{group.name}</div>)}
              </div>}
            </TabsContent>
            <TabsContent value="rules" className="max-h-[45vh] overflow-y-auto">
              <ol className="divide-y divide-[var(--gray-6)]">
                {rules.map((rule) => <li key={rule.key} className="break-all py-2 font-mono text-xs text-[var(--gray-11)]">{rule.text}</li>)}
              </ol>
            </TabsContent>
            <TabsContent value="source">
              <label className="sr-only" htmlFor="template-config-source">模板配置（YAML）</label>
              <Textarea id="template-config-source" value={source} onChange={(event) => setSource(event.target.value)} readOnly={!canEdit} spellCheck={false} className={`h-[42vh] min-h-64 resize-y font-mono text-xs leading-6 ${templateFieldClass}`} aria-invalid={!parsed.ok} aria-describedby={!parsed.ok ? "template-config-error" : undefined} />
            </TabsContent>
          </Tabs>
          {!parsed.ok && <p id="template-config-error" role="alert" className="whitespace-pre-wrap text-sm text-[var(--red-11)]">{parsed.error}</p>}
        </fieldset>
        <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
          <div>{canEdit && template.isModified && onReset && <Button variant="outline" onClick={() => void reset()} disabled={busy} className={templateOutlineButtonClass}><RotateCcw />恢复内置</Button>}</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => void close()} disabled={busy} className={templateOutlineButtonClass}>{canEdit ? "取消" : "关闭"}</Button>
            {canEdit && <Button onClick={() => void save()} disabled={busy || !parsed.ok || !name.trim() || !dirty} className={templatePrimaryButtonClass}>{busy ? <Loader2 className="animate-spin" /> : <Save />}保存修改</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
