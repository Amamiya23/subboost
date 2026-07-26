"use client";

import * as React from "react";
import { ArrowRight, Shield } from "lucide-react";
import type { CustomRoutingRuleSetItem } from "@subboost/core/rules/custom-routing-rule-sets";
import type { CustomRule } from "@subboost/core/types/config";

function ruleTargetToText(target: CustomRule["target"]): string {
  if (typeof target === "string") return target;
  return `${target.kind}:${target.id}`;
}

export function CustomRulesPreview({
  customRules,
  ruleSets = [],
}: {
  customRules: CustomRule[];
  ruleSets?: CustomRoutingRuleSetItem[];
}) {
  const items = React.useMemo(
    () => [
      ...customRules.map((rule) => ({
        key: rule.id || `${rule.type}:${rule.value}`,
        type: rule.type,
        value: rule.value,
        target: ruleTargetToText(rule.target),
        noResolve: Boolean(rule.noResolve),
        title: rule.value,
      })),
      ...ruleSets.map((rule) => ({
        key: rule.key,
        type: "RULE-SET",
        value: rule.name,
        target: rule.target.name,
        noResolve: Boolean(rule.noResolve),
        title: `${rule.name} · ${rule.path}`,
      })),
    ],
    [customRules, ruleSets],
  );

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-white/60">
        <Shield className="h-3.5 w-3.5" />
        <span>自定义规则</span>
        <span className="text-[10px] text-white/50">
          ({items.length})
        </span>
      </div>
      <div className="space-y-1 rounded-lg border border-white/10 bg-white/[0.04] p-2">
        {items.slice(0, 10).map((rule, idx) => (
          <div
            key={rule.key}
            className="flex min-w-0 flex-wrap items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-[10px]"
          >
            <span className="w-5 shrink-0 tabular-nums text-white/40">
              {idx + 1}.
            </span>
            <span className="rounded border border-white/15 bg-white/8 px-1.5 py-0.5 font-medium text-white/80">
              {rule.type}
            </span>
            <span
              className="min-w-0 max-w-[14rem] truncate text-white/70"
              title={rule.title}
            >
              {rule.value}
            </span>
            {rule.noResolve && (
              <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-white/45">
                no-resolve
              </span>
            )}
            <ArrowRight className="h-3 w-3 shrink-0 text-white/35" />
            <span
              className="max-w-[11rem] truncate rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-primary-300"
              title={rule.target}
            >
              {rule.target}
            </span>
          </div>
        ))}
        {items.length > 10 && (
          <div className="py-1 text-center text-[10px] text-white/50">
            ... 还有 {items.length - 10} 条规则
          </div>
        )}
      </div>
    </div>
  );
}
