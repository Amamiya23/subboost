import yaml from "js-yaml";

export class BaseConfigYamlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaseConfigYamlError";
  }
}

export const GENERATED_CONFIG_SECTION_KEYS = new Set(["proxies", "proxy-groups", "rule-providers", "rules"]);

const PROXY_PORT_KEYS = ["port", "socks-port", "mixed-port", "redir-port", "tproxy-port"];
const TOP_LEVEL_BOOLEAN_KEYS = ["allow-lan", "ipv6", "tcp-concurrent", "unified-delay"];
const DNS_BOOLEAN_KEYS = ["enable", "ipv6", "respect-rules", "use-system-hosts", "prefer-h3"];
const DNS_SERVER_LIST_KEYS = ["nameserver", "default-nameserver", "fallback", "proxy-server-nameserver", "direct-nameserver"];
const TUN_BOOLEAN_KEYS = ["enable", "auto-route", "strict-route"];

function isMapping(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function formatYamlParseError(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as {
      reason?: unknown;
      message?: unknown;
      mark?: { line?: unknown; column?: unknown };
    };
    const reason = typeof record.reason === "string"
      ? record.reason
      : typeof record.message === "string"
        ? record.message
        : String(error);
    const line = typeof record.mark?.line === "number" ? record.mark.line + 1 : null;
    const column = typeof record.mark?.column === "number" ? record.mark.column + 1 : null;
    return line && column ? `${reason}（第 ${line} 行，第 ${column} 列）` : reason;
  }
  return String(error);
}

function fieldError(path: string, requirement: string): never {
  throw new BaseConfigYamlError(`基础和 DNS 配置中的 ${path} ${requirement}。`);
}

function validateBooleans(record: Record<string, unknown>, keys: string[], prefix = "") {
  for (const key of keys) {
    if (record[key] !== undefined && typeof record[key] !== "boolean") {
      fieldError(`${prefix}${key}`, "必须是 true 或 false");
    }
  }
}

function validateStringList(record: Record<string, unknown>, key: string, path: string) {
  const value = record[key];
  if (value === undefined) return;
  if (!Array.isArray(value)) fieldError(path, "必须是字符串数组");
  value.forEach((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      fieldError(`${path}[${index}]`, "必须是非空字符串");
    }
  });
}

function validateBaseConfig(config: Record<string, unknown>) {
  const conflicts = [...GENERATED_CONFIG_SECTION_KEYS].filter((key) => config[key] !== undefined);
  if (conflicts.length) {
    throw new BaseConfigYamlError(
      `基础和 DNS 配置不能包含 ${conflicts.join(", ")}；这些段由 SubBoost 根据节点、代理组和规则生成。`
    );
  }

  for (const key of PROXY_PORT_KEYS) {
    const value = config[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 65535)) {
      fieldError(key, "必须是 0–65535 的整数（0 表示关闭该代理端口）");
    }
  }
  validateBooleans(config, TOP_LEVEL_BOOLEAN_KEYS);

  for (const key of ["dns", "tun", "profile", "sniffer"]) {
    if (config[key] !== undefined && !isMapping(config[key])) fieldError(key, "必须是对象");
  }
  if (isMapping(config.dns)) {
    validateBooleans(config.dns, DNS_BOOLEAN_KEYS, "dns.");
    for (const key of DNS_SERVER_LIST_KEYS) validateStringList(config.dns, key, `dns.${key}`);
  }
  if (isMapping(config.tun)) {
    validateBooleans(config.tun, TUN_BOOLEAN_KEYS, "tun.");
    validateStringList(config.tun, "dns-hijack", "tun.dns-hijack");
  }
}

/** Parse the editable base configuration without filling defaults or changing unknown fields. */
export function parseBaseConfigYaml(configYaml: string): Record<string, unknown> {
  if (!configYaml.trim()) return {};
  let parsed: unknown;
  try {
    parsed = yaml.load(configYaml);
  } catch (error) {
    throw new BaseConfigYamlError(`基础和 DNS 配置 YAML 解析失败：${formatYamlParseError(error)}`);
  }
  if (!isMapping(parsed)) {
    throw new BaseConfigYamlError("基础和 DNS 配置必须是 YAML 对象（顶层 key/value 映射），不能是字符串、数组、数字、布尔值或 null。");
  }
  validateBaseConfig(parsed);
  return parsed;
}
