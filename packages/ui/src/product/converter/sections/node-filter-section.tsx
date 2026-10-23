"use client";

import * as React from "react";
import { Filter } from "lucide-react";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Badge } from "@subboost/ui/components/coss/compat/badge";
import { cn } from "@subboost/ui/lib/utils";
import { SectionHeader } from "./section-header";

interface NodeFilterSectionProps {
  expanded: boolean;
  onToggle: () => void;
  filterKeyword: string;
  onFilterChange: (value: string) => void;
  filterMode: "include" | "exclude";
  onFilterModeChange: (mode: "include" | "exclude") => void;
  totalNodes: number;
  filteredCount: number;
}

export function NodeFilterSection({
  expanded,
  onToggle,
  filterKeyword,
  onFilterChange,
  filterMode,
  onFilterModeChange,
  totalNodes,
  filteredCount,
}: NodeFilterSectionProps) {
  const hasFilter = filterKeyword.trim().length > 0;
  const filtered = hasFilter ? filteredCount : totalNodes;

  return (
    <div>
      <SectionHeader
        expanded={expanded}
        onToggle={onToggle}
        icon={Filter}
        title="节点筛选"
        badge={
          hasFilter && totalNodes > 0 && (
            <Badge variant="outline" className="ml-auto text-xs">
              {filtered}/{totalNodes}
            </Badge>
          )
        }
      />
      {expanded && (
        <div className="mt-2 space-y-2 pl-6">
          <div className="space-y-1.5">
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => onFilterModeChange("include")}
                className={cn(
                  "px-2 py-0.5 rounded transition-colors",
                  filterMode === "include"
                    ? "bg-success/10 text-success-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                包含
              </button>
              <button
                onClick={() => onFilterModeChange("exclude")}
                className={cn(
                  "px-2 py-0.5 rounded transition-colors",
                  filterMode === "exclude"
                    ? "bg-destructive/10 text-destructive-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                排除
              </button>
            </div>
            <Input
              value={filterKeyword}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="输入关键词过滤节点..."
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              支持多个关键词，用 | 分隔，例如: 香港|日本|新加坡
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

