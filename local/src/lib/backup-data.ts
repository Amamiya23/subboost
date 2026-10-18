import { decryptJson, encryptJson } from "./crypto";
import { dbBatch, dbQuery, stmt, type BindValue, type PreparedStatement } from "./db";

type Row = Record<string, unknown>;
type Field = { name: string; column?: string; kind: "text" | "date" | "integer" | "boolean" | "object" | "array"; nullable?: boolean; encrypted?: boolean };
const common: Field[] = [{ name: "id", kind: "text" }, { name: "name", kind: "text" },
  { name: "createdAt", kind: "date" }, { name: "updatedAt", kind: "date" }];
const subscriptionFields: Field[] = [...common, { name: "token", kind: "text" }, { name: "isPrimary", kind: "boolean" },
  { name: "urls", column: "encryptedUrls", kind: "array", encrypted: true },
  { name: "nodes", column: "encryptedNodes", kind: "array", encrypted: true },
  { name: "config", column: "encryptedConfig", kind: "object", encrypted: true },
  { name: "subscriptionInfo", column: "encryptedSubscriptionInfo", kind: "object", encrypted: true },
  { name: "autoUpdateInterval", kind: "integer", nullable: true },
  ...["cacheExpiresAt", "lastAccessedAt", "lastUpdatedAt"].map((name): Field => ({ name, kind: "date", nullable: true }))];
const templateFields: Field[] = [...common, { name: "description", kind: "text", nullable: true },
  { name: "config", column: "encryptedConfig", kind: "object", encrypted: true }];
const stateFields: Field[] = [{ name: "subscriptionId", kind: "text" }, { name: "externalFailureCount", kind: "integer" },
  ...["failureSourceState", "disabledReason"].map((name): Field => ({ name, kind: "text", nullable: true })),
  ...["lastFailedAt", "lastAttemptedAt", "disabledAt"].map((name): Field => ({ name, kind: "date", nullable: true })),
  { name: "disabledPreviousInterval", kind: "integer", nullable: true },
  { name: "createdAt", kind: "date" }, { name: "updatedAt", kind: "date" }];

export type BackupData = { format: "subboost-data"; version: 1; createdAt: string;
  subscriptions: Row[]; templates: Row[]; autoUpdateStates: Row[] };

function isRecord(value: unknown): value is Row { return !!value && typeof value === "object" && !Array.isArray(value); }

function validateRow(value: unknown, fields: Field[]): asserts value is Row {
  if (!isRecord(value)) throw new Error("备份数据格式无效");
  for (const field of fields) {
    const item = value[field.name];
    if (item === null && field.nullable) continue;
    const valid = field.kind === "text" ? typeof item === "string"
      : field.kind === "boolean" ? typeof item === "boolean"
      : field.kind === "integer" ? typeof item === "number" && Number.isSafeInteger(item) && item >= 0
      : field.kind === "date" ? (typeof item === "string" || typeof item === "number") && Number.isFinite(new Date(item).getTime())
      : field.kind === "array" ? Array.isArray(item) : isRecord(item);
    if (!valid) throw new Error("备份字段无效：" + field.name);
  }
}

export function validateBackupData(value: unknown): BackupData {
  if (!isRecord(value) || value.format !== "subboost-data" || value.version !== 1 || typeof value.createdAt !== "string"
    || !Number.isFinite(Date.parse(value.createdAt))) throw new Error("不支持的备份数据格式或版本");
  for (const [key, fields] of [["subscriptions", subscriptionFields], ["templates", templateFields], ["autoUpdateStates", stateFields]] as const) {
    const rows = value[key];
    if (!Array.isArray(rows) || rows.length > 1000) throw new Error("备份记录数量无效");
    const ids = new Set<unknown>();
    for (const row of rows) {
      validateRow(row, fields);
      const id = row.id ?? row.subscriptionId;
      if (typeof id !== "string" || !id || id.length > 256 || ids.has(id)) throw new Error("备份包含无效或重复的记录 ID");
      if (row.name !== undefined && (typeof row.name !== "string" || !row.name.trim())) throw new Error("备份包含空名称");
      ids.add(id);
    }
  }
  const data = value as BackupData;
  const subscriptions = new Set(data.subscriptions.map((row) => row.id));
  if (data.autoUpdateStates.some((row) => !subscriptions.has(row.subscriptionId))) throw new Error("备份包含无效的自动更新状态");
  const tokens = data.subscriptions.map((row) => row.token);
  if (tokens.some((token) => typeof token !== "string" || !token || token.length > 256)
    || new Set(tokens).size !== tokens.length || data.subscriptions.filter((row) => row.isPrimary).length > 1) {
    throw new Error("备份包含无效的订阅令牌或主订阅");
  }
  for (const row of data.subscriptions) {
    if ((row.urls as unknown[]).some((url) => typeof url !== "string")
      || (row.nodes as unknown[]).some((node) => !isRecord(node))) throw new Error("备份订阅内容无效");
    if (row.autoUpdateInterval !== null && (row.autoUpdateInterval as number) < 360) throw new Error("备份自动更新间隔无效");
  }
  return data;
}

async function exportRow(row: Row, fields: Field[]): Promise<Row> {
  const output: Row = {};
  for (const field of fields) {
    const value = row[field.column ?? field.name];
    output[field.name] = field.encrypted ? await decryptJson(value as string | null, field.kind === "array" ? [] : {})
      : field.kind === "boolean" ? Boolean(value) : value;
  }
  return output;
}

export async function collectBackupData(ownerId: string): Promise<BackupData> {
  const [subscriptions, templates, states] = await Promise.all([
    dbQuery<Row>("SELECT * FROM Subscription WHERE ownerId = ? ORDER BY id", ownerId),
    dbQuery<Row>("SELECT * FROM LocalTemplate WHERE ownerId = ? ORDER BY id", ownerId),
    dbQuery<Row>("SELECT u.* FROM SubscriptionAutoUpdateState u JOIN Subscription s ON s.id = u.subscriptionId WHERE s.ownerId = ? ORDER BY u.subscriptionId", ownerId),
  ]);
  return validateBackupData({ format: "subboost-data", version: 1, createdAt: new Date().toISOString(),
    subscriptions: await Promise.all(subscriptions.map((row) => exportRow(row, subscriptionFields))),
    templates: await Promise.all(templates.map((row) => exportRow(row, templateFields))),
    autoUpdateStates: await Promise.all(states.map((row) => exportRow(row, stateFields))) });
}

async function insertStatement(table: string, row: Row, fields: Field[], ownerId?: string): Promise<PreparedStatement> {
  const columns = fields.map((field) => field.column ?? field.name);
  const binds: BindValue[] = [];
  for (const field of fields) {
    binds.push(field.encrypted ? await encryptJson(row[field.name]) : row[field.name] as BindValue);
  }
  if (ownerId) { columns.push("ownerId"); binds.push(ownerId); }
  return stmt("INSERT INTO " + table + " (" + columns.join(", ") + ") VALUES (" + columns.map(() => "?").join(", ") + ")", ...binds);
}

export async function restoreBackupData(ownerId: string, value: unknown): Promise<{ subscriptions: number; templates: number; createdAt: string }> {
  const data = validateBackupData(value);
  // Prepare and encrypt everything before deleting; D1 batch commits or rolls back as one transaction.
  const statements = [stmt("DELETE FROM Subscription WHERE ownerId = ?", ownerId), stmt("DELETE FROM LocalTemplate WHERE ownerId = ?", ownerId)];
  for (const row of data.subscriptions) statements.push(await insertStatement("Subscription", row, subscriptionFields, ownerId));
  for (const row of data.templates) statements.push(await insertStatement("LocalTemplate", row, templateFields, ownerId));
  for (const row of data.autoUpdateStates) statements.push(await insertStatement("SubscriptionAutoUpdateState", row, stateFields));
  await dbBatch(statements);
  return { subscriptions: data.subscriptions.length, templates: data.templates.length, createdAt: data.createdAt };
}
