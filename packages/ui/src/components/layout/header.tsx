"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  Library,
  HelpCircle,
  Menu,
  X,
  LogIn,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@subboost/ui/lib/utils";
import { UserMenu, type AccountMenuItem } from "@subboost/ui/components/auth/user-menu";
import { captureAuthConfigHandoff } from "@subboost/ui/store/config-store/auth-handoff";
import { useConfigStore } from "@subboost/ui/store/config-store";
import { useUserStore } from "@subboost/ui/store/user-store";

type HeaderMode = "default" | "local";

export type HeaderBrandBadge = {
  label: string;
  href?: string;
  external?: boolean;
  title?: string;
  ariaLabel?: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  authOnly?: boolean;
};

const sharedNavItems: NavItem[] = [
  { href: "/", label: "首页", icon: Home },
  { href: "/dashboard", label: "我的订阅", icon: LayoutDashboard, authOnly: true },
  { href: "/templates", label: "模板库", icon: Library },
];

const defaultNavItems: NavItem[] = [
  ...sharedNavItems,
  { href: "/faq", label: "FAQ", icon: HelpCircle },
];

const localNavItems: NavItem[] = [
  ...sharedNavItems,
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandBadge({ badge, tone = "default" }: { badge: HeaderBrandBadge; tone?: "default" | "new" }) {
  const className = cn(
    "inline-flex w-fit items-center rounded-full border px-1.5 py-[2px] text-[0.68rem] font-medium leading-none backdrop-blur-sm",
    tone === "new"
      ? "border-emerald-300/30 bg-emerald-400/12 text-emerald-100/90 shadow-[0_0_12px_rgba(52,211,153,0.16)]"
      : "border-sky-300/25 bg-sky-400/10 text-sky-100/80 shadow-[0_0_12px_rgba(56,189,248,0.16)]"
  );

  if (badge.href) {
    if (badge.external) {
      return (
        <a
          href={badge.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(className, "transition-colors hover:text-white")}
          title={badge.title}
          aria-label={badge.ariaLabel}
        >
          {badge.label}
        </a>
      );
    }

    return (
      <Link
        href={badge.href}
        className={cn(className, "transition-colors hover:text-white")}
        title={badge.title}
        aria-label={badge.ariaLabel}
      >
        {badge.label}
      </Link>
    );
  }

  return (
    <span className={className} title={badge.title} aria-label={badge.ariaLabel}>
      {badge.label}
    </span>
  );
}

export function Header({
  mode = "default",
  extraBrandBadge = null,
  privilegedMenuItem,
}: {
  mode?: HeaderMode;
  extraBrandBadge?: HeaderBrandBadge | null;
  privilegedMenuItem?: AccountMenuItem;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { user } = useUserStore();
  const canShowPrivilegedItem = Boolean(privilegedMenuItem && user?.isAdmin && !user.isBanned);
  const navItems = mode === "local" ? localNavItems : defaultNavItems;
  const visibleNavItems = user ? navItems : navItems.filter((i) => !i.authOnly);
  const showPrivilegedLink = mode === "default";
  const visiblePrivilegedItem = showPrivilegedLink && canShowPrivilegedItem ? privilegedMenuItem : null;
  const modeBadge: HeaderBrandBadge = {
    label: mode === "local" ? "self-host" : "online",
    title: mode === "local" ? "自部署入口" : "在线入口",
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0a0a0a]/85 border-b border-white/8">
      <div className="w-full max-w-[clamp(1200px,95vw,2400px)] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Link href="/" className="group flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="SubBoost"
                width={28}
                height={28}
                priority
                className="rounded-md transition-opacity group-hover:opacity-90"
              />
              <span className="hidden text-[15px] font-semibold leading-none tracking-tight text-white sm:inline-flex">
                SubBoost
              </span>
            </Link>
            <span className="hidden flex-col items-start justify-center gap-1 leading-none sm:flex">
              {extraBrandBadge && <BrandBadge badge={extraBrandBadge} tone="new" />}
              <BrandBadge badge={modeBadge} />
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-0.5 rounded-md border border-white/8 bg-white/[0.03] p-0.5">
            {visibleNavItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/55 hover:bg-white/8 hover:text-white"
                  )}
                >
                  <item.icon className={cn("h-3.5 w-3.5", isActive ? "text-white/80" : "text-white/40")} />
                  {item.label}
                </Link>
              );
            })}
            {visiblePrivilegedItem && (
              <Link
                href={visiblePrivilegedItem.href}
                className={cn(
                  "ml-0.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  isNavItemActive(pathname, visiblePrivilegedItem.href)
                    ? "bg-white/10 text-white"
                    : "text-white/55 hover:bg-white/8 hover:text-white"
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                {visiblePrivilegedItem.label}
              </Link>
            )}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* User Menu */}
            <UserMenu privilegedMenuItem={privilegedMenuItem} />

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded hover:bg-white/8 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-white/60" />
              ) : (
                <Menu className="w-5 h-5 text-white/60" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/8 py-3">
            <nav className="flex flex-col gap-0.5">
              {visibleNavItems.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded text-[13px] transition-colors",
                      isActive
                        ? "text-white bg-white/8"
                        : "text-white/60 hover:text-white hover:bg-white/8"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
              {visiblePrivilegedItem && (
                <Link
                  href={visiblePrivilegedItem.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-[13px] transition-colors",
                    isNavItemActive(pathname, visiblePrivilegedItem.href)
                      ? "text-white bg-white/8"
                      : "text-white/60 hover:text-white hover:bg-white/8"
                  )}
                >
                  <Shield className="w-4 h-4" />
                  {visiblePrivilegedItem.label}
                </Link>
              )}
              {!user && (
                <Link
                  href="/login"
                  onClick={() => {
                    captureAuthConfigHandoff(useConfigStore.getState());
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded text-[13px] text-white/70 hover:text-white hover:bg-white/8 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  登录
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
