"use client";

import * as React from "react";
import Link from "next/link";
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
import { BrandMark } from "@subboost/ui/components/brand-mark";
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
    <header
      className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") setMobileMenuOpen(false);
      }}
    >
      <div className="mx-auto w-full max-w-[clamp(1120px,94vw,1800px)] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4">
          {/* Logo */}
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/" className="group flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">
              <BrandMark className="size-7 shrink-0 text-foreground transition-opacity group-hover:opacity-90" />
              <span className="font-display text-base font-semibold leading-none text-foreground">
                SubBoost
              </span>
            </Link>
            {extraBrandBadge && <span className="hidden sm:inline-flex"><BrandBadge badge={extraBrandBadge} tone="new" /></span>}
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="主导航" className="hidden items-center gap-1 rounded-lg bg-muted p-1 md:flex">
            {visibleNavItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-[var(--gray-5)] text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon aria-hidden="true" className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
            {visiblePrivilegedItem && (
              <Link
                href={visiblePrivilegedItem.href}
                aria-current={isNavItemActive(pathname, visiblePrivilegedItem.href) ? "page" : undefined}
                className={cn(
                  "ml-0.5 inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  isNavItemActive(pathname, visiblePrivilegedItem.href)
                    ? "bg-[var(--gray-5)] text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Shield aria-hidden="true" className="size-3.5" />
                {visiblePrivilegedItem.label}
              </Link>
            )}
          </nav>

          {/* Right Side Actions */}
          <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
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
              aria-controls={mobileMenuOpen ? "mobile-header-navigation" : undefined}
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
          <div id="mobile-header-navigation" className="border-t py-3 md:hidden">
            <nav aria-label="移动主导航" className="flex flex-col gap-1">
              {visibleNavItems.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-[var(--gray-5)] text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon aria-hidden="true" className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
              {visiblePrivilegedItem && (
                <Link
                  href={visiblePrivilegedItem.href}
                    aria-current={isNavItemActive(pathname, visiblePrivilegedItem.href) ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    isNavItemActive(pathname, visiblePrivilegedItem.href)
                      ? "bg-[var(--gray-5)] text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Shield aria-hidden="true" className="size-4" />
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
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
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
