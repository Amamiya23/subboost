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
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Card, CardContent } from "@subboost/ui/components/coss/compat/card";
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
    <Card className="transition-colors hover:border-ring">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-medium truncate">{template.name}{template.isModified && <span className="ml-2 text-xs text-success-foreground">已修改</span>}</h4>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
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
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive-foreground"
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

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
                template.isEngaged ? "text-destructive-foreground" : "hover:text-destructive-foreground",
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
                  <Globe className="h-3.5 w-3.5 text-success-foreground" />
                  公开
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
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
