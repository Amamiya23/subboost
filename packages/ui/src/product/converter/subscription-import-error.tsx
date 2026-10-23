"use client";

import * as React from "react";
import { AlertCircle, Clock, Copy, ChevronRight, Menu } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@subboost/ui/components/coss/compat/dialog";
import { cn } from "@subboost/ui/lib/utils";
import { toast } from "@subboost/ui/components/coss/compat/toaster";
import { formatInBeijing } from "@subboost/core/time/beijing";
import {
  getSubscriptionImportErrorBadgeText,
  getSubscriptionImportErrorCategoryLabel,
  normalizeSubscriptionImportErrorInfo,
  sanitizePublicErrorText,
  type SubscriptionImportErrorInfo,
} from "@subboost/core/subscription/import-error";

interface ErrorDetailDialogProps {
  error: SubscriptionImportErrorInfo;
  children: React.ReactNode;
}

function ErrorDetailDialog({ error, children }: ErrorDetailDialogProps) {
  const categoryLabel = error.isUserFacingReason ? "提示信息" : getSubscriptionImportErrorCategoryLabel(error.category);
  const timestamp = (() => {
    return formatInBeijing(
      error.at,
      {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      },
      "未知时间"
    );
  })();
  const message = sanitizePublicErrorText(error.message) || "导入失败";
  const technicalDetail = sanitizePublicErrorText(error.detail);
  const showTechnicalDetail = Boolean(technicalDetail && technicalDetail !== message);

  const copyText = async (text: string, successTitle = "已复制") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: successTitle });
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive-foreground" />
            导入错误
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive-foreground border border-destructive/30">
              {categoryLabel}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timestamp}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">{error.isUserFacingReason ? "提示内容" : "错误信息"}</span>
              <button
                type="button"
                onClick={() => copyText(message)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <Copy className="h-3 w-3" />
                复制
              </button>
            </div>
            <div
              className={cn(
                "rounded-lg p-3 text-xs whitespace-pre-wrap break-all",
                error.isUserFacingReason
                  ? "bg-warning/10 border border-warning/30 text-warning-foreground"
                  : "bg-muted border text-foreground/85 font-mono"
              )}
            >
              {message}
            </div>
          </div>

          {showTechnicalDetail && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">技术细节</span>
                <button
                  type="button"
                  onClick={() => copyText(technicalDetail!, "已复制技术细节")}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  复制
                </button>
              </div>
              <div className="bg-muted border rounded-lg p-3 text-foreground/85 text-xs font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto custom-scrollbar">
                {technicalDetail}
              </div>
            </div>
          )}

          {error.suggestedActions.length > 0 && (
            <div className="space-y-2">
              <span className="text-muted-foreground text-xs">建议操作</span>
              <div className="space-y-1.5">
                {error.suggestedActions.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 rounded-lg bg-muted border border-border/5"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SubscriptionImportErrorBadgeProps {
  errorInfo?: SubscriptionImportErrorInfo | null;
  errorMessage?: string | null;
  className?: string;
  maxChars?: number;
}

export function SubscriptionImportErrorBadge({
  errorInfo,
  errorMessage,
  className,
  maxChars = 6,
}: SubscriptionImportErrorBadgeProps) {
  const normalized = React.useMemo(
    () => normalizeSubscriptionImportErrorInfo(errorInfo ?? errorMessage ?? null),
    [errorInfo, errorMessage]
  );

  if (!normalized) return null;

  const badgeText = getSubscriptionImportErrorBadgeText(normalized, maxChars);

  return (
    <ErrorDetailDialog error={normalized}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none",
          "bg-destructive/10 text-destructive-foreground border border-destructive/30",
          "hover:bg-destructive/10 hover:text-destructive-foreground transition-colors cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-red-500/40",
          className
        )}
        aria-label="查看错误详情"
      >
        <span>{badgeText}</span>
        <Menu className="ml-1 h-3 w-3 text-destructive-foreground" aria-hidden="true" />
      </button>
    </ErrorDetailDialog>
  );
}
