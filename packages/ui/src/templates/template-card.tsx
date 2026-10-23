"use client";

import {
  CheckCircle,
  Clock,
  Download,
  Eye,
  Globe,
  Heart,
  Layers,
  ListChecks,
  Loader2,
  Lock,
  Trash2,
} from "lucide-react";
import { Button } from "@subboost/ui/components/ui/button";
import { Card, CardContent } from "@subboost/ui/components/ui/card";
import { cn } from "@subboost/ui/lib/utils";
import type { Template } from "./types";
import { templateOutlineButtonClass, templatePrimaryButtonClass } from "./template-styles";

export function TemplateCard({
  template,
  formatNumber,
  formatDate,
  engagementActionLabel = "收藏",
  engagementLoginRequiredLabel = "登录后可收藏",
  onEngage,
  onApply,
  onDelete,
  onView,
  viewLabel = "查看",
  isViewing = false,
  isLoggedIn,
  isApplying,
  showDelete,
  showVisibility,
  showEngagement,
}: {
  template: Template;
  formatNumber: (num: number) => string;
  formatDate: (iso: string) => string;
  engagementActionLabel?: string;
  engagementLoginRequiredLabel?: string;
  onEngage: () => void;
  onApply: () => void;
  onDelete?: () => void;
  onView?: () => void;
  viewLabel?: string;
  isViewing?: boolean;
  isLoggedIn: boolean;
  isApplying: boolean;
  showDelete: boolean;
  showVisibility: boolean;
  showEngagement: boolean;
}) {
  const groupCount = typeof template.proxyGroupCount === "number" ? template.proxyGroupCount : null;
  const ruleCount = typeof template.ruleCount === "number" ? template.ruleCount : null;
  return (
    <Card className="border-[var(--gray-6)] bg-[var(--gray-2)] text-[var(--gray-12)] hover:border-[var(--gray-8)] transition-colors">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-medium truncate">{template.name}{template.isModified && <span className="ml-2 text-xs text-[var(--lime-11)]">已修改</span>}</h4>
            <p className="text-sm text-[var(--gray-11)] mt-1 line-clamp-2">{template.description}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onView && <Button variant="outline" size="sm" onClick={onView} disabled={isViewing} className={templateOutlineButtonClass}>
              {isViewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{viewLabel}
            </Button>}
            {showDelete && onDelete && (
              <Button
                variant="outline"
                size="icon"
                onClick={onDelete}
                title="删除"
                aria-label={`删除 ${template.name}`}
                className="h-8 w-8 border-[var(--gray-7)] text-[var(--gray-11)] hover:bg-[var(--red-4)] hover:border-[var(--red-8)] hover:text-[var(--red-11)]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" onClick={onApply} disabled={isApplying} className={`gap-1 ${templatePrimaryButtonClass}`}>
              {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {isApplying ? "应用中" : "使用"}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--gray-11)]">
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            {groupCount ?? "—"} 代理组
          </span>
          <span className="inline-flex items-center gap-1">
            <ListChecks className="h-3.5 w-3.5" />
            {ruleCount ?? "—"} 规则集
          </span>

          <span className="inline-flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />
            {formatNumber(template.downloads)}
          </span>

          {showEngagement && (
            <button
              onClick={onEngage}
              disabled={!isLoggedIn}
              className={cn(
                "inline-flex items-center gap-1 transition-colors",
                template.isEngaged ? "text-[var(--red-11)]" : "hover:text-[var(--red-11)]",
                !isLoggedIn && "cursor-not-allowed opacity-50"
              )}
              title={!isLoggedIn ? engagementLoginRequiredLabel : engagementActionLabel}
            >
              <Heart className={cn("h-3.5 w-3.5", template.isEngaged && "fill-current")} />
              {formatNumber(template.engagementCount)}
            </button>
          )}

          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(template.createdAt)}
          </span>

          {showVisibility && (
            <span className="inline-flex items-center gap-1">
              {template.isPublic ? (
                <>
                  <Globe className="h-3.5 w-3.5 text-[var(--lime-11)]" />
                  公开
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-[var(--gray-11)]" />
                  私有
                </>
              )}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
