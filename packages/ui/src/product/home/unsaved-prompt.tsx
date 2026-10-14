"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@subboost/ui/components/ui/dialog";
import { Button } from "@subboost/ui/components/ui/button";
import { hasUnsavedConfig } from "./config-save-state";
import { useConfigStore } from "@subboost/ui/store/config-store";

/**
 * 未保存提醒组件
 * 监听页面离开事件，如果有未保存的更改则提示用户
 */
export function UnsavedPrompt() {
  const hasUnsavedChanges = useUnsavedChanges();
  const [showDialog, setShowDialog] = React.useState(false);
  const [pendingNavigation, setPendingNavigation] = React.useState<string | null>(null);
  const router = useRouter();


  // 监听 beforeunload 事件（浏览器关闭/刷新）
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "您有未保存的配置更改，确定要离开吗？";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  React.useEffect(() => {
    const handleLink = (event: MouseEvent) => {
      if (!hasUnsavedChanges || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download") ||
          (anchor.target && anchor.target !== "_self")) return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin ||
          (next.pathname === window.location.pathname && next.search === window.location.search)) return;
      event.preventDefault();
      // 保留链接自身的 onClick（例如登录前保存配置交接），只阻止导航。
      setPendingNavigation(next.pathname + next.search + next.hash);
      setShowDialog(true);
    };
    document.addEventListener("click", handleLink, true);
    return () => document.removeEventListener("click", handleLink, true);
  }, [hasUnsavedChanges]);

  // 处理确认离开
  const handleConfirmLeave = () => {
    setShowDialog(false);
    if (pendingNavigation) {
      router.push(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  // 处理取消离开
  const handleCancelLeave = () => {
    setShowDialog(false);
    setPendingNavigation(null);
  };

  // 暴露方法供外部调用（如导航拦截）
  React.useEffect(() => {
    // 在全局对象上挂载检查函数
    (window as unknown as { __checkUnsavedChanges?: () => boolean }).__checkUnsavedChanges = () => hasUnsavedChanges;
    
    return () => {
      delete (window as unknown as { __checkUnsavedChanges?: () => boolean }).__checkUnsavedChanges;
    };
  }, [hasUnsavedChanges]);

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            未保存的更改
          </DialogTitle>
          <DialogDescription>
            当前配置尚未保存为订阅。离开后无法保证恢复这些修改；下载文件不会保存订阅。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancelLeave}>
            继续编辑
          </Button>
          <Button variant="destructive" onClick={handleConfirmLeave}>
            离开页面
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook: 检查是否有未保存的更改
 */
export function useUnsavedChanges() {
  return useConfigStore(hasUnsavedConfig);
}

