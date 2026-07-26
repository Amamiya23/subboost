"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@subboost/ui/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-mono font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-white/15 bg-white/8 text-white/80",
        secondary: "border-white/10 bg-white/5 text-white/65",
        destructive: "border-red-500/25 bg-red-500/8 text-red-300/90",
        outline: "text-white/65 border-white/15 bg-transparent",
        success: "border-emerald-500/20 bg-emerald-500/8 text-emerald-300/90",
        warning: "border-amber-500/25 bg-amber-500/8 text-amber-300/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
