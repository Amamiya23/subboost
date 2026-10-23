"use client";

import * as React from "react";
import {
  Textarea as CossTextarea,
  type TextareaProps,
} from "@subboost/ui/components/coss/textarea";

export type { TextareaProps };

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (props, ref) => <CossTextarea ref={ref} {...props} />,
);

Textarea.displayName = "Textarea";
