"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function SectionHeader({
  icon: Icon,
  title,
  badge,
  isExpanded,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-accent transition-colors"
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">{title}</span>
      {badge}
    </button>
  );
}

