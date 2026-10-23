"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@subboost/ui/components/coss/button";
import { Badge } from "@subboost/ui/components/coss/badge";
import {
  Menu,
  MenuGroup,
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
          <Button variant="ghost" className="h-auto gap-2 px-2 py-1.5" aria-label="打开账户菜单" />
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
        <span className="hidden max-w-32 truncate sm:block">{displayName}</span>
        <ChevronDown aria-hidden="true" className="hidden sm:block" />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-64">
        <div className="flex items-center gap-3 px-3 py-3">
          <SafeImage
            src={user.avatarUrl}
            alt={displayName}
            className="size-10 rounded-full border"
            fallback={
              <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                <UserIcon aria-hidden="true" />
              </span>
            }
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          <Badge variant="secondary">
            <Shield aria-hidden="true" />
            Lv.{user.trustLevel}
          </Badge>
          {user.isAdmin && !user.isBanned ? <Badge variant="info">管理员</Badge> : null}
          <Badge variant="outline">
            {user.subscriptionCount}/{user.quota.maxSubscriptions} 订阅
          </Badge>
        </div>
        <MenuSeparator />
        <MenuGroup>
          {privilegedMenuItem && user.isAdmin && !user.isBanned ? (
            <MenuLinkItem render={<Link href={privilegedMenuItem.href} />}>
              <Settings aria-hidden="true" />
              {privilegedMenuItem.label}
            </MenuLinkItem>
          ) : null}
          <MenuLinkItem render={<Link href="/dashboard" />}>
            <LayoutDashboard aria-hidden="true" />
            我的订阅
          </MenuLinkItem>
          <MenuLinkItem render={<Link href="/dashboard/settings" />}>
            <Settings aria-hidden="true" />
            账户设置
          </MenuLinkItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuItem
          variant="destructive"
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
