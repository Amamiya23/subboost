import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: true, settings: vi.fn(), save: vi.fn(), test: vi.fn(), backup: vi.fn(), restore: vi.fn() }));
vi.mock("@local/lib/api-auth", () => ({ withCurrentAdmin: (handler: (admin: { id: string }) => unknown) =>
  mocks.admin ? handler({ id: "owner" }) : new Response("{}", { status: 401 }) }));
vi.mock("@local/lib/webdav-backup-service", () => ({ getBackupSettings: mocks.settings, saveBackupSettings: mocks.save,
  testBackupConnection: mocks.test, createWebDavBackup: mocks.backup, restoreWebDavBackup: mocks.restore }));
import { GET, POST } from "./route";
function request(body: unknown, origin = "https://app.test") {
  return new Request("https://app.test/api/backup/webdav", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });
}

describe("WebDAV backup API", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.admin = true; });
  it("requires authentication before reading settings or performing an operation", async () => {
    mocks.admin = false;
    expect((await GET()).status).toBe(401);
    expect((await POST(request({ action: "backup" }))).status).toBe(401);
    expect(mocks.settings).not.toHaveBeenCalled(); expect(mocks.backup).not.toHaveBeenCalled();
  });
  it("blocks cross-origin requests and requires a password and explicit restore confirmation", async () => {
    expect((await POST(request({ action: "test" }, "https://evil.test"))).status).toBe(403);
    expect((await POST(request({ action: "backup", password: "short" }))).status).toBe(400);
    expect((await POST(request({ action: "restore", password: "backup-password" }))).status).toBe(400);
    expect(mocks.test).not.toHaveBeenCalled(); expect(mocks.backup).not.toHaveBeenCalled(); expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("dispatches authenticated operations and disables response caching", async () => {
    mocks.settings.mockResolvedValue({ url: "https://dav.test/", hasPassword: true });
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ settings: { hasPassword: true } });
    mocks.restore.mockResolvedValue({ subscriptions: 1, templates: 2 });
    const config = { url: "https://dav.test/" };
    const restored = await POST(request({ action: "restore", config, password: "backup-password", confirmRestore: true }));
    expect(restored.status).toBe(200);
    expect(mocks.restore).toHaveBeenCalledWith("owner", config, "backup-password");
    expect(restored.headers.get("cache-control")).toBe("no-store");
  });
  it("handles invalid JSON, unknown actions and missing database migrations", async () => {
    expect((await POST(new Request("https://app.test/api/backup/webdav", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await POST(request({ action: "unknown" }))).status).toBe(400);
    mocks.settings.mockRejectedValue(new Error("D1_ERROR: no such table: WebDavBackupSettings"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("迁移") });
  });
});
