"use client";

import * as React from "react";
import { ArrowRightLeft, Trash2 } from "lucide-react";
import { Badge } from "@subboost/ui/components/coss/compat/badge";
import { Button } from "@subboost/ui/components/coss/compat/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@subboost/ui/components/coss/compat/dropdown-menu";
import { cn } from "@subboost/ui/lib/utils";
import type { CustomRule } from "@subboost/core/types/config";
import type {
  CustomRuleListItem,
  ProxyGroupRuleTarget,
  ProxyGroupRuleTargetKind,
} from "./proxy-group-rule-targets";

export type RuleSetMoveTarget = ProxyGroupRuleTarget & { kind: "module" | "custom" };
export type ProxyGroupRuleRowState = "active" | "moved" | "removed";

type RuleSource = "preset" | "custom" | "manual" | "experimental";

export function isRuleSetMoveTarget(target: ProxyGroupRuleTarget): target is RuleSetMoveTarget {
  return target.kind === "module" || target.kind === "custom";
}

type ProxyGroupRuleRowProps = {
  title: string;
  detail: string;
  detailTitle?: string;
  state?: ProxyGroupRuleRowState;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
};

const targetKindLabels: Record<ProxyGroupRuleTargetKind, string> = {
  module: "内置组",
  custom: "自定义组",
};

const emptyTargetLabels: Record<ProxyGroupRuleTargetKind, string> = {
  module: "暂无内置组",
  custom: "暂无自定义组",
};

export function ProxyGroupRuleRow({
  title,
  detail,
  detailTitle,
  state = "active",
  badges,
  actions,
}: ProxyGroupRuleRowProps) {
  const isInactive = state !== "active";
  const isMoved = state === "moved";

  return (
    <div
      className={cn(
        "proxy-group-rule-row grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 rounded border border-border bg-muted/[0.04] px-2 py-2",
        isInactive &&
          (isMoved
            ? "border-warning/30 bg-warning/10"
            : "border-destructive/30 bg-destructive/10"),
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <span
            className={cn(
              "min-w-0 break-words text-xs font-medium leading-5",
              isInactive
                ? cn(
                    "text-muted-foreground line-through",
                    isMoved ? "decoration-orange-300/70" : "decoration-red-300/70"
                  )
                : "text-foreground"
            )}
            title={title}
          >
            {title}
          </span>
          {isInactive && <RuleStateBadge state={state} />}
          {badges}
        </div>

        <div
          className={cn(
            "min-w-0 break-all font-mono text-[10px]",
            isInactive
              ? cn(
                  "text-muted-foreground line-through",
                  isMoved ? "decoration-orange-300/50" : "decoration-red-300/50",
                )
              : "text-muted-foreground",
          )}
          title={detailTitle || detail}
        >
          {detail}
        </div>
      </div>

      {actions && <div className="flex shrink-0 items-center justify-end gap-1.5">{actions}</div>}
    </div>
  );
}

export function ProxyGroupRuleSetRow({
  name,
  path,
  source,
  behavior,
  noResolve,
  state = "active",
  actions,
}: {
  name: string;
  path: string;
  source: Exclude<RuleSource, "manual">;
  behavior: "domain" | "ipcidr";
  noResolve?: boolean;
  state?: ProxyGroupRuleRowState;
  actions?: React.ReactNode;
}) {
  return (
    <ProxyGroupRuleRow
      title={name}
      detail={path}
      detailTitle={`${name} · ${path}`}
      state={state}
      badges={
        <>
          {state === "active" && <RuleSourceBadge source={source} />}
          <RuleBehaviorBadge behavior={behavior} />
          {noResolve && <NoResolveBadge />}
        </>
      }
      actions={actions}
    />
  );
}

export function ProxyGroupManualRuleRow({
  item,
  targets,
  currentTargetName,
  onMove,
  onRemove,
}: {
  item: CustomRuleListItem;
  targets: ProxyGroupRuleTarget[];
  currentTargetName: string;
  onMove: (item: CustomRuleListItem, target: ProxyGroupRuleTarget) => void;
  onRemove: (item: CustomRuleListItem) => void;
}) {
  const { rule } = item;
  const detail = buildManualRuleDetail(rule);

  return (
    <ProxyGroupRuleRow
      title={rule.value}
      detail={detail}
      detailTitle={detail}
      badges={
        <>
          <RuleSourceBadge source="manual" />
          <RuleTextBadge>{rule.type}</RuleTextBadge>
          {rule.noResolve && <NoResolveBadge />}
        </>
      }
      actions={
        <>
          <ProxyGroupRuleMoveMenu
            title="移动规则"
            ariaLabel={`移动 ${rule.value} 规则`}
            targets={targets}
            kinds={["module", "custom"]}
            currentTarget={{ name: currentTargetName }}
            onMove={(target) => onMove(item, target)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-destructive-foreground"
            title="删除规则"
            aria-label={`删除 ${rule.value} 规则`}
            onClick={() => onRemove(item)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      }
    />
  );
}

export function ProxyGroupRuleMoveMenu({
  title,
  ariaLabel,
  targets,
  kinds,
  currentTarget,
  onMove,
}: {
  title: string;
  ariaLabel: string;
  targets: ProxyGroupRuleTarget[];
  kinds: ProxyGroupRuleTargetKind[];
  currentTarget?: Partial<ProxyGroupRuleTarget>;
  onMove: (target: ProxyGroupRuleTarget) => void | Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground/85"
          title={title}
          aria-label={ariaLabel}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-border bg-popover text-popover-foreground shadow-lg">
        {kinds.map((kind, index) => {
          const groupTargets = targets.filter((target) => target.kind === kind);
          return (
            <React.Fragment key={kind}>
              {index > 0 && <DropdownMenuSeparator className="bg-muted" />}
              <DropdownMenuLabel className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {targetKindLabels[kind]}
              </DropdownMenuLabel>
              {groupTargets.length === 0 ? (
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                  {emptyTargetLabels[kind]}
                </DropdownMenuItem>
              ) : (
                groupTargets.map((target) => (
                  <DropdownMenuItem
                    key={`${target.kind}:${target.id}`}
                    disabled={isCurrentTarget(target, currentTarget)}
                    className="text-xs text-muted-foreground focus:bg-muted focus:text-foreground"
                    onSelect={() => {
                      void onMove(target);
                    }}
                  >
                    {target.name}
                  </DropdownMenuItem>
                ))
              )}
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RuleStateBadge({ state }: { state: Exclude<ProxyGroupRuleRowState, "active"> }) {
  const isMoved = state === "moved";
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-1.5 py-0 text-[9px]",
        isMoved
          ? "border-warning/30 bg-warning/10 text-warning-foreground"
          : "border-destructive/30 bg-destructive/10 text-destructive-foreground",
      )}
    >
      {isMoved ? "已移动" : "已移除"}
    </Badge>
  );
}

function RuleSourceBadge({ source }: { source: RuleSource }) {
  const className = {
    preset: "border-border bg-info/10 text-info-foreground",
    custom: "border-success/30 bg-success/10 text-success-foreground",
    manual: "border-border bg-muted text-foreground/85",
    experimental: "border-warning/30 bg-warning/10 text-warning-foreground",
  }[source];
  const label = {
    preset: "预设",
    custom: "自定义",
    manual: "自定义",
    experimental: "实验性",
  }[source];

  return (
    <Badge variant="outline" className={cn("px-1.5 py-0 text-[9px]", className)}>
      {label}
    </Badge>
  );
}

function RuleBehaviorBadge({ behavior }: { behavior: "domain" | "ipcidr" }) {
  return <RuleTextBadge>{behavior === "ipcidr" ? "IP" : "域名"}</RuleTextBadge>;
}

function RuleTextBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="outline" className="border-border bg-muted px-1.5 py-0 text-[9px] text-muted-foreground">
      {children}
    </Badge>
  );
}

function NoResolveBadge() {
  return (
    <Badge variant="outline" className="border-warning/30 bg-warning/10 px-1.5 py-0 text-[9px] text-warning-foreground">
      no-resolve
    </Badge>
  );
}

function isCurrentTarget(target: ProxyGroupRuleTarget, currentTarget?: Partial<ProxyGroupRuleTarget>) {
  if (!currentTarget) return false;
  if (currentTarget.kind && currentTarget.id) {
    return currentTarget.kind === target.kind && currentTarget.id === target.id;
  }
  return Boolean(currentTarget.name && currentTarget.name === target.name);
}

function buildManualRuleDetail(rule: CustomRule) {
  return [rule.type, rule.value, rule.target, rule.noResolve ? "no-resolve" : ""]
    .filter(Boolean)
    .join(",");
}
