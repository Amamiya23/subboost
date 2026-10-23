"use client";

import { AlertTriangle, Globe } from "lucide-react";
import { DEFAULT_SUBBOOST_CONFIG } from "@subboost/core/config/defaults";
import { Badge } from "@subboost/ui/components/coss/compat/badge";
import { Textarea } from "@subboost/ui/components/coss/compat/textarea";
import { useConfigStore } from "@subboost/ui/store/config-store";
import { SectionHeader } from "../section-header";

export function DnsSection({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { dnsYaml, generatedYamlError, setDnsYaml } = useConfigStore();

  return (
    <div>
      <SectionHeader
        icon={Globe}
        title="基础和DNS配置"
        isExpanded={isExpanded}
        onToggle={onToggle}
        badge={
          <Badge variant="outline" className="ml-auto border-border bg-muted text-muted-foreground">
            YAML
          </Badge>
        }
      />
      {isExpanded && (
        <div className="mt-2 pl-6">
          <Textarea
            value={dnsYaml}
            onChange={(e) => setDnsYaml(e.target.value)}
            className="font-mono text-xs min-h-[400px] bg-muted border-border"
            placeholder={`# 基础配置
mixed-port: ${DEFAULT_SUBBOOST_CONFIG.mixedPort}
allow-lan: ${DEFAULT_SUBBOOST_CONFIG.allowLan}
...

# DNS 配置
dns:
  enable: true
  ...`}
          />
          {generatedYamlError && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="whitespace-pre-wrap break-words">{generatedYamlError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
