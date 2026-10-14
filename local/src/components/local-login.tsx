"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { getLocalAdminSetupCredentialError, LOCAL_ADMIN_PASSWORD_MIN_LENGTH } from "@local/lib/admin-credentials";
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
  return hasAuthConfigHandoff() ? "/" : "/dashboard";
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/logo.png" alt="SubBoost" width={64} height={64} className="rounded-md shadow-lg " />
          </Link>
          <h1 className="text-2xl font-bold mt-4 text-white">欢迎使用 SubBoost</h1>
          <p className="text-white/50 mt-2">{setupRequired ? "初始化本地管理员账号" : "登录以使用订阅管理功能"}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md p-6 space-y-4">
          {auth ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label htmlFor="admin-username" className="block text-sm text-white/80">管理员账号</label>
              <input
                id="admin-username"
                type="text"
                autoComplete="username"
                placeholder="管理员账号"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
              />
              <label htmlFor="admin-password" className="block text-sm text-white/80">密码</label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={setupRequired ? "new-password" : "current-password"}
                  aria-describedby={setupRequired ? "local-admin-password-help" : undefined}
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors pr-12"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {setupRequired ? (
                <p id="local-admin-password-help" className="-mt-1 text-xs text-white/45">
                  至少 {LOCAL_ADMIN_PASSWORD_MIN_LENGTH} 个字符
                </p>
              ) : null}
              {setupRequired ? (
                <label htmlFor="admin-password-confirm" className="block text-sm text-white/80">确认密码</label>
              ) : null}
              {setupRequired ? (
                <input
                  id="admin-password-confirm"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="确认密码"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors"
                />
              ) : null}

              {error ? (
                <p className="text-red-400 text-sm" aria-live="polite">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading || !username || !password || (setupRequired && !passwordConfirm)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 btn-primary"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {setupRequired ? "创建管理员" : "登录"}
              </button>
            </form>
          ) : error ? (
            <div className="space-y-4 text-center">
              <p role="alert" className="text-sm text-red-300">{error}</p>
              <button type="button" className="btn-primary" onClick={() => { setError(""); setAuthRetry((value) => value + 1); }}>
                重试
              </button>
            </div>
          ) : (
            <div className="h-36 animate-pulse rounded-md bg-white/5" />
          )}
        </div>
      </div>
    </div>
  );
}
