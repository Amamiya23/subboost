import { cn } from "@subboost/ui/lib/utils";

type ArtisticNavSize = "sm" | "md";

const artisticNavItemSizeClassNames: Record<ArtisticNavSize, string> = {
  sm: "px-2.5 py-1.5 text-[13px]",
  md: "px-3 py-1.5 text-[13px]",
};

const artisticNavItemBaseClassName =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

const artisticNavItemActiveClassName =
  "bg-accent text-accent-foreground";

const artisticNavItemInactiveClassName = "text-muted-foreground hover:bg-accent/60 hover:text-foreground";

export const artisticNavContainerClassName =
  "inline-flex items-center gap-0.5 rounded-lg border bg-muted p-0.5";

export const artisticTabsListClassName = cn(artisticNavContainerClassName, "h-auto");

export const artisticTabsTriggerClassName = cn(
  "group",
  artisticNavItemBaseClassName,
  artisticNavItemSizeClassNames.md,
  artisticNavItemInactiveClassName,
  "data-active:bg-accent data-active:text-accent-foreground"
);

export const artisticTabsIconClassName =
  "size-3.5 text-muted-foreground transition-colors group-data-active:text-foreground";

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
  return cn("size-3.5 transition-colors", active ? "text-foreground" : "text-muted-foreground", className);
}
