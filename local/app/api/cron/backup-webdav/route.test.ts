import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { runWebDavAutoBackupJob } from "@local/lib/cron-jobs";
import { POST } from "./route";

vi.mock("@local/lib/cron-jobs", () => ({ runWebDavAutoBackupJob: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CRON_SECRET", "backup-secret");
});

describe("WebDAV backup cron route", () => {
  it("rejects an unauthorized request before running backups", async () => {
    const response = await POST(new NextRequest("https://example.test/api/cron/backup-webdav", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(runWebDavAutoBackupJob).not.toHaveBeenCalled();
  });

  it("runs due backups for an authenticated scheduler", async () => {
    const results = { total: 3, success: 1, failed: 1, skipped: 1 };
    vi.mocked(runWebDavAutoBackupJob).mockResolvedValue(results);
    const response = await POST(new NextRequest("https://example.test/api/cron/backup-webdav", {
      method: "POST", headers: { Authorization: "Bearer backup-secret" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ results });
    expect(runWebDavAutoBackupJob).toHaveBeenCalledOnce();
  });
});
