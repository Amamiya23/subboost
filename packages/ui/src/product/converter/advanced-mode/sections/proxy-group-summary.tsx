"use client";

import { cn } from "@subboost/ui/lib/utils";

export type ProxyGroupSummaryItem = {
  label: string;
  tone?: "muted" | "accent" | "success" | "info" | "warning" | "disabled";
  separator?: "dot" | "arrow";
};

const toneClass: Record<NonNullable<ProxyGroupSummaryItem["tone"]>, string> = {
  muted: "text-white/55",
  accent: "text-white",
  success: "text-emerald-300",
  info: "text-sky-300",
  warning: "text-amber-300",
  disabled: "text-white/30",
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
        "proxy-group-summary-text min-w-0 max-w-full flex-wrap items-center gap-x-1 gap-y-1 leading-none text-white/45",
        className
      )}
    >
      {items.map((item, index) => (
        <span key={`${item.label}:${index}`} className="inline-flex min-w-0 max-w-full items-center gap-1">
          {index > 0 && (
            <span className="shrink-0 text-white/25">
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
