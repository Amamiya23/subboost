import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultSubBoostTemplateConfig } from "@subboost/core/config/defaults";

const mocks = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock("./db", () => ({ dbQuery: mocks.query, dbExecute: mocks.execute, generateId: () => "custom-1" }));
import { createTemplate, deleteTemplate, getTemplateDetail, listTemplates, updateTemplate } from "./template-service";

describe("template maintenance with SQLite and encrypted storage", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("ENCRYPTION_KEY", "template-test-key");
    db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE LocalTemplate (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT, encryptedConfig TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`);
    mocks.query.mockImplementation(async (sql: string, ...binds: string[]) => db.prepare(sql).all(...binds));
    mocks.execute.mockImplementation(async (sql: string, ...binds: string[]) => Number(db.prepare(sql).run(...binds).changes));
  });
  afterEach(() => { db.close(); vi.unstubAllEnvs(); });

  it.each(["minimal", "standard", "full"] as const)("saves, reloads, updates and restores the %s default", async (type) => {
    const id = `builtin-${type}`;
    const original = await getTemplateDetail("owner", id);
    const config = { ...buildDefaultSubBoostTemplateConfig(type), mixedPort: 9999, testInterval: 600 };
    expect(await updateTemplate("owner", id, { name: "我的默认模板", description: "定制", config })).toBe(true);
    expect(db.prepare("SELECT encryptedConfig FROM LocalTemplate WHERE id = ?").get(id)?.encryptedConfig).not.toContain("mixedPort");
    expect(await getTemplateDetail("owner", id)).toMatchObject({ id, name: "我的默认模板", config: { mixedPort: 9999, testInterval: 600 } });
    expect(await listTemplates("owner", "default", [id])).toEqual([expect.objectContaining({ id, name: "我的默认模板", isModified: true })]);
    expect(await listTemplates("owner", "my")).toEqual([]);

    config.mixedPort = 8888;
    expect(await updateTemplate("owner", id, { name: "再次修改", config })).toBe(true);
    expect(await getTemplateDetail("owner", id)).toMatchObject({ name: "再次修改", config: { mixedPort: 8888 } });
    expect(db.prepare("SELECT COUNT(*) AS count FROM LocalTemplate").get()?.count).toBe(1);

    expect(await deleteTemplate("owner", id)).toBe(true);
    expect(await getTemplateDetail("owner", id)).toEqual(original);
    expect((await listTemplates("owner", "default", [id]))[0].isModified).toBeUndefined();
  });

  it("keeps owner boundaries and rejects invalid updates without corrupting a saved template", async () => {
    const config = buildDefaultSubBoostTemplateConfig("minimal");
    const payload = { name: "Saved", config };
    await updateTemplate("owner", "builtin-minimal", payload);
    expect(await updateTemplate("other", "builtin-minimal", { ...payload, name: "Other" })).toBe(false);
    expect(await getTemplateDetail("other", "builtin-minimal")).toMatchObject({ config: { mixedPort: config.mixedPort } });
    expect((await getTemplateDetail(null, "builtin-minimal"))?.name).not.toBe("Saved");
    await expect(updateTemplate("owner", "builtin-minimal", { name: "", config })).rejects.toThrow("Invalid name");
    await expect(updateTemplate("owner", "builtin-minimal", { name: "Bad", config: { ...config, mixedPort: -1 } })).rejects.toThrow();
    await expect(updateTemplate("owner", "builtin-minimal", { name: "Wrong type", config: buildDefaultSubBoostTemplateConfig("full") })).rejects.toThrow("基础类型不能更改");
    expect((await getTemplateDetail("owner", "builtin-minimal"))?.name).toBe("Saved");

    await createTemplate("owner", payload);
    expect(await updateTemplate("other", "custom-1", payload)).toBe(false);
    expect(await updateTemplate("owner", "missing", payload)).toBe(false);
    expect(await updateTemplate("owner", "custom-1", { ...payload, name: "Updated" })).toBe(true);
    expect(await listTemplates("owner", "my")).toEqual([expect.objectContaining({ id: "custom-1", name: "Updated" })]);
  });
});
