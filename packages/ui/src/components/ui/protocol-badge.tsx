import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@subboost/ui/lib/utils";
import { getNodeProtocolParts, type NodeProtocolDetails } from "@subboost/ui/lib/node-protocol-label";

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
  node?: NodeProtocolDetails;
};

export function ProtocolBadge({ type, node, className, ...props }: ProtocolBadgeProps) {
  const parts = node ? getNodeProtocolParts(node) : { protocol: type ?? "" };
  const chips = [
    { key: "protocol", label: parts.protocol, color: getProtocolBadgeClass(type) },
    { key: "transport", label: parts.transport, color: DEFAULT_PROTOCOL_BADGE_CLASS },
    {
      key: "security",
      label: parts.security,
      color: parts.security === "REALITY"
        ? "bg-[var(--violet-2)] text-[color:var(--violet-12)] border-[var(--violet-7)]"
        : "bg-[var(--cyan-2)] text-[color:var(--cyan-12)] border-[var(--cyan-7)]",
    },
  ].filter((chip) => chip.label);
  const label = chips.map((chip) => chip.label).join(" ");
  return (
    <span
      className={cn("inline-flex max-w-full shrink-0 flex-wrap items-center gap-1 align-middle", className)}
      role="group"
      aria-label={label}
      title={label}
      {...props}
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded border px-1.5 py-0.5 text-center text-[10px] font-medium uppercase",
            chip.color
          )}
        >
          {chip.label}
        </span>
      ))}
    </span>
  );
}
