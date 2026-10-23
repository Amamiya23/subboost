"use client";

import { Globe } from "lucide-react";
import { DEFAULT_SUBBOOST_CONFIG } from "@subboost/core/config/defaults";
import { Textarea } from "@subboost/ui/components/coss/compat/textarea";
import { SectionHeader } from "./section-header";

interface DNSConfigSectionProps {
  expanded: boolean;
  onToggle: () => void;
  dnsYaml: string;
  onDnsYamlChange: (value: string) => void;
}

export function DNSConfigSection({
  expanded,
  onToggle,
  dnsYaml,
  onDnsYamlChange,
}: DNSConfigSectionProps) {
  return (
    <div>
      <SectionHeader
        expanded={expanded}
        onToggle={onToggle}
        icon={Globe}
        title="基础和 DNS 配置"
      />
      {expanded && (
        <div className="mt-2 space-y-2 pl-6">
          <p className="text-[10px] text-muted-foreground mb-1">
            直接编辑 YAML 格式的基础配置（包括 mixed-port、allow-lan、dns、profile、sniffer 等）
          </p>
          <Textarea
            value={dnsYaml}
            onChange={(e) => onDnsYamlChange(e.target.value)}
            placeholder={`# 基础配置示例
mixed-port: ${DEFAULT_SUBBOOST_CONFIG.mixedPort}
allow-lan: ${DEFAULT_SUBBOOST_CONFIG.allowLan}

dns:
  enable: true
  listen: 0.0.0.0:5335
  ...`}
            className="min-h-[200px] max-h-[400px] text-xs font-mono resize-y"
          />
        </div>
      )}
    </div>
  );
}

