import { buildDefaultSubBoostTemplateConfig } from "@subboost/core/config/defaults";
import {
  builtinIdToType,
  getBuiltinTemplateId,
  getBuiltinTemplateSummaryMetadata,
} from "@subboost/core/templates/builtin";
import { getTemplateList } from "@subboost/core/templates";
import { validateSubBoostTemplateConfig } from "@subboost/core/templates/config-template";
import type { SubBoostTemplateConfig } from "@subboost/core/types/template-config";
import type { TemplateTab } from "@subboost/server-core/templates";
import { decryptJsonObject, encryptJson } from "./crypto";
import { dbExecute, dbQuery, generateId } from "./db";
import { mapTemplateRow } from "./row-mappers";

type LocalTemplateTab = Extract<TemplateTab, "default" | "my">;

type LocalTemplateRow = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  encryptedConfig: string;
  createdAt: Date;
  updatedAt: Date;
};

export type LocalTemplateSummary = {
  id: string;
  name: string;
  description: string;
  downloads: number;
  engagementCount: number;
  createdAt: string;
  tags: string[];
  isOfficial: boolean;
  isPublic: boolean;
  isOwner?: boolean;
  isModified?: boolean;
  proxyGroupCount: number | null;
  ruleCount: number | null;
};

export type LocalTemplateDetail = {
  id: string;
  name: string;
  description: string;
  kind: "config";
  config: SubBoostTemplateConfig;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function builtinSummaries(): LocalTemplateSummary[] {
  return getTemplateList().map((template) => ({
    ...getBuiltinTemplateSummaryMetadata(),
    id: getBuiltinTemplateId(template.id),
    name: template.name,
    description: template.description,
    proxyGroupCount: template.groupCount,
    ruleCount: template.ruleCount,
  }));
}

async function formatLocalTemplate(row: LocalTemplateRow): Promise<LocalTemplateSummary> {
  const config = await decryptJsonObject(row.encryptedConfig);
  const proxyGroupCount = Array.isArray(config.enabledProxyGroups) ? config.enabledProxyGroups.length : null;
  const ruleCount = Array.isArray(config.ruleOrder) ? config.ruleOrder.length : null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    downloads: 0,
    engagementCount: 0,
    createdAt: row.createdAt.toISOString(),
    tags: ["本地"],
    isOfficial: false,
    isPublic: false,
    isOwner: true,
    proxyGroupCount,
    ruleCount,
  };
}

function filterByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  if (ids.length === 0) return items;
  const allowed = new Set(ids);
  return items.filter((item) => allowed.has(item.id));
}

export async function listTemplates(
  ownerId: string | null,
  tab: LocalTemplateTab,
  ids: string[] = []
): Promise<LocalTemplateSummary[]> {
  if (tab === "default") {
    const defaults = filterByIds(builtinSummaries(), ids);
    if (!ownerId || defaults.length === 0) return defaults;
    const rows = await dbQuery<LocalTemplateRow>(
      `SELECT id, ownerId, name, description, encryptedConfig, createdAt, updatedAt
       FROM LocalTemplate WHERE ownerId = ? AND id IN (${defaults.map(() => "?").join(",")})`,
      ownerId,
      ...defaults.map((item) => item.id),
    );
    const overrides = new Map(await Promise.all(rows.map(async (row) => {
      const summary = await formatLocalTemplate(mapTemplateRow(row as never));
      return [row.id, summary] as const;
    })));
    return defaults.map((item) => {
      const override = overrides.get(item.id);
      return override ? { ...item, ...override, tags: ["内置", "已修改"], isOfficial: true, isModified: true } : item;
    });
  }
  if (!ownerId) throw new Error("Authentication required.");

  const rows = ids.length > 0
    ? await dbQuery<LocalTemplateRow>(
        `SELECT id, ownerId, name, description, encryptedConfig, createdAt, updatedAt
         FROM LocalTemplate WHERE ownerId = ? AND id IN (${ids.map(() => "?").join(",")})
         ORDER BY updatedAt DESC`,
        ownerId,
        ...ids,
      )
    : await dbQuery<LocalTemplateRow>(
        `SELECT id, ownerId, name, description, encryptedConfig, createdAt, updatedAt
         FROM LocalTemplate WHERE ownerId = ? ORDER BY updatedAt DESC`,
        ownerId,
      );
  return Promise.all(rows.filter((row) => !builtinIdToType(row.id)).map((row) => formatLocalTemplate(mapTemplateRow(row as never))));
}

export async function getTemplateDetail(ownerId: string | null, id: string): Promise<LocalTemplateDetail | null> {
  if (ownerId) {
    const rows = await dbQuery<LocalTemplateRow>(
      `SELECT id, ownerId, name, description, encryptedConfig, createdAt, updatedAt
       FROM LocalTemplate WHERE id = ? AND ownerId = ?`,
      id,
      ownerId,
    );
    if (rows.length > 0) {
      const row = mapTemplateRow(rows[0] as never);
      return {
        id: row.id,
        name: row.name,
        description: row.description || "",
        kind: "config",
        config: (await decryptJsonObject(row.encryptedConfig)) as SubBoostTemplateConfig,
      };
    }
  }
  const builtinType = builtinIdToType(id);
  if (builtinType) {
    const summary = builtinSummaries().find((item) => item.id === id);
    return {
      id,
      name: summary?.name || builtinType,
      description: summary?.description || "",
      kind: "config",
      config: buildDefaultSubBoostTemplateConfig(builtinType),
    };
  }

  if (!ownerId) throw new Error("Authentication required.");
  return null;
}

function parseTemplatePayload(body: unknown) {
  const payload = asRecord(body);
  if (!payload) throw new Error("Invalid request body.");

  const name = asString(payload.name);
  if (!name || name.length > 100) throw new Error("Invalid name.");

  const validated = validateSubBoostTemplateConfig(payload.config);
  if (!validated.ok) throw new Error(validated.error);
  return { name, description: asString(payload.description).slice(0, 500), config: validated.config };
}

export async function createTemplate(ownerId: string, body: unknown): Promise<LocalTemplateSummary> {
  const { name, description, config } = parseTemplatePayload(body);

  const id = generateId();
  const now = new Date().toISOString();
  const encryptedConfig = await encryptJson(config);

  await dbExecute(
    `INSERT INTO LocalTemplate (id, ownerId, name, description, encryptedConfig, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    ownerId,
    name,
    description,
    encryptedConfig,
    now,
    now,
  );

  return formatLocalTemplate({
    id,
    ownerId,
    name,
    description: description || null,
    encryptedConfig,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });
}

export async function updateTemplate(ownerId: string, id: string, body: unknown): Promise<boolean> {
  const { name, description, config } = parseTemplatePayload(body);
  const builtinType = builtinIdToType(id);
  if (builtinType && config.template !== builtinType) {
    throw new Error("默认模板的基础类型不能更改。");
  }
  const encryptedConfig = await encryptJson(config);
  const now = new Date().toISOString();
  if (builtinType) {
    // Keep the stable builtin ID so backups and every application path resolve the same template.
    const changes = await dbExecute(
      `INSERT INTO LocalTemplate (id, ownerId, name, description, encryptedConfig, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
         encryptedConfig = excluded.encryptedConfig, updatedAt = excluded.updatedAt
       WHERE LocalTemplate.ownerId = excluded.ownerId`,
      id, ownerId, name, description, encryptedConfig, now, now,
    );
    return changes > 0;
  }
  const changes = await dbExecute(
    `UPDATE LocalTemplate SET name = ?, description = ?, encryptedConfig = ?, updatedAt = ?
     WHERE id = ? AND ownerId = ?`,
    name, description, encryptedConfig, now, id, ownerId,
  );
  return changes > 0;
}

export async function deleteTemplate(ownerId: string, id: string): Promise<boolean> {
  const changes = await dbExecute(
    "DELETE FROM LocalTemplate WHERE id = ? AND ownerId = ?",
    id,
    ownerId,
  );
  return changes > 0;
}
