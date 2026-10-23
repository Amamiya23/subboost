"use client";

import * as React from "react";
import {
  Select as CossSelect,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectLabel,
  SelectContent,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@subboost/ui/components/coss/select";

type CossSelectProps<Value> = React.ComponentProps<typeof CossSelect<Value>>;

type SelectProps<Value = string> = Omit<CossSelectProps<Value>, "onValueChange"> & {
  onValueChange?: (value: Value) => void;
};

export function Select<Value = string>({
  onValueChange,
  ...props
}: SelectProps<Value>) {
  return (
    <CossSelect
      {...(props as CossSelectProps<Value>)}
      onValueChange={(value) => {
        if (value !== null && !Array.isArray(value)) {
          onValueChange?.(value as Value);
        }
      }}
    />
  );
}

export {
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectLabel,
  SelectContent,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
