import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildDefaultSubBoostTemplateConfig: vi.fn(),
  builtinIdToType: vi.fn(),
  getBuiltinTemplateId: vi.fn(),
  getBuiltinTemplateSummaryMetadata: vi.fn(),
  getTemplateList: vi.fn(),
  validateSubBoostTemplateConfig: vi.fn(),
  decryptJsonObject: vi.fn(),
  encryptJson: vi.fn(),
  dbQuery: vi.fn(),
  dbExecute: vi.fn(),
  dbBatch: vi.fn(),
  generateId: vi.fn(() => "test-id"),
}));

vi.mock("@subboost/core/config/defaults", () => ({
  buildDefaultSubBoostTemplateConfig: mocks.buildDefaultSubBoostTemplateConfig,
}));
vi.mock("@subboost/core/templates/builtin", () => ({
  builtinIdToType: mocks.builtinIdToType,
  getBuiltinTemplateId: mocks.getBuiltinTemplateId,
  getBuiltinTemplateSummaryMetadata: mocks.getBuiltinTemplateSummaryMetadata,
}));
vi.mock("@subboost/core/templates", () => ({ getTemplateList: mocks.getTemplateList }));
vi.mock("@subboost/core/templates/config-template", () => ({
  validateSubBoostTemplateConfig: mocks.validateSubBoostTemplateConfig,
}));
vi.mock("./crypto", () => ({
  decryptJsonObject: mocks.decryptJsonObject,
  encryptJson: mocks.encryptJson,
}));
vi.mock("./db", () => ({
  dbQuery: mocks.dbQuery,
  dbExecute: mocks.dbExecute,
  dbBatch: mocks.dbBatch,
  generateId: mocks.generateId,
}));

import { createTemplate, deleteTemplate, getTemplateDetail, listTemplates } from "./template-service";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "local-1",
    ownerId: "owner-1",
    name: "Local Template",
    description: "desc",
    encryptedConfig: "encrypted",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("local template service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTemplateList.mockReturnValue([
      { id: "minimal", name: "Minimal", description: "small", groupCount: 1, ruleCount: 2 },
      { id: "standard", name: "Standard", description: "normal", groupCount: 3, ruleCount: 4 },
    ]);
    mocks.getBuiltinTemplateId.mockImplementation((id: string) => `builtin-${id}`);
    mocks.getBuiltinTemplateSummaryMetadata.mockReturnValue({
      downloads: 0,
      engagementCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      tags: ["官方"],
      isOfficial: true,
      isPublic: true,
    });
    mocks.builtinIdToType.mockImplementation((id: string) => {
      if (id === "builtin-minimal") return "minimal";
      return null;
    });
    mocks.buildDefaultSubBoostTemplateConfig.mockReturnValue({ template: "minimal" });
    mocks.decryptJsonObject.mockReturnValue({ enabledProxyGroups: ["auto"], ruleOrder: ["MATCH"] });
    mocks.encryptJson.mockReturnValue("encrypted-new");
    mocks.validateSubBoostTemplateConfig.mockReturnValue({ ok: true, config: { rules: [] } });
    mocks.dbQuery.mockResolvedValue([]);
    mocks.dbExecute.mockResolvedValue(1);
  });

  it("lists built-in templates and owner templates", async () => {
    await expect(listTemplates(null, "default", ["builtin-standard"])).resolves.toEqual([
      expect.objectContaining({
        id: "builtin-standard",
        name: "Standard",
        proxyGroupCount: 3,
        ruleCount: 4,
        isOfficial: true,
      }),
    ]);

    await expect(listTemplates(null, "my")).rejects.toThrow("Authentication required.");

    mocks.dbQuery.mockResolvedValueOnce([row()]);
    await expect(listTemplates("owner-1", "my", ["local-1"])).resolves.toEqual([
      {
        id: "local-1",
        name: "Local Template",
        description: "desc",
        downloads: 0,
        engagementCount: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        tags: ["本地"],
        isOfficial: false,
        isPublic: false,
        isOwner: true,
        proxyGroupCount: 1,
        ruleCount: 1,
      },
    ]);
    expect(mocks.dbQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM LocalTemplate WHERE ownerId = ? AND id IN"),
      "owner-1",
      "local-1",
    );
  });

  it("loads built-in and local template details", async () => {
    await expect(getTemplateDetail(null, "builtin-minimal")).resolves.toEqual({
      id: "builtin-minimal",
      name: "Minimal",
      description: "small",
      kind: "config",
      config: { template: "minimal" },
    });

    await expect(getTemplateDetail(null, "local-1")).rejects.toThrow("Authentication required.");

    mocks.dbQuery.mockResolvedValueOnce([row({ description: null })]);
    await expect(getTemplateDetail("owner-1", "local-1")).resolves.toEqual({
      id: "local-1",
      name: "Local Template",
      description: "",
      kind: "config",
      config: { enabledProxyGroups: ["auto"], ruleOrder: ["MATCH"] },
    });

    mocks.dbQuery.mockResolvedValueOnce([]);
    await expect(getTemplateDetail("owner-1", "missing")).resolves.toBeNull();
  });

  it("creates validated local templates and rejects invalid payloads", async () => {
    await expect(createTemplate("owner-1", null)).rejects.toThrow("Invalid request body.");
    await expect(createTemplate("owner-1", { name: "", config: {} })).rejects.toThrow("Invalid name.");

    mocks.validateSubBoostTemplateConfig.mockReturnValueOnce({ ok: false, error: "bad config" });
    await expect(createTemplate("owner-1", { name: "Template", config: {} })).rejects.toThrow("bad config");

    mocks.generateId.mockReturnValueOnce("local-1");
    await expect(
      createTemplate("owner-1", {
        name: " Template ",
        description: ` ${"x".repeat(600)} `,
        config: { rules: [] },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: "local-1",
        name: "Template",
        description: "x".repeat(500),
      })
    );
    expect(mocks.dbExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO LocalTemplate"),
      "local-1",
      "owner-1",
      "Template",
      "x".repeat(500),
      "encrypted-new",
      expect.any(String),
      expect.any(String),
    );
  });

  it("deletes only templates owned by the current user", async () => {
    mocks.dbExecute.mockResolvedValueOnce(0);
    await expect(deleteTemplate("owner-1", "missing")).resolves.toBe(false);

    mocks.dbExecute.mockResolvedValueOnce(1);
    await expect(deleteTemplate("owner-1", "local-1")).resolves.toBe(true);
    expect(mocks.dbExecute).toHaveBeenCalledWith(
      "DELETE FROM LocalTemplate WHERE id = ? AND ownerId = ?",
      "local-1",
      "owner-1",
    );
  });
});
