"use client";

import * as React from "react";
import { cn } from "@subboost/ui/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150 resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
