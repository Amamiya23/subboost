import { beforeEach, describe, expect, it, vi } from "vitest";
import { runUpdateRuleIndexJob, runUpdateSubscriptionsJob, runWebDavAutoBackupJob } from "../src/lib/cron-jobs";
import { runScheduledJob } from "./scheduled";

vi.mock("../src/lib/cron-jobs", () => ({
  runUpdateRuleIndexJob: vi.fn(),
  runUpdateSubscriptionsJob: vi.fn(),
  runWebDavAutoBackupJob: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(runUpdateSubscriptionsJob).mockResolvedValue({ results: {} } as never);
  vi.mocked(runWebDavAutoBackupJob).mockResolvedValue({ total: 1, success: 1, failed: 0, skipped: 0 });
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("scheduled WebDAV backups", () => {
  it("runs automatic backups on the existing five-minute trigger", async () => {
    await runScheduledJob({ cron: "*/5 * * * *", scheduledTime: Date.now(), noRetry: vi.fn() });
    expect(runUpdateSubscriptionsJob).toHaveBeenCalledOnce();
    expect(runWebDavAutoBackupJob).toHaveBeenCalledOnce();
    expect(runUpdateRuleIndexJob).not.toHaveBeenCalled();
  });

  it("starts backups even when subscription updates fail", async () => {
    vi.mocked(runUpdateSubscriptionsJob).mockRejectedValue(new Error("update failed"));
    await expect(runScheduledJob({ cron: "*/5 * * * *", scheduledTime: Date.now(), noRetry: vi.fn() })).rejects.toThrow("update failed");
    expect(runWebDavAutoBackupJob).toHaveBeenCalledOnce();
  });
});
