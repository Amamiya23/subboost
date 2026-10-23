"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { CircleAlert, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { getLocalAdminSetupCredentialError, LOCAL_ADMIN_PASSWORD_MIN_LENGTH } from "@local/lib/admin-credentials";
import { Alert } from "@subboost/ui/components/coss/alert";
import { Button } from "@subboost/ui/components/coss/button";
import { Card } from "@subboost/ui/components/coss/card";
import { Field, FieldDescription, FieldLabel } from "@subboost/ui/components/coss/field";
import { Input } from "@subboost/ui/components/coss/input";
import { Skeleton } from "@subboost/ui/components/coss/skeleton";
import { ThemeToggle } from "@subboost/ui/components/layout/theme-toggle";
import { hasAuthConfigHandoff } from "@subboost/ui/store/config-store/auth-handoff";

type AuthState = {
  setupRequired: boolean;
  authenticated: boolean;
};

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function getPostLoginHref(): string {
  return hasAuthConfigHandoff() ? "/builder" : "/";
}

export function LocalLogin() {
  const [auth, setAuth] = React.useState<AuthState | null>(null);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [authRetry, setAuthRetry] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setError("");
    void fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("无法连接服务，请稍后重试");
        const data = await readJson<AuthState>(response);
        if (typeof data.authenticated !== "boolean" || typeof data.setupRequired !== "boolean") {
          throw new Error("无法读取登录状态，请重试");
        }
        return data;
      })
      .then((nextAuth) => {
        if (!cancelled) {
          setAuth(nextAuth);
          if (nextAuth.authenticated) window.location.href = getPostLoginHref();
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "加载失败");
      });
    return () => {
      cancelled = true;
    };
  }, [authRetry]);

  const setupRequired = auth?.setupRequired === true;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const credentialError = setupRequired
      ? getLocalAdminSetupCredentialError({ username, password, passwordConfirm })
      : "";
    if (credentialError) {
      setError(credentialError);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(setupRequired ? "/api/setup/admin" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, passwordConfirm }),
      });
      const data = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "登录失败");
      window.location.href = getPostLoginHref();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute end-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="返回 SubBoost 首页">
            <Image src="/logo.png" alt="" width={44} height={44} className="rounded-lg border bg-card p-1 shadow-sm" />
            <span className="font-heading text-xl font-semibold">SubBoost</span>
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-semibold">
              {setupRequired ? "初始化管理员" : "登录"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {setupRequired ? "创建本地管理员账号" : "继续管理订阅与配置"}
            </p>
          </div>
        </div>

        <Card className="p-6 sm:p-7">
          {auth ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="admin-username">管理员账号</FieldLabel>
                <Input
                  id="admin-username"
                  type="text"
                  size="lg"
                  autoComplete="username"
                  placeholder="输入管理员账号"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-password">密码</FieldLabel>
                <div className="relative w-full">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    size="lg"
                    autoComplete={setupRequired ? "new-password" : "current-password"}
                    aria-describedby={setupRequired ? "local-admin-password-help" : undefined}
                    placeholder="输入密码"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pe-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-1 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </div>
                {setupRequired ? (
                  <FieldDescription id="local-admin-password-help">
                    至少 {LOCAL_ADMIN_PASSWORD_MIN_LENGTH} 个字符
                  </FieldDescription>
                ) : null}
              </Field>
              {setupRequired ? (
                <Field>
                  <FieldLabel htmlFor="admin-password-confirm">确认密码</FieldLabel>
                  <Input
                    id="admin-password-confirm"
                    type={showPassword ? "text" : "password"}
                    size="lg"
                    autoComplete="new-password"
                    placeholder="再次输入密码"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                  />
                </Field>
              ) : null}

              {error ? (
                <Alert variant="error" aria-live="polite">
                  <CircleAlert aria-hidden="true" />
                  <span>{error}</span>
                </Alert>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={loading}
                disabled={!username || !password || (setupRequired && !passwordConfirm)}
              >
                <ShieldCheck aria-hidden="true" />
                {setupRequired ? "创建管理员" : "登录"}
              </Button>
            </form>
          ) : error ? (
            <div className="flex flex-col gap-4">
              <Alert variant="error">
                <CircleAlert aria-hidden="true" />
                <span>{error}</span>
              </Alert>
              <Button type="button" onClick={() => { setError(""); setAuthRetry((value) => value + 1); }}>
                重试
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3" aria-label="正在加载登录状态">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
