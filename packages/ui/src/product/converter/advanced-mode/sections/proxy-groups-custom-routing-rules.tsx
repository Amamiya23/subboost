"use client";

import * as React from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { ProxyGroupsCustomRules } from "./proxy-groups-custom-rules";
import { ProxyGroupsRulesLibrary } from "./proxy-groups-rules-library";

export function ProxyGroupsCustomRoutingRules() {
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [open, setOpen] = React.useState(true);

  return (
    <div className="space-y-1">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-7 w-full items-center gap-1 text-left text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        自定义分流规则
      </button>
      <div hidden={!open} className="overflow-hidden rounded-lg border border-border bg-muted">
        <div className="relative border-b border-border p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="搜索已添加的规则"
            aria-label="搜索已添加的规则"
            className="h-7 border-border bg-muted pl-7 text-xs"
          />
        </div>
        <div className="p-2">
          <ProxyGroupsRulesLibrary searchKeyword={searchKeyword} />
        </div>
        <div className="border-t border-border" />
        <div className="p-2">
          <ProxyGroupsCustomRules searchKeyword={searchKeyword} />
        </div>
      </div>
    </div>
  );
}
