"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@subboost/ui/components/ui/button";
import { SafeImage } from "@subboost/ui/components/ui/safe-image";
import { captureAuthConfigHandoff } from "@subboost/ui/store/config-store/auth-handoff";
import { useConfigStore } from "@subboost/ui/store/config-store";
import { useUserStore } from "@subboost/ui/store/user-store";
import {
  LogIn,
  LogOut,
  User as UserIcon,
  Settings,
  LayoutDashboard,
  ChevronDown,
  Shield,
} from "lucide-react";

export type AccountMenuItem = {
  href: string;
  label: string;
};

export function UserMenu({ privilegedMenuItem }: { privilegedMenuItem?: AccountMenuItem }) {
  const { user, isLoading: userLoading, fetchUser, logout: userLogout } = useUserStore();
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (user) await userLogout();
    setIsOpen(false);
    window.location.href = "/";
  };

  const isLoading = userLoading && !user;

  if (isLoading) {
    return (
      <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
    );
  }

  // 未登录
  if (!user) {
    return (
      <Link href="/login" onClick={() => captureAuthConfigHandoff(useConfigStore.getState())}>
        <Button size="sm" className="gap-2">
          <LogIn className="h-4 w-4" />
          登录
        </Button>
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/8 transition-colors"
      >
        <SafeImage
          src={user.avatarUrl}
          alt={user.name || user.username}
          className="h-8 w-8 rounded-full border border-white/15"
          fallback={
            <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
              <UserIcon className="h-4 w-4 text-white/70" />
            </div>
          }
        />
        <span className="text-[13px] font-medium hidden sm:block">{user.name || user.username}</span>
        <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 rounded-md bg-[#1a1a1a] border border-white/10 shadow-xl shadow-black/40 py-2 z-50">
            {/* User Info Header */}
            <div className="px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-3">
                <SafeImage
                  src={user.avatarUrl}
                  alt={user.name || user.username}
                  className="h-11 w-11 rounded-full border border-white/15"
                  fallback={
                    <div className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-white/70" />
                    </div>
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{user.name || user.username}</p>
                  <p className="text-[11px] text-white/40 truncate">@{user.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-white/5 text-white/65 border border-white/10">
                  <Shield className="h-3 w-3" />
                  <span>Lv.{user.trustLevel}</span>
                </div>
                {user.isAdmin && !user.isBanned && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-white/10 text-white/85 border border-white/15">
                    <Shield className="h-3 w-3" />
                    <span>管理员</span>
                  </div>
                )}
                <div className="text-[11px] text-white/40 font-mono">
                  {user.subscriptionCount}/{user.quota.maxSubscriptions} 订阅
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {privilegedMenuItem && user.isAdmin && !user.isBanned && (
                <Link
                  href={privilegedMenuItem.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-[13px] text-white/75 hover:bg-white/8 hover:text-white transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  {privilegedMenuItem.label}
                </Link>
              )}
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                我的订阅
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Settings className="h-4 w-4" />
                账户设置
              </Link>
            </div>

            {/* Logout */}
            <div className="border-t border-white/10 pt-1">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
