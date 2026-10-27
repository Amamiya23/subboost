"use client";

import * as React from "react";
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Alert, AlertDescription, AlertTitle } from "@subboost/ui/components/coss/alert";
import { useUserStore } from "@subboost/ui/store/user-store";

type Settings = { url: string; username: string; path: string; hasPassword: boolean; lastBackupAt: string | null; lastError: string | null };
type Result = { settings?: Settings | null; createdAt?: string; subscriptions?: number; templates?: number; error?: string };
const initialConfig = { url: "", username: "", password: "", path: "subboost/backup.enc.json" };

async function readResponse(response: Response): Promise<Result> {
  const result = await response.json().catch(() => null) as Result | null;
  if (!response.ok || !result) throw new Error(result?.error || "备份请求失败，请稍后重试");
  return result;
}

export function WebDavBackupCard() {
  const fetchUser = useUserStore((state) => state.fetchUser);
  const [config, setConfig] = React.useState(initialConfig);
  const [hasPassword, setHasPassword] = React.useState(false);
  const [status, setStatus] = React.useState<Settings | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [confirmRestore, setConfirmRestore] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    fetch("/api/backup/webdav", { cache: "no-store" }).then(readResponse).then((result) => {
      if (!active) return;
      if (result.settings) {
        setStatus(result.settings);
        setConfig({ url: result.settings.url, username: result.settings.username, path: result.settings.path, password: "" });
        setHasPassword(result.settings.hasPassword);
      }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "读取备份设置失败"); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const run = async (action: "save" | "test" | "backup" | "restore") => {
    setError(""); setMessage("");
    setBusy(action);
    try {
      const result = await readResponse(await fetch("/api/backup/webdav", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, config,
          ...(action === "restore" ? { confirmRestore: true } : {}) }),
      }));
      if (action === "save") {
        if (result.settings) {
          setStatus(result.settings);
          setConfig({ url: result.settings.url, username: result.settings.username, path: result.settings.path, password: "" });
          setHasPassword(true);
        }
        setMessage("设置已保存，已启用每小时自动备份");
      } else if (action === "test") setMessage("WebDAV 连接成功；备份时会创建子目录并验证写入权限");
      else {
        const date = result.createdAt ? new Date(result.createdAt).toLocaleString() : "";
        setMessage((action === "backup" ? "备份成功" : "恢复成功") + "：" + result.subscriptions + " 个订阅、" + result.templates + " 个个人模板（" + date + "）");
        setConfirmRestore(false);
        if (action === "backup") setStatus((current) => current ? { ...current, lastBackupAt: result.createdAt || null, lastError: null } : current);
        if (action === "restore") await fetchUser();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "备份操作失败"); }
    finally { setBusy(null); }
  };
  const disabled = !!busy || !loaded;

  return (
    <section aria-labelledby="webdav-backup-title" className="grid min-w-0 gap-6 py-8 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-12">
      <div className="min-w-0">
        <h2 id="webdav-backup-title" className="font-medium">WebDAV 加密备份</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">保存设置后每小时自动备份订阅和个人模板。仅当前账号登录后可恢复。</p>
      </div>
      <div className="min-w-0 max-w-xl space-y-5" aria-busy={!!busy || !loaded}>
        <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
          <legend className="sr-only">WebDAV 连接设置</legend>
          <label className="flex min-w-0 flex-col gap-2 text-sm sm:col-span-2" htmlFor="webdav-url"><span>WebDAV 地址</span>
            <Input id="webdav-url" type="url" placeholder="https://dav.example.com/dav/" value={config.url} onChange={(event) => setConfig({ ...config, url: event.target.value })} autoComplete="off" /></label>
          <label className="flex min-w-0 flex-col gap-2 text-sm" htmlFor="webdav-username"><span>用户名</span>
            <Input id="webdav-username" value={config.username} onChange={(event) => setConfig({ ...config, username: event.target.value })} autoComplete="off" /></label>
          <label className="flex min-w-0 flex-col gap-2 text-sm" htmlFor="webdav-password"><span>WebDAV 密码 / 应用专用密码</span>
            <Input id="webdav-password" type="password" value={config.password} placeholder={hasPassword ? "已保存，留空保留原密码" : "输入 WebDAV 密码"} onChange={(event) => setConfig({ ...config, password: event.target.value })} autoComplete="new-password" /></label>
          <div className="flex min-w-0 flex-col gap-2 text-sm sm:col-span-2"><label htmlFor="webdav-path">备份文件路径（相对于 WebDAV 地址）</label>
            <Input id="webdav-path" aria-describedby="webdav-path-hint" value={config.path} onChange={(event) => setConfig({ ...config, path: event.target.value })} placeholder="subboost/backup.enc.json" autoComplete="off" />
            <span id="webdav-path-hint" className="block text-xs leading-5 text-muted-foreground">文件自动存入账号子目录，每次覆盖。地址需为公网 HTTPS，基础目录需已存在。</span></div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={disabled} onClick={() => void run("test")}>{busy === "test" ? "测试中…" : "测试连接"}</Button>
          <Button variant="outline" disabled={disabled} onClick={() => void run("save")}>{busy === "save" ? "保存中…" : "保存连接设置"}</Button>
        </div>
        <div className="space-y-5 border-t pt-6">
          <p className="text-sm leading-6 text-muted-foreground">无需备份密码。迁移时需保留原账号数据和部署加密密钥；重新注册同名账号无法恢复。旧密码备份请先使用旧版本恢复。</p>
          {status && <p className="text-sm text-muted-foreground">{status.lastBackupAt ? "最近备份：" + new Date(status.lastBackupAt).toLocaleString() : "自动备份已启用，等待首次执行"}</p>}
          {status?.lastError && <p role="alert" className="text-sm text-destructive">自动备份失败：{status.lastError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={disabled} onClick={() => void run("backup")}>{busy === "backup" ? "备份中…" : "立即备份"}</Button>
            <Button variant="outline" disabled={disabled} onClick={() => setConfirmRestore(true)}>从此文件恢复…</Button>
          </div>
          {confirmRestore && <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/8 p-4">
            <p className="text-sm text-warning-foreground">恢复将覆盖当前账号的全部订阅和个人模板，并保留备份中的订阅令牌。请确认已备份当前数据。</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" disabled={disabled} onClick={() => void run("restore")}>{busy === "restore" ? "解密并恢复中…" : "确认覆盖并恢复"}</Button>
              <Button variant="outline" disabled={disabled} onClick={() => setConfirmRestore(false)}>取消</Button>
            </div>
          </div>}
        </div>
        {message && (
          <Alert variant="success">
            <AlertTitle>操作完成</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="error">
            <AlertTitle>操作失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </section>
  );
}
