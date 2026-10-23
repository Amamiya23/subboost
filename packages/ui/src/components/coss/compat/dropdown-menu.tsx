"use client";

import * as React from "react";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuPortal,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
  type MenuPrimitive,
} from "@subboost/ui/components/coss/menu";

export const DropdownMenu = Menu;
export const DropdownMenuGroup = MenuGroup;
export const DropdownMenuPortal = MenuPortal;
export const DropdownMenuSub = MenuSub;
export const DropdownMenuSubContent = MenuSubPopup;
export const DropdownMenuSubTrigger = MenuSubTrigger;
export const DropdownMenuRadioGroup = MenuRadioGroup;
export const DropdownMenuCheckboxItem = MenuCheckboxItem;
export const DropdownMenuRadioItem = MenuRadioItem;
export const DropdownMenuLabel = MenuGroupLabel;
export const DropdownMenuSeparator = MenuSeparator;
export const DropdownMenuShortcut = MenuShortcut;
export const DropdownMenuContent = MenuPopup;

type TriggerProps = React.ComponentPropsWithoutRef<typeof MenuTrigger> & {
  asChild?: boolean;
};

export const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, TriggerProps>(
  ({ asChild = false, children, render, ...props }, ref) => (
    <MenuTrigger
      ref={ref}
      render={asChild ? (React.Children.only(children) as React.ReactElement) : render}
      {...props}
    >
      {asChild ? undefined : children}
    </MenuTrigger>
  ),
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

type ItemProps = MenuPrimitive.Item.Props & {
  asChild?: boolean;
  onSelect?: (event: React.MouseEvent<HTMLElement>) => void;
};

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, ItemProps>(
  ({ asChild = false, onSelect, onClick, children, render, ...props }, ref) => (
    <MenuItem
      ref={ref}
      render={asChild ? (React.Children.only(children) as React.ReactElement) : render}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.(event);
      }}
      {...props}
    >
      {asChild ? undefined : children}
    </MenuItem>
  ),
);
DropdownMenuItem.displayName = "DropdownMenuItem";
