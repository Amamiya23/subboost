"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useUserStore } from "@subboost/ui/store/user-store";
import { WebDavBackupCard } from "@local/components/webdav-backup-card";
import { ChangePasswordForm } from "@local/components/change-password-form";

export default function SettingsPage() {
  const { user, fetchUser, isLoading } = useUserStore();

  React.useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <Link href="/dashboard" className="mb-5 inline-flex min-h-9 items-center gap-2 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft aria-hidden="true" className="size-4" />我的订阅
      </Link>
      <h1 className="font-heading text-2xl font-semibold">账户设置</h1>
      {isLoading ? <div className="mt-8 h-72 animate-pulse rounded-lg bg-muted" aria-label="正在加载账户" aria-busy="true" /> : !user ? (
        <p className="mt-10 text-sm text-muted-foreground">请先<Link href="/login" className="ml-1 text-foreground underline underline-offset-4">登录</Link></p>
      ) : (
        <>
          <section aria-labelledby="account-security" className="mt-8 grid gap-6 border-y py-8 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-12">
            <div className="min-w-0">
              <h2 id="account-security" className="font-medium">登录与安全</h2>
              <p className="mt-2 break-words text-sm text-muted-foreground">{user.username}</p>
            </div>
            <ChangePasswordForm username={user.username} />
          </section>
          <WebDavBackupCard />
          <details className="border-t py-5 text-sm">
            <summary className="w-fit cursor-pointer rounded-sm py-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">运行端点</summary>
            <dl className="mt-4 grid gap-3 text-muted-foreground sm:grid-cols-2">
              <div><dt className="mb-1 text-xs">存活检查</dt><dd><code>/api/health/live</code></dd></div>
              <div><dt className="mb-1 text-xs">就绪检查</dt><dd><code>/api/health/ready</code></dd></div>
            </dl>
          </details>
        </>
      )}
    </div>
  );
}
