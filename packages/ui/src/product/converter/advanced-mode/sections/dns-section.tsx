"use client";

import * as React from "react";
import { AlertTriangle, Globe } from "lucide-react";
import { DEFAULT_BASE_CONFIG_YAML } from "@subboost/core/config/defaults";
import { parseBaseConfigYaml } from "@subboost/core/generator/base-config";
import { isSubBoostDnsResolver } from "@subboost/core/generator/dns-proxy";
import { Badge } from "@subboost/ui/components/coss/compat/badge";
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Textarea } from "@subboost/ui/components/coss/compat/textarea";
import { useConfigStore } from "@subboost/ui/store/config-store";
import { SectionHeader } from "../section-header";

function usesProxyDns(configYaml: string): boolean {
  const baseConfig = parseBaseConfigYaml(configYaml);
  const dns = baseConfig.dns;
  if (!dns || typeof dns !== "object" || Array.isArray(dns)) return false;
  const config = dns as Record<string, unknown>;
  if (config.enable !== true || !Array.isArray(config.nameserver) || !config.nameserver.length) return false;
  if (!config.nameserver.every(isSubBoostDnsResolver)) return false;

  const allResolversUseProxy = (value: unknown): boolean => {
    if (typeof value === "string") return isSubBoostDnsResolver(value);
    return Array.isArray(value) && value.length > 0 && value.every(isSubBoostDnsResolver);
  };
  for (const field of ["fallback", "direct-nameserver"]) {
    const value = config[field];
    if (value !== undefined && !(Array.isArray(value) && value.length === 0) && !allResolversUseProxy(value)) return false;
  }

  const policy = config["nameserver-policy"] ?? baseConfig["nameserver-policy"];
  if (policy === undefined) return true;
  return policy !== null && typeof policy === "object" && !Array.isArray(policy) && Object.values(policy).every(allResolversUseProxy);
}

export function DnsSection({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { dnsYaml, baseConfigDraft, setBaseConfigDraft, setDnsYaml } = useConfigStore();
  const draft = baseConfigDraft ?? dnsYaml;
  const hasDraft = baseConfigDraft !== null;
  const [error, setError] = React.useState<string | null>(null);
  const editorId = React.useId();
  const proxyDns = React.useMemo(() => {
    try {
      return usesProxyDns(dnsYaml);
    } catch {
      return false;
    }
  }, [dnsYaml]);

  const applyDraft = () => {
    try {
      parseBaseConfigYaml(draft);
      setDnsYaml(draft);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法应用配置，请检查 YAML");
    }
  };

  return (
    <div>
      <SectionHeader
        icon={Globe}
        title="基础与 DNS"
        isExpanded={isExpanded}
        onToggle={onToggle}
        badge={
          <Badge variant="outline" className="ml-auto border-border bg-muted text-muted-foreground">
            {hasDraft ? "未应用" : "YAML"}
          </Badge>
        }
      />
      {isExpanded && (
        <div className="mt-3 space-y-3 sm:pl-6">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {proxyDns ? "业务 DNS 经代理 · TUN 由客户端管理" : "自定义配置"}
            </p>
            <label htmlFor={editorId} className="block text-xs font-medium text-foreground">
              基础与 DNS YAML
            </label>
            <p id={`${editorId}-hint`} className="text-xs text-muted-foreground">
              完整 YAML 编辑；清空会移除基础配置，不会恢复默认。
            </p>
          </div>
          <Textarea
            id={editorId}
            value={draft}
            onChange={(event) => {
              const value = event.target.value;
              setBaseConfigDraft(value === dnsYaml ? null : value);
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={`${editorId}-hint${error ? ` ${editorId}-error` : ""}`}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            className="border-border bg-muted font-mono text-xs [&_textarea]:field-sizing-fixed [&_textarea]:h-72 [&_textarea]:min-h-0 [&_textarea]:max-h-[55dvh] [&_textarea]:resize-y"
          />
          {error && (
            <div id={`${editorId}-error`} role="alert" className="flex items-start gap-2 text-xs text-destructive-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="whitespace-pre-wrap break-words">{error}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBaseConfigDraft(DEFAULT_BASE_CONFIG_YAML === dnsYaml ? null : DEFAULT_BASE_CONFIG_YAML);
                setError(null);
              }}
            >
              恢复默认
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasDraft}
                onClick={() => {
                  setBaseConfigDraft(null);
                  setError(null);
                }}
              >
                取消
              </Button>
              <Button type="button" size="sm" disabled={!hasDraft} onClick={applyDraft}>
                应用修改
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
