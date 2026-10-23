"use client";

import * as React from "react";
import { LogOut, ServerCog, ShieldCheck } from "lucide-react";

import { Button } from "@subboost/ui/components/coss/compat/button";
import { Card, CardContent, CardHeader, CardTitle } from "@subboost/ui/components/coss/compat/card";
import { Badge } from "@subboost/ui/components/coss/badge";
import { useUserStore } from "@subboost/ui/store/user-store";
import { WebDavBackupCard } from "@local/components/webdav-backup-card";

export default function SettingsPage() {
  const { user, fetchUser, logout } = useUserStore();

  React.useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold">账户设置</h1>
        <Badge variant="outline">本地部署</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WebDavBackupCard />
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
              <ShieldCheck aria-hidden="true" />
            </div>
            <CardTitle className="text-base">本地管理员</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">用户名</p>
                <p className="mt-1 truncate font-medium">{user?.username || "未登录"}</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">订阅容量</p>
                <p className="mt-1 font-medium tabular-nums">
                  {user ? `${user.subscriptionCount} / ${user.quota.maxSubscriptions}` : "-"}
                </p>
              </div>
            </div>
            <Button variant="destructive-outline" onClick={() => void handleLogout()} disabled={!user}>
              <LogOut aria-hidden="true" />
              退出登录
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-info/10 text-info-foreground">
              <ServerCog aria-hidden="true" />
            </div>
            <CardTitle className="text-base">运行端点</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="text-xs font-medium text-muted-foreground">健康检查端点</p>
            <div>
              <p className="text-xs text-muted-foreground">存活检查</p>
              <code className="mt-1 block rounded-md bg-muted px-3 py-2 text-muted-foreground">/api/health/live</code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">就绪检查</p>
              <code className="mt-1 block rounded-md bg-muted px-3 py-2 text-muted-foreground">/api/health/ready</code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
