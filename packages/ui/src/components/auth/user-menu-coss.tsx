"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  LogIn,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@subboost/ui/components/coss/button";
import { Badge } from "@subboost/ui/components/coss/badge";
import {
  Menu,
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@subboost/ui/components/coss/menu";
import { SafeImage } from "@subboost/ui/components/ui/safe-image";
import { captureAuthConfigHandoff } from "@subboost/ui/store/config-store/auth-handoff";
import { useConfigStore } from "@subboost/ui/store/config-store";
import { useUserStore } from "@subboost/ui/store/user-store";

export type AccountMenuItem = {
  href: string;
  label: string;
};

export function UserMenu({ privilegedMenuItem }: { privilegedMenuItem?: AccountMenuItem }) {
  const { user, isLoading, fetchUser, logout } = useUserStore();

  React.useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  if (isLoading && !user) {
    return <div className="size-8 animate-pulse rounded-full bg-muted" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <Button
        size="sm"
        render={<Link href="/login" />}
        onClick={() => captureAuthConfigHandoff(useConfigStore.getState())}
      >
        <LogIn aria-hidden="true" />
        登录
      </Button>
    );
  }

  const displayName = user.name || user.username;

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2" aria-label="打开账户菜单" />
        }
      >
        <SafeImage
          src={user.avatarUrl}
          alt={displayName}
          className="size-7 rounded-full border"
          fallback={
            <span className="flex size-7 items-center justify-center rounded-full bg-muted">
              <UserIcon aria-hidden="true" />
            </span>
          }
        />
        <span className="hidden max-w-24 truncate lg:block">{displayName}</span>
        <ChevronDown aria-hidden="true" className="hidden size-3.5 text-muted-foreground lg:block" />
      </MenuTrigger>
      <MenuPopup align="end" sideOffset={8} className="w-72 max-w-[calc(100vw-2rem)] rounded-xl">
        <div className="flex items-center gap-3 px-3 py-3">
          <SafeImage
            src={user.avatarUrl}
            alt={displayName}
            className="size-10 shrink-0 rounded-full border"
            fallback={
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserIcon aria-hidden="true" />
              </span>
            }
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold" title={displayName}>{displayName}</p>
              {user.isAdmin && !user.isBanned ? <Badge variant="info" className="shrink-0">管理员</Badge> : null}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={`@${user.username}`}>@{user.username}</p>
          </div>
          <MenuLinkItem
            render={<Link href="/dashboard/settings" />}
            aria-label="账户设置"
            title="账户设置"
            className="size-8 shrink-0 self-start justify-center rounded-md p-0 text-muted-foreground data-highlighted:text-foreground"
          >
            <Settings aria-hidden="true" className="size-4" />
          </MenuLinkItem>
        </div>
        <MenuSeparator />
        {privilegedMenuItem && user.isAdmin && !user.isBanned ? (
          <>
            <MenuLinkItem render={<Link href={privilegedMenuItem.href} />}>
              <Settings aria-hidden="true" />
              {privilegedMenuItem.label}
            </MenuLinkItem>
            <MenuSeparator />
          </>
        ) : null}
        <MenuItem
          variant="destructive"
          className="min-h-9 rounded-md px-3 sm:min-h-9"
          onClick={() => {
            void logout().finally(() => {
              window.location.href = "/";
            });
          }}
        >
          <LogOut aria-hidden="true" />
          退出登录
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
