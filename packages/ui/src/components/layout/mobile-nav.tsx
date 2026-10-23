"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Eye, Library, Settings2, User, type LucideIcon } from "lucide-react";
import { cn } from "@subboost/ui/lib/utils";
import { zeroRightClassName } from "react-remove-scroll-bar";
import { useUserStore } from "@subboost/ui/store/user-store";

type MobileNavItem = {
  id: "config" | "preview" | "ai" | "dashboard" | "templates";
  href: string;
  label: string;
  icon: LucideIcon;
  hash?: string;
  authOnly?: boolean;
};

const defaultMobileNavItems: MobileNavItem[] = [
  { id: "config", href: "/builder#config", label: "配置", icon: Settings2, hash: "config" },
  { id: "preview", href: "/builder#preview", label: "预览", icon: Eye, hash: "preview" },
  { id: "ai", href: "/builder#ai", label: "AI", icon: Bot, hash: "ai", authOnly: true },
  { id: "dashboard", href: "/", label: "我的", icon: User },
];

const localMobileNavItems: MobileNavItem[] = [
  { id: "dashboard", href: "/", label: "订阅", icon: User },
  { id: "config", href: "/builder", label: "生成", icon: Settings2 },
  { id: "templates", href: "/templates", label: "模板", icon: Library },
];

export function MobileNav({ mode = "default" }: { mode?: "default" | "local" }) {
  const pathname = usePathname();
  const { user } = useUserStore();
  const [activeHash, setActiveHash] = React.useState<string>("");

  React.useEffect(() => {
    const readHash = () => window.location.hash.replace(/^#/, "");
    const update = () => setActiveHash(readHash());
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  const isBuilder = pathname === "/builder";
  const items = mode === "local" ? localMobileNavItems : defaultMobileNavItems;
  const visibleItems = user ? items : items.filter((i) => !i.authOnly);

  // 只在移动端显示
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t bg-background/92 backdrop-blur-xl md:hidden",
        zeroRightClassName
      )}
    >
      <div className="flex items-center justify-around h-16">
        {visibleItems.map((item) => {
          const isAnchor = Boolean(item.hash);
          const isActive = isAnchor
            ? isBuilder && activeHash === item.hash
            : item.href === "/"
              ? pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/dashboard/")
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(event) => {
                if (item.hash && isBuilder) {
                  event.preventDefault();
                  const el = document.getElementById(item.hash);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${item.hash}`);
                  setActiveHash(item.hash);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("flex size-7 items-center justify-center rounded-md", isActive && "bg-accent")}>
                <item.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
