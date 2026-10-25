"use client";

import * as React from "react";
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Alert, AlertDescription, AlertTitle } from "@subboost/ui/components/coss/alert";
import { useUserStore } from "@subboost/ui/store/user-store";

type Settings = { url: string; username: string; path: string; hasPassword: boolean };
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
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
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
        setConfig({ url: result.settings.url, username: result.settings.username, path: result.settings.path, password: "" });
        setHasPassword(result.settings.hasPassword);
      }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "读取备份设置失败"); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const run = async (action: "save" | "test" | "backup" | "restore") => {
    setError(""); setMessage("");
    if ((action === "backup" || action === "restore") && (password.length < 10 || password.length > 1024)) {
      setError("备份密码需为 10 至 1024 个字符"); return;
    }
    if (action === "backup" && password !== passwordConfirm) { setError("两次输入的备份密码不一致"); return; }
    setBusy(action);
    try {
      const result = await readResponse(await fetch("/api/backup/webdav", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, config, ...(action === "backup" || action === "restore" ? { password } : {}),
          ...(action === "restore" ? { confirmRestore: true } : {}) }),
      }));
      if (action === "save") {
        if (result.settings) {
          setConfig({ url: result.settings.url, username: result.settings.username, path: result.settings.path, password: "" });
          setHasPassword(true);
        }
        setMessage("WebDAV 设置已加密保存");
      } else if (action === "test") setMessage("WebDAV 连接成功；备份时会创建子目录并验证写入权限");
      else {
        const date = result.createdAt ? new Date(result.createdAt).toLocaleString() : "";
        setMessage((action === "backup" ? "备份成功" : "恢复成功") + "：" + result.subscriptions + " 个订阅、" + result.templates + " 个个人模板（" + date + "）");
        setPassword(""); setPasswordConfirm(""); setConfirmRestore(false);
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
        <p className="mt-2 text-sm leading-6 text-muted-foreground">备份已保存的订阅、节点、配置、自动更新状态和个人模板。可用同一备份密码恢复到新部署。管理员账号和浏览器中的未保存草稿不包含在内。</p>
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
            <span id="webdav-path-hint" className="block text-xs leading-5 text-muted-foreground">每次备份覆盖此文件；修改文件名可保留多份备份。地址需为公网 HTTPS，基础目录需已存在。</span></div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={disabled} onClick={() => void run("test")}>{busy === "test" ? "测试中…" : "测试连接"}</Button>
          <Button variant="outline" disabled={disabled} onClick={() => void run("save")}>{busy === "save" ? "保存中…" : "保存连接设置"}</Button>
        </div>
        <div className="space-y-5 border-t pt-6">
          <p className="text-sm leading-6 text-muted-foreground">备份使用 AES-256-GCM 加密。请单独保管备份密码；密码不会保存，遗忘后无法恢复。</p>
          <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
            <legend className="sr-only">备份加密密码</legend>
            <label className="flex min-w-0 flex-col gap-2 text-sm" htmlFor="backup-password"><span>备份密码（至少 10 个字符）</span>
              <Input id="backup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={1024} autoComplete="new-password" /></label>
            <label className="flex min-w-0 flex-col gap-2 text-sm" htmlFor="backup-password-confirm"><span>确认备份密码（创建备份时填写）</span>
              <Input id="backup-password-confirm" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} maxLength={1024} autoComplete="new-password" /></label>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button disabled={disabled} onClick={() => void run("backup")}>{busy === "backup" ? "加密并备份中…" : "立即加密备份"}</Button>
            <Button variant="outline" disabled={disabled} onClick={() => setConfirmRestore(true)}>从此文件恢复…</Button>
          </div>
          {confirmRestore && <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/8 p-4">
            <p className="text-sm text-warning-foreground">恢复将覆盖当前账户的全部订阅和个人模板，并保留备份中的订阅令牌。建议先将当前数据备份到另一个文件。请确认文件路径和备份密码正确。</p>
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
