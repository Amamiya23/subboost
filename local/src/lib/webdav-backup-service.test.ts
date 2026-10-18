import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), queryOne: vi.fn(), execute: vi.fn(), batch: vi.fn(), upload: vi.fn(), download: vi.fn(), test: vi.fn() }));
vi.mock("./db", () => ({ dbQuery: mocks.query, dbQueryOne: mocks.queryOne, dbExecute: mocks.execute, dbBatch: mocks.batch,
  stmt: (sql: string, ...binds: unknown[]) => ({ sql, binds }) }));
vi.mock("./webdav", async (original) => ({ ...await original<typeof import("./webdav")>(),
  uploadWebDavBackup: mocks.upload, downloadWebDavBackup: mocks.download, testWebDav: mocks.test }));
import { collectBackupData, restoreBackupData } from "./backup-data";
import { decryptJson } from "./crypto";
import { createWebDavBackup, getBackupSettings, resolveBackupConfig, restoreWebDavBackup, saveBackupSettings } from "./webdav-backup-service";

const config = { url: "https://dav.example.test/dav/", username: "admin", password: "webdav-secret", path: "subboost/backup.enc.json" };
const date = "2026-10-18T00:00:00.000Z";
function fixture() {
  return { format: "subboost-data", version: 1, createdAt: date, subscriptions: [{ id: "sub-1", name: "订阅", token: "original-token", isPrimary: true,
    urls: ["https://secret.test/sub"], nodes: [{ name: "node", type: "ss", password: "node-secret" }], config: { template: "minimal" }, subscriptionInfo: { upload: 42 },
    autoUpdateInterval: 3600, cacheExpiresAt: null, lastAccessedAt: date, lastUpdatedAt: date, createdAt: date, updatedAt: date }],
    templates: [{ id: "template-1", name: "模板", description: "desc", config: { proxyGroups: [] }, createdAt: date, updatedAt: date }],
    autoUpdateStates: [{ subscriptionId: "sub-1", externalFailureCount: 2, failureSourceState: "[]", lastFailedAt: date, lastAttemptedAt: date,
      disabledAt: null, disabledReason: null, disabledPreviousInterval: null, createdAt: date, updatedAt: date }] };
}

describe("WebDAV backup and restore with SQLite and real encryption", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("ENCRYPTION_KEY", "old-instance-key");
    db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(readFileSync(new URL("../../prisma/migrations-d1/0000_init/migration.sql", import.meta.url), "utf8"));
    db.exec(readFileSync(new URL("../../prisma/migrations-d1/0001_webdav_backup/migration.sql", import.meta.url), "utf8"));
    db.prepare("INSERT INTO LocalAdmin (id, username, passwordHash, updatedAt) VALUES (?, ?, ?, ?)").run("owner", "admin", "hash", date);
    const values = (binds: unknown[]) => binds.map((value) => typeof value === "boolean" ? Number(value) : value) as (string | number | null)[];
    mocks.query.mockImplementation(async (sql: string, ...binds: unknown[]) => db.prepare(sql).all(...values(binds)));
    mocks.queryOne.mockImplementation(async (sql: string, ...binds: unknown[]) => db.prepare(sql).get(...values(binds)) ?? null);
    mocks.execute.mockImplementation(async (sql: string, ...binds: unknown[]) => Number(db.prepare(sql).run(...values(binds)).changes));
    mocks.batch.mockImplementation(async (statements: { sql: string; binds: unknown[] }[]) => {
      db.exec("BEGIN");
      try { for (const statement of statements) db.prepare(statement.sql).run(...values(statement.binds)); db.exec("COMMIT"); }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    });
  });
  afterEach(() => { db.close(); vi.unstubAllEnvs(); });

  it("encrypts saved credentials, never returns the password, and prevents reusing it at a new destination", async () => {
    await saveBackupSettings("owner", config);
    const saved = db.prepare("SELECT encryptedConfig FROM WebDavBackupSettings").get()!;
    expect(saved.encryptedConfig).not.toContain(config.password);
    expect(await getBackupSettings("owner")).toEqual({ url: config.url, username: config.username, path: config.path, hasPassword: true });
    expect(await resolveBackupConfig("owner", { ...config, password: "" })).toEqual(config);
    await expect(resolveBackupConfig("owner", { ...config, url: "https://evil.test", password: "" })).rejects.toThrow("重新输入");
    await expect(resolveBackupConfig("owner", { ...config, username: "other", password: "" })).rejects.toThrow("重新输入");
  });

  it("accepts freshly entered credentials after the old instance key is lost", async () => {
    await saveBackupSettings("owner", config);
    vi.stubEnv("ENCRYPTION_KEY", "replacement-instance-key");
    await expect(resolveBackupConfig("owner", config)).resolves.toEqual(config);
    await expect(saveBackupSettings("owner", config)).resolves.toMatchObject({ hasPassword: true });
  });

  it("backs up all saved data, migrates to a new key and owner, and preserves subscription tokens", async () => {
    await restoreBackupData("owner", fixture());
    const backup = await createWebDavBackup("owner", config, "backup-password");
    const ciphertext = mocks.upload.mock.calls[0][1] as string;
    expect(ciphertext).not.toContain("original-token");
    expect(ciphertext).not.toContain("secret.test");
    expect(ciphertext).not.toContain("node-secret");
    db.exec("DELETE FROM Subscription; DELETE FROM LocalTemplate");
    db.prepare("INSERT INTO LocalAdmin (id, username, passwordHash, updatedAt) VALUES (?, ?, ?, ?)").run("new-owner", "new-admin", "new-hash", date);
    vi.stubEnv("ENCRYPTION_KEY", "new-instance-key");
    mocks.download.mockResolvedValue(ciphertext);
    await expect(restoreWebDavBackup("new-owner", config, "backup-password")).resolves.toEqual({ createdAt: backup.createdAt, subscriptions: 1, templates: 1 });
    const restored = await collectBackupData("new-owner");
    expect({ ...restored, createdAt: date }).toEqual(fixture());
    expect(db.prepare("SELECT ownerId, token FROM Subscription").get()).toMatchObject({ ownerId: "new-owner", token: "original-token" });
    const row = db.prepare("SELECT encryptedNodes FROM Subscription").get()!;
    expect(row.encryptedNodes).not.toContain("node-secret");
    await expect(decryptJson(row.encryptedNodes as string, [])).resolves.toEqual(fixture().subscriptions[0].nodes);
    expect(db.prepare("SELECT username FROM LocalAdmin WHERE id = 'new-owner'").get()!.username).toBe("new-admin");
  });

  it("does not write for wrong passwords or invalid data and rolls back if an insert fails", async () => {
    await restoreBackupData("owner", fixture());
    await createWebDavBackup("owner", config, "backup-password");
    mocks.download.mockResolvedValue(mocks.upload.mock.calls[0][1]);
    mocks.batch.mockClear();
    await expect(restoreWebDavBackup("owner", config, "wrong-password")).rejects.toThrow("解密失败");
    const malformed = fixture(); malformed.subscriptions[0].urls = [123 as never];
    await expect(restoreBackupData("owner", malformed)).rejects.toThrow("内容无效");
    expect(mocks.batch).not.toHaveBeenCalled();
    // Force failure after the delete and subscription insert; the whole restore must roll back.
    db.exec("CREATE TRIGGER fail_template BEFORE INSERT ON LocalTemplate BEGIN SELECT RAISE(ABORT, 'simulated failure'); END");
    const changed = fixture(); changed.subscriptions[0].name = "changed";
    await expect(restoreBackupData("owner", changed)).rejects.toThrow("simulated failure");
    expect(db.prepare("SELECT name FROM Subscription").get()!.name).toBe("订阅");
    expect(db.prepare("SELECT COUNT(*) AS count FROM LocalTemplate").get()!.count).toBe(1);
    expect(db.prepare("SELECT externalFailureCount FROM SubscriptionAutoUpdateState").get()!.externalFailureCount).toBe(2);
  });
});
