"use client";

import * as React from "react";
import {
  Popover as CossPopover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger as CossPopoverTrigger,
} from "@subboost/ui/components/coss/popover";

type PopoverTriggerProps = React.ComponentPropsWithoutRef<typeof CossPopoverTrigger> & {
  asChild?: boolean;
};

function PopoverTrigger({
  asChild = false,
  children,
  render,
  ...props
}: PopoverTriggerProps) {
  return (
    <CossPopoverTrigger
      render={asChild ? (React.Children.only(children) as React.ReactElement) : render}
      {...props}
    >
      {asChild ? undefined : children}
    </CossPopoverTrigger>
  );
}

function PopoverPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function PopoverArrow(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" {...props} />;
}

export const Root = CossPopover;
export const Trigger = PopoverTrigger;
export const Portal = PopoverPortal;
export const Content = PopoverContent;
export const Arrow = PopoverArrow;
export const Close = PopoverClose;
export const Title = PopoverTitle;
export const Description = PopoverDescription;

export const Popover = {
  Root: CossPopover,
  Trigger: PopoverTrigger,
  Portal: PopoverPortal,
  Content: PopoverContent,
  Arrow: PopoverArrow,
  Close: PopoverClose,
  Title: PopoverTitle,
  Description: PopoverDescription,
};
