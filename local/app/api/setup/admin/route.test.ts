import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hash: vi.fn(),
  readJsonBody: vi.fn(),
  apiError: vi.fn((message: string, code: string, status: number) => new Response(JSON.stringify({ error: message, code }), { status })),
  getStringField: vi.fn((body: Record<string, unknown>, key: string) => (typeof body[key] === "string" ? String(body[key]).trim() : "")),
  dbQueryOne: vi.fn(),
  dbExecute: vi.fn(),
  generateId: vi.fn(() => "admin-1"),
  signSession: vi.fn(),
  sessionCookieOptions: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ default: { hash: mocks.hash } }));
vi.mock("@local/lib/http", () => ({
  apiError: mocks.apiError,
  getStringField: mocks.getStringField,
  readJsonBody: mocks.readJsonBody,
}));
vi.mock("@local/lib/db", () => ({
  dbQueryOne: mocks.dbQueryOne,
  dbExecute: mocks.dbExecute,
  generateId: mocks.generateId,
}));
vi.mock("@local/lib/session", () => ({
  SESSION_COOKIE: "subboost_local_session",
  signSession: mocks.signSession,
  sessionCookieOptions: mocks.sessionCookieOptions,
}));

import { POST } from "./route";

async function readJson(response: Response) {
  return { status: response.status, body: await response.json(), headers: response.headers };
}

describe("local setup admin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dbQueryOne.mockResolvedValue({ count: 0 });
    mocks.hash.mockResolvedValue("hash");
    mocks.dbExecute.mockResolvedValue(1);
    mocks.signSession.mockResolvedValue("signed-session");
    mocks.sessionCookieOptions.mockReturnValue({ httpOnly: true, path: "/" });
  });

  it("rejects invalid JSON, existing admins, and invalid credentials", async () => {
    mocks.readJsonBody.mockResolvedValueOnce(null);
    expect(await readJson(await POST(new Request("https://local.test/api/setup/admin")))).toMatchObject({
      status: 400,
      body: { error: "请求格式有误，请刷新页面后重试", code: "BAD_REQUEST" },
    });

    mocks.readJsonBody.mockResolvedValueOnce({ username: "ry", password: "long-password", passwordConfirm: "long-password" });
    mocks.dbQueryOne.mockResolvedValueOnce({ count: 1 });
    expect(await readJson(await POST(new Request("https://local.test/api/setup/admin")))).toMatchObject({
      status: 409,
      body: { error: "已有管理员账号，请直接登录", code: "CONFLICT" },
    });

    mocks.readJsonBody.mockResolvedValueOnce({ username: "ry", password: "short", passwordConfirm: "short" });
    expect(await readJson(await POST(new Request("https://local.test/api/setup/admin")))).toMatchObject({
      status: 400,
      body: { error: "密码至少需要 10 个字符", code: "BAD_REQUEST" },
    });

    mocks.readJsonBody.mockResolvedValueOnce({ username: "", password: "long-password", passwordConfirm: "long-password" });
    expect(await readJson(await POST(new Request("https://local.test/api/setup/admin")))).toMatchObject({
      status: 400,
      body: { error: "请输入管理员账号", code: "BAD_REQUEST" },
    });

    mocks.readJsonBody.mockResolvedValueOnce({ username: "ry", password: "long-password", passwordConfirm: "different-password" });
    expect(await readJson(await POST(new Request("https://local.test/api/setup/admin")))).toMatchObject({
      status: 400,
      body: { error: "两次输入的密码不一致，请重新确认", code: "BAD_REQUEST" },
    });
  });

  it("creates the first local admin and sets the session cookie", async () => {
    mocks.readJsonBody.mockResolvedValue({
      username: " ry ",
      password: "long-password",
      passwordConfirm: "long-password",
    });

    const result = await readJson(await POST(new Request("https://local.test/api/setup/admin")));

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, user: { id: "admin-1", username: "ry" } });
    expect(mocks.hash).toHaveBeenCalledWith("long-password", 12);
    expect(mocks.dbExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO LocalAdmin"),
      "admin-1",
      "ry",
      "hash",
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(mocks.signSession).toHaveBeenCalledWith({ adminId: "admin-1", username: "ry" });
    expect(result.headers.get("set-cookie")).toContain("subboost_local_session=signed-session");
  });
});
