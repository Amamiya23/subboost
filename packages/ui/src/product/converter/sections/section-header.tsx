"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface SectionHeaderProps {
  expanded: boolean;
  onToggle: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
}

export function SectionHeader({
  expanded,
  onToggle,
  icon: Icon,
  title,
  badge,
}: SectionHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-accent transition-colors"
    >
      {expanded ? (
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

