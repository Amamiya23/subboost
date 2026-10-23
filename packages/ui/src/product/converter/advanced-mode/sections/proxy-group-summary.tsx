"use client";

import { cn } from "@subboost/ui/lib/utils";

export type ProxyGroupSummaryItem = {
  label: string;
  tone?: "muted" | "accent" | "success" | "info" | "warning" | "disabled";
  separator?: "dot" | "arrow";
};

const toneClass: Record<NonNullable<ProxyGroupSummaryItem["tone"]>, string> = {
  muted: "text-muted-foreground",
  accent: "text-foreground",
  success: "text-success-foreground",
  info: "text-info-foreground",
  warning: "text-warning-foreground",
  disabled: "text-muted-foreground",
};

export function ProxyGroupSummary({
  items,
  disabled,
  className,
}: {
  items: ProxyGroupSummaryItem[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "proxy-group-summary-text min-w-0 max-w-full flex-wrap items-center gap-x-1 gap-y-1 leading-none text-muted-foreground",
        className
      )}
    >
      {items.map((item, index) => (
        <span key={`${item.label}:${index}`} className="inline-flex min-w-0 max-w-full items-center gap-1">
          {index > 0 && (
            <span className="shrink-0 text-foreground/25">
              {item.separator === "arrow" ? "→" : "·"}
            </span>
          )}
          <span className={cn("min-w-0 break-words", disabled ? toneClass.disabled : toneClass[item.tone ?? "muted"])}>
            {item.label}
          </span>
        </span>
      ))}
    </div>
  );
}
