import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@subboost/ui/lib/utils";

// Small labels need high-contrast step 12 text; paired Radix scales adapt to both themes.
const PROTOCOL_BADGE_COLORS: Record<string, string> = {
  ss: "bg-[var(--blue-2)] text-[color:var(--blue-12)] border-[var(--blue-7)]",
  ssr: "bg-[var(--blue-2)] text-[color:var(--blue-12)] border-[var(--blue-7)]",
  vmess: "bg-[var(--purple-2)] text-[color:var(--purple-12)] border-[var(--purple-7)]",
  vless: "bg-[var(--green-2)] text-[color:var(--green-12)] border-[var(--green-7)]",
  trojan: "bg-[var(--red-2)] text-[color:var(--red-12)] border-[var(--red-7)]",
  anytls: "bg-[var(--teal-2)] text-[color:var(--teal-12)] border-[var(--teal-7)]",
  hysteria2: "bg-[var(--orange-2)] text-[color:var(--orange-12)] border-[var(--orange-7)]",
  hy2: "bg-[var(--orange-2)] text-[color:var(--orange-12)] border-[var(--orange-7)]",
  tuic: "bg-[var(--cyan-2)] text-[color:var(--cyan-12)] border-[var(--cyan-7)]",
  socks5: "bg-[var(--gray-2)] text-[color:var(--gray-12)] border-[var(--gray-7)]",
  socks4: "bg-[var(--gray-2)] text-[color:var(--gray-12)] border-[var(--gray-7)]",
  http: "bg-[var(--amber-2)] text-[color:var(--amber-12)] border-[var(--amber-7)]",
  https: "bg-[var(--amber-2)] text-[color:var(--amber-12)] border-[var(--amber-7)]",
  ssh: "bg-[var(--pink-2)] text-[color:var(--pink-12)] border-[var(--pink-7)]",
  relay: "bg-[var(--violet-2)] text-[color:var(--violet-12)] border-[var(--violet-7)]",
};

const DEFAULT_PROTOCOL_BADGE_CLASS = "bg-[var(--gray-2)] text-[color:var(--gray-12)] border-[var(--gray-7)]";

export function getProtocolBadgeClass(type: string | undefined): string {
  const key = (type ?? "").trim().toLowerCase();
  return Object.hasOwn(PROTOCOL_BADGE_COLORS, key) ? PROTOCOL_BADGE_COLORS[key] : DEFAULT_PROTOCOL_BADGE_CLASS;
}

type ProtocolBadgeProps = ComponentPropsWithoutRef<"span"> & {
  type: string | undefined;
};

export function ProtocolBadge({ type, className, ...props }: ProtocolBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium text-center uppercase whitespace-nowrap",
        getProtocolBadgeClass(type),
        className
      )}
      {...props}
    >
      {type}
    </span>
  );
}
