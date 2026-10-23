"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Library,
  HelpCircle,
  Menu as MenuIcon,
  X,
  LogIn,
  Settings2,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@subboost/ui/lib/utils";
import { UserMenu, type AccountMenuItem } from "@subboost/ui/components/auth/user-menu-coss";
import { Badge } from "@subboost/ui/components/coss/badge";
import { Button } from "@subboost/ui/components/coss/button";
import { ThemeToggle } from "@subboost/ui/components/layout/theme-toggle";
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
  { href: "/", label: "我的订阅", icon: LayoutDashboard },
  { href: "/builder", label: "配置生成器", icon: Settings2 },
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
  if (href === "/") return pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandBadge({ badge, tone = "default" }: { badge: HeaderBrandBadge; tone?: "default" | "new" }) {
  const className = cn("rounded-full px-2 py-0.5 text-[0.68rem] leading-none", tone === "new" ? "border-success/24" : "border-info/24");

  if (badge.href) {
    if (badge.external) {
      return (
        <Badge
          className={className}
          variant={tone === "new" ? "success" : "info"}
          render={<a href={badge.href} target="_blank" rel="noopener noreferrer" />}
          title={badge.title}
          aria-label={badge.ariaLabel}
        >
          {badge.label}
        </Badge>
      );
    }

    return (
      <Badge
        className={className}
        variant={tone === "new" ? "success" : "info"}
        render={<Link href={badge.href} />}
        title={badge.title}
        aria-label={badge.ariaLabel}
      >
        {badge.label}
      </Badge>
    );
  }

  return (
    <Badge
      className={className}
      variant={tone === "new" ? "success" : "info"}
      title={badge.title}
      aria-label={badge.ariaLabel}
    >
      {badge.label}
    </Badge>
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

  return (
    <header className="sticky top-0 z-50 border-b bg-background/88 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[clamp(1120px,94vw,1800px)] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
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
              <span className="hidden font-display text-base font-semibold leading-none text-foreground sm:inline-flex">
                SubBoost
              </span>
            </Link>
            {extraBrandBadge && <span className="hidden sm:inline-flex"><BrandBadge badge={extraBrandBadge} tone="new" /></span>}
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="主导航" className="hidden items-center gap-1 rounded-lg border bg-card p-1 md:flex">
            {visibleNavItems.map((item, index) => {
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <span className={cn("mono-label", isActive ? "text-success-foreground" : "text-muted-foreground/56")}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                </Link>
              );
            })}
            {visiblePrivilegedItem && (
              <Link
                href={visiblePrivilegedItem.href}
                className={cn(
                  "ml-0.5 inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                  isNavItemActive(pathname, visiblePrivilegedItem.href)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                {visiblePrivilegedItem.label}
              </Link>
            )}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* User Menu */}
            <UserMenu privilegedMenuItem={privilegedMenuItem} />

            {/* Mobile Menu Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={mobileMenuOpen ? "收起导航" : "展开导航"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X aria-hidden="true" />
              ) : (
                <MenuIcon aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t py-3 md:hidden">
            <nav className="flex flex-col gap-0.5">
              {visibleNavItems.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
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
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isNavItemActive(pathname, visiblePrivilegedItem.href)
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
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
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent/60 transition-colors"
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
