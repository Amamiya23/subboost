import type { ClashConfig } from "@subboost/core/types/config";
import { stripProxyGroupEmojiPrefix } from "@subboost/core/proxy-group-name";

export function buildProxyGroupEmojiNameMap(
  names: string[],
  reservedNames: string[] = [],
): Map<string, string> {
  const used = new Set([...names, ...reservedNames, "DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE"]);
  const result = new Map<string, string>();
  for (const name of names) {
    const label = stripProxyGroupEmojiPrefix(name);
    if (label === name || result.has(name)) continue;
    let candidate = label;
    let suffix = 2;
    while (used.has(candidate)) candidate = `${label} (${suffix++})`;
    used.add(candidate);
    result.set(name, candidate);
  }
  return result;
}

/** Rename only generated group policies; preserve the editable source configuration. */
export function withoutProxyGroupEmoji(config: ClashConfig): ClashConfig {
  const names = buildProxyGroupEmojiNameMap(
    (config["proxy-groups"] ?? []).map((group) => group.name),
    (config.proxies ?? []).map((node) => node.name),
  );
  const rename = (name: string) => names.get(name) ?? name;
  const rewriteRule = (rule: string): string => {
    if (rule.startsWith("SUB-RULE,")) return rule;
    const parts = rule.split(",");
    const targetIndex = parts.length - (parts.at(-1)?.trim() === "no-resolve" ? 2 : 1);
    if (targetIndex < 1) return rule;
    parts[targetIndex] = rename(parts[targetIndex].trim());
    return parts.join(",");
  };
  const rewriteDnsServer = (value: string): string => {
    const hashIndex = value.indexOf("#");
    if (hashIndex < 0) return value;
    const parameters = value.slice(hashIndex + 1).split("&").map((parameter) => {
      if (names.has(parameter)) return rename(parameter);
      try {
        const decoded = decodeURIComponent(parameter);
        return names.has(decoded) ? encodeURIComponent(rename(decoded)) : parameter;
      } catch {
        return parameter;
      }
    });
    return `${value.slice(0, hashIndex + 1)}${parameters.join("&")}`;
  };
  const rewrite = (value: unknown, key = "", inDns = false): unknown => {
    if (typeof value === "string") {
      if (key === "proxy" || key === "dialer-proxy") return rename(value);
      return inDns ? rewriteDnsServer(value) : value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === "string" && key === "rules") return rewriteRule(item);
        if (typeof item === "string" && key === "proxies") return rename(item);
        return rewrite(item, key, inDns);
      });
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => {
      if (childKey === "sub-rules" && child && typeof child === "object") {
        return [childKey, Object.fromEntries(Object.entries(child).map(([id, rules]) => [id, rewrite(rules, "rules")]))];
      }
      return [childKey, rewrite(child, childKey, inDns || childKey === "dns")];
    }));
  };
  const output = rewrite(config) as ClashConfig;
  output["proxy-groups"] = output["proxy-groups"]?.map((group) => ({ ...group, name: rename(group.name) }));
  return output;
}
