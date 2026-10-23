"use client";

import * as React from "react";
import { Label as CossLabel } from "@subboost/ui/components/coss/label";
import { cn } from "@subboost/ui/lib/utils";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<typeof CossLabel>
>(({ className, ...props }, ref) => (
  <CossLabel
    ref={ref}
    className={cn("text-sm text-foreground/80", className)}
    {...props}
  />
));

Label.displayName = "Label";
