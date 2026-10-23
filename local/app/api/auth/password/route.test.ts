import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(), dbQueryOne: vi.fn(), dbExecute: vi.fn(),
  compare: vi.fn(), hash: vi.fn(), signSession: vi.fn(),
}));
vi.mock("@local/lib/auth", () => ({ getCurrentAdmin: mocks.getCurrentAdmin }));
vi.mock("@local/lib/db", () => ({ dbQueryOne: mocks.dbQueryOne, dbExecute: mocks.dbExecute }));
vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare, hash: mocks.hash } }));
vi.mock("@local/lib/session", () => ({
  SESSION_COOKIE: "subboost_local_session", signSession: mocks.signSession,
  sessionCookieOptions: () => ({ httpOnly: true, sameSite: "lax", path: "/" }),
}));

import { POST } from "./route";

const valid = { currentPassword: "current-password", newPassword: "new-password-123", passwordConfirm: "new-password-123" };
function request(body: unknown = valid) {
  return new Request("https://local.test/api/auth/password", { method: "POST", body: JSON.stringify(body) });
}

describe("change local admin password", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1", username: "admin" });
    mocks.dbQueryOne.mockResolvedValue({ passwordHash: "old-hash" });
    mocks.compare.mockImplementation(async (password: string) => password === valid.currentPassword);
    mocks.hash.mockResolvedValue("new-hash");
    mocks.dbExecute.mockResolvedValue(1);
    mocks.signSession.mockResolvedValue("new-session");
  });

  it("requires authentication before reading credentials", async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.dbQueryOne).not.toHaveBeenCalled();
    expect(mocks.dbExecute).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...valid, currentPassword: "" }, "请输入当前密码"],
    [{ ...valid, newPassword: "short" }, "密码至少需要 10 个字符"],
    [{ ...valid, passwordConfirm: "different" }, "两次输入的密码不一致"],
    [{ ...valid, newPassword: "密".repeat(25), passwordConfirm: "密".repeat(25) }, "72 个 UTF-8 字节"],
    [{ ...valid, newPassword: valid.currentPassword, passwordConfirm: valid.currentPassword }, "新密码不能与当前密码相同"],
  ])("rejects invalid input without updating the database", async (body, message) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(message);
    expect(mocks.dbExecute).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and an incorrect current password", async () => {
    expect((await POST(new Request("https://local.test/api/auth/password", { method: "POST", body: "{" }))).status).toBe(400);
    mocks.compare.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("当前密码不正确");
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.dbExecute).not.toHaveBeenCalled();
  });

  it("hashes the new password and renews the current session", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.compare).toHaveBeenCalledWith(valid.currentPassword, "old-hash");
    expect(mocks.hash).toHaveBeenCalledWith(valid.newPassword, 12);
    expect(mocks.dbExecute).toHaveBeenCalledWith(
      "UPDATE LocalAdmin SET passwordHash = ?, updatedAt = ? WHERE id = ? AND passwordHash = ?",
      "new-hash", expect.any(String), "admin-1", "old-hash",
    );
    expect(mocks.signSession).toHaveBeenCalledWith({ adminId: "admin-1", username: "admin" }, "new-hash");
    expect(response.headers.get("set-cookie")).toContain("subboost_local_session=new-session");
  });

  it("does not overwrite a concurrent password change or issue its cookie", async () => {
    mocks.dbExecute.mockResolvedValue(0);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
