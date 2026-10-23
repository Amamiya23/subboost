"use client";

import * as Popover from "@subboost/ui/components/coss/compat/popover";
import { HelpCircle } from "lucide-react";

type Props = {
  enabled: boolean;
};

const ENABLED_DESCRIPTION =
  "开启后，刷新订阅时会结合节点名称和参数识别同一节点，尽量保留你的节点顺序、手动改名和相关配置。";
const DISABLED_DESCRIPTION =
  "关闭后，刷新订阅时只按原始节点名判断是否为同一节点。适合遇到新增节点没有出现或节点名称异常保留的情况。";
const SUMMARY_DESCRIPTION = "智能匹配可减少订阅换地址后配置丢失；关闭后更严格按节点名更新，快速找出新节点。";

export function SmartNodeMatchingHelp({ enabled }: Props) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="更新时智能匹配节点说明"
          title="更新时智能匹配节点说明"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50 w-[340px] max-w-[calc(100vw-2rem)] rounded-md border border-border bg-background/88 p-3 shadow-2xl backdrop-blur-md"
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-warning-foreground" />
              <div className="font-medium text-foreground">更新时智能匹配节点</div>
            </div>
            <div className="leading-relaxed text-muted-foreground">
              {enabled ? ENABLED_DESCRIPTION : DISABLED_DESCRIPTION}
            </div>
            <div className="leading-relaxed text-muted-foreground">{SUMMARY_DESCRIPTION}</div>
          </div>
          <Popover.Arrow className="fill-white/10" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
