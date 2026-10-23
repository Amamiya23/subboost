"use client";

import * as React from "react";
import { Button } from "@subboost/ui/components/coss/compat/button";
import { Input } from "@subboost/ui/components/coss/compat/input";
import { Label } from "@subboost/ui/components/coss/compat/label";
import { readJsonResponse } from "@subboost/ui/product/client-response";
import { getLocalAdminPasswordChangeError, LOCAL_ADMIN_PASSWORD_MIN_LENGTH } from "@local/lib/admin-credentials";

const emptyPasswords = { currentPassword: "", newPassword: "", passwordConfirm: "" };

export function ChangePasswordForm({ username }: { username: string }) {
  const [passwords, setPasswords] = React.useState(emptyPasswords);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const submitting = React.useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setSaved(false);
    const validationError = getLocalAdminPasswordChangeError(passwords);
    setError(validationError);
    if (validationError) return;
    submitting.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwords),
      });
      await readJsonResponse<{ success?: boolean; error?: string }>(response, "修改密码失败，请稍后重试");
      setPasswords(emptyPasswords);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "修改密码失败，请稍后重试");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="max-w-sm space-y-5" aria-label="修改密码">
      <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />
      <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
        <legend className="sr-only">修改密码</legend>
        {([
          ["currentPassword", "当前密码", "current-password"],
          ["newPassword", "新密码", "new-password"],
          ["passwordConfirm", "确认新密码", "new-password"],
        ] as const).map(([name, label, autoComplete]) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={`account-${name}`}>{label}</Label>
            <Input
              id={`account-${name}`} name={name} type="password" required autoComplete={autoComplete}
              minLength={name === "currentPassword" ? undefined : LOCAL_ADMIN_PASSWORD_MIN_LENGTH}
              maxLength={name === "currentPassword" ? 1024 : 72}
              value={passwords[name]}
              aria-describedby={name === "newPassword" ? "account-password-hint" : undefined}
              onChange={(event) => {
                setPasswords({ ...passwords, [name]: event.target.value });
                setError(""); setSaved(false);
              }}
            />
            {name === "newPassword" && <p id="account-password-hint" className="text-xs text-muted-foreground">至少 {LOCAL_ADMIN_PASSWORD_MIN_LENGTH} 个字符</p>}
          </div>
        ))}
        <Button type="submit">{saving ? "保存中…" : "更新密码"}</Button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive-foreground">{error}</p>}
      {saved && <p role="status" className="text-sm text-success-foreground">密码已更新，其他登录会话已失效。</p>}
    </form>
  );
}
