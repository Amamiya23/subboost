"use client";

import * as React from "react";
import { ProxyGroupsCustomRules } from "./proxy-groups-custom-rules";
import { ProxyGroupsRulesLibrary } from "./proxy-groups-rules-library";

export function ProxyGroupsCustomRoutingRules() {
  return (
    <div className="space-y-1">
      <div className="flex min-h-7 items-center gap-2">
        <label className="text-xs text-muted-foreground">自定义分流规则</label>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-muted">
        <div className="p-2">
          <ProxyGroupsRulesLibrary />
        </div>
        <div className="border-t border-border" />
        <div className="p-2">
          <ProxyGroupsCustomRules />
        </div>
      </div>
    </div>
  );
}
