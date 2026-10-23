"use client";

import * as React from "react";
import {
  Input as CossInput,
  type InputProps,
} from "@subboost/ui/components/coss/input";

export type { InputProps };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => <CossInput ref={ref} {...props} />,
);

Input.displayName = "Input";
