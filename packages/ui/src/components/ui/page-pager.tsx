"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@subboost/ui/components/ui/button";
import { Input } from "@subboost/ui/components/ui/input";
import { cn } from "@subboost/ui/lib/utils";

export type PagePagerProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  disabled?: boolean;
};

export function PagePager({ page, totalPages, onPageChange, className, disabled }: PagePagerProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const isSinglePage = safeTotalPages <= 1;

  const goToPage = (next: number) => {
    const clamped = Math.max(1, Math.min(safeTotalPages, next));
    if (clamped === page) return;
    onPageChange(clamped);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded bg-white/5 hover:bg-white/10"
        onClick={() => goToPage(page - 1)}
        disabled={disabled || page <= 1 || isSinglePage}
        aria-label="上一页"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={safeTotalPages}
          value={page}
          onChange={(e) => {
            const raw = e.target.value;
            if (!raw) return;
            const parsed = Number.parseInt(raw, 10);
            if (!Number.isFinite(parsed)) return;
            goToPage(parsed);
          }}
          className="w-14 h-9 rounded px-2 text-center font-mono text-[13px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          aria-label="页码"
          disabled={disabled || isSinglePage}
        />
        <span className="text-sm text-white/60 whitespace-nowrap">/ {safeTotalPages}</span>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded bg-white/5 hover:bg-white/10"
        onClick={() => goToPage(page + 1)}
        disabled={disabled || page >= safeTotalPages || isSinglePage}
        aria-label="下一页"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
