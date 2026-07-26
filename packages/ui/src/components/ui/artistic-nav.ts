import { cn } from "@subboost/ui/lib/utils";

type ArtisticNavSize = "sm" | "md";

const artisticNavItemSizeClassNames: Record<ArtisticNavSize, string> = {
  sm: "px-2.5 py-1.5 text-[13px]",
  md: "px-3 py-1.5 text-[13px]",
};

const artisticNavItemBaseClassName =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded border border-transparent font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50";

const artisticNavItemActiveClassName =
  "bg-white/10 text-white";

const artisticNavItemInactiveClassName = "text-white/55 hover:bg-white/8 hover:text-white";

export const artisticNavContainerClassName =
  "inline-flex items-center gap-0.5 rounded-md border border-white/8 bg-white/[0.03] p-0.5";

export const artisticTabsListClassName = cn(artisticNavContainerClassName, "h-auto");

export const artisticTabsTriggerClassName = cn(
  "group",
  artisticNavItemBaseClassName,
  artisticNavItemSizeClassNames.md,
  artisticNavItemInactiveClassName,
  "data-[state=active]:bg-white/10 data-[state=active]:text-white"
);

export const artisticTabsIconClassName =
  "h-3.5 w-3.5 text-white/40 transition-colors group-data-[state=active]:text-white/80";

export function getArtisticNavButtonClassName({
  active,
  size = "sm",
  className,
}: {
  active: boolean;
  size?: ArtisticNavSize;
  className?: string;
}) {
  return cn(
    artisticNavItemBaseClassName,
    artisticNavItemSizeClassNames[size],
    active ? artisticNavItemActiveClassName : artisticNavItemInactiveClassName,
    className
  );
}

export function getArtisticNavIconClassName(active: boolean, className?: string) {
  return cn("h-3.5 w-3.5 transition-colors", active ? "text-white/80" : "text-white/40", className);
}
