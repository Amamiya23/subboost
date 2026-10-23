"use client";

import * as React from "react";
import {
  Button as CossButton,
  buttonVariants,
  type ButtonProps as CossButtonProps,
} from "@subboost/ui/components/coss/button";

export interface ButtonProps extends CossButtonProps {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, children, render, ...props }, ref) => {
    const renderedChild = asChild
      ? (React.Children.only(children) as React.ReactElement)
      : render;

    return (
      <CossButton ref={ref} render={renderedChild} {...props}>
        {asChild ? undefined : children}
      </CossButton>
    );
  },
);

Button.displayName = "Button";

export { buttonVariants };
