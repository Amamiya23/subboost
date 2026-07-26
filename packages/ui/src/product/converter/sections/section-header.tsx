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
      className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors"
    >
      {expanded ? (
        <ChevronDown className="h-4 w-4 text-white/50" />
      ) : (
        <ChevronRight className="h-4 w-4 text-white/50" />
      )}
      <Icon className="h-4 w-4 text-white/60" />
      <span className="text-sm font-medium text-white">{title}</span>
      {badge}
    </button>
  );
}

