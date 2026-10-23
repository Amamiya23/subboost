"use client";

import * as React from "react";
import { Layers } from "lucide-react";
import { Badge } from "@subboost/ui/components/coss/compat/badge";
import { PROXY_GROUP_MODULES } from "@subboost/core/generator/proxy-groups";
import { isPinnedModule } from "@subboost/core/generator/rules";
import { useConfigStore } from "@subboost/ui/store/config-store";
import { SectionHeader } from "../section-header";
import { ProxyGroupsCategories } from "./proxy-groups-categories";

export function ProxyGroupsSection({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { enabledProxyGroups, hiddenProxyGroups } = useConfigStore();
  const hiddenIds = new Set(hiddenProxyGroups);
  const isEnabledAndVisible = (id: string) => !hiddenIds.has(id) && !isPinnedModule(id);
  const enabledCount = enabledProxyGroups.filter(isEnabledAndVisible).length;
  const totalCount = PROXY_GROUP_MODULES.filter((module) => isEnabledAndVisible(module.id)).length;

  return (
    <div>
      <SectionHeader
        icon={Layers}
        title="分流代理组"
        isExpanded={isExpanded}
        onToggle={onToggle}
        badge={
          <Badge variant="outline" className="ml-auto border-info/30 bg-info/10 text-info-foreground">
            {enabledCount}/{totalCount}
          </Badge>
        }
      />

      {isExpanded && (
        <div className="mt-2 space-y-2 pl-6">
          <ProxyGroupsCategories />
        </div>
      )}
    </div>
  );
}
