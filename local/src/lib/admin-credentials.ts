export const LOCAL_ADMIN_PASSWORD_MIN_LENGTH = 10;
export const LOCAL_ADMIN_PASSWORD_MAX_BYTES = 72;

export const LOCAL_ADMIN_CREDENTIAL_MESSAGES = {
  invalidJson: "请求格式有误，请刷新页面后重试",
  adminExists: "已有管理员账号，请直接登录",
  usernameRequired: "请输入管理员账号",
  passwordMinLength: `密码至少需要 ${LOCAL_ADMIN_PASSWORD_MIN_LENGTH} 个字符`,
  passwordMismatch: "两次输入的密码不一致，请重新确认",
  currentPasswordRequired: "请输入当前密码",
  passwordMaxLength: `密码不能超过 ${LOCAL_ADMIN_PASSWORD_MAX_BYTES} 个 UTF-8 字节`,
  passwordUnchanged: "新密码不能与当前密码相同",
} as const;

type LocalAdminCredentialInput = {
  username: string;
  password: string;
  passwordConfirm: string;
};

export function getLocalAdminSetupCredentialError(input: LocalAdminCredentialInput): string {
  const username = input.username.trim();
  const password = input.password.trim();
  const passwordConfirm = input.passwordConfirm.trim();

  if (!username) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.usernameRequired;
  if (password.length < LOCAL_ADMIN_PASSWORD_MIN_LENGTH) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.passwordMinLength;
  if (password !== passwordConfirm) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.passwordMismatch;
  return "";
}

export function getLocalAdminPasswordChangeError(input: {
  currentPassword: string;
  newPassword: string;
  passwordConfirm: string;
}): string {
  const currentPassword = input.currentPassword.trim();
  const newPassword = input.newPassword.trim();
  if (!currentPassword) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.currentPasswordRequired;
  if (newPassword.length < LOCAL_ADMIN_PASSWORD_MIN_LENGTH) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.passwordMinLength;
  // bcrypt ignores bytes after the first 72; reject rather than silently truncate.
  if (new TextEncoder().encode(newPassword).byteLength > LOCAL_ADMIN_PASSWORD_MAX_BYTES) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.passwordMaxLength;
  if (newPassword !== input.passwordConfirm.trim()) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.passwordMismatch;
  if (newPassword === currentPassword) return LOCAL_ADMIN_CREDENTIAL_MESSAGES.passwordUnchanged;
  return "";
}
