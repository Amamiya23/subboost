"use client";

import * as React from "react";
import {
  Dialog as CossDialog,
  DialogClose,
  DialogContent as CossDialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPanel,
  DialogPortal,
  DialogTitle,
  DialogTrigger as CossDialogTrigger,
} from "@subboost/ui/components/coss/dialog";
import { cn } from "@subboost/ui/lib/utils";

export {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPanel,
  DialogPortal,
  DialogTitle,
};

export const Dialog = CossDialog;

type DialogTriggerProps = React.ComponentPropsWithoutRef<typeof CossDialogTrigger> & {
  asChild?: boolean;
};

export const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ asChild = false, children, render, ...props }, ref) => (
    <CossDialogTrigger
      ref={ref}
      render={asChild ? (React.Children.only(children) as React.ReactElement) : render}
      {...props}
    >
      {asChild ? undefined : children}
    </CossDialogTrigger>
  ),
);
DialogTrigger.displayName = "DialogTrigger";

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof CossDialogContent>
>(({ className, ...props }, ref) => (
  <CossDialogContent
    ref={ref}
    className={cn("max-h-[90dvh] max-w-xl overflow-y-auto", className)}
    {...props}
  />
));
DialogContent.displayName = "DialogContent";
