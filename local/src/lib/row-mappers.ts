import type { SubscriptionRow } from "./subscription-service";

type RawDate = string | number | null | undefined;

function toDate(value: RawDate): Date | null {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type RawAdminRow = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string | number;
  updatedAt: string | number;
  lastLoginAt: string | number | null;
};

export type AdminRow = {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

export function mapAdminRow(row: RawAdminRow): AdminRow {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    lastLoginAt: toDate(row.lastLoginAt),
  };
}

export type RawTemplateRow = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  encryptedConfig: string;
  createdAt: string | number;
  updatedAt: string | number;
};

export type TemplateRow = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  encryptedConfig: string;
  createdAt: Date;
  updatedAt: Date;
};

export function mapTemplateRow(row: RawTemplateRow): TemplateRow {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description,
    encryptedConfig: row.encryptedConfig,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export type RawAutoUpdateStateRow = {
  subscriptionId: string;
  externalFailureCount: number;
  failureSourceState: string | null;
  lastFailedAt: string | number | null;
  lastAttemptedAt: string | number | null;
  disabledAt: string | number | null;
  disabledReason: string | null;
  disabledPreviousInterval: number | null;
};

export type AutoUpdateStateFields = {
  externalFailureCount: number;
  failureSourceState: string | null;
  lastFailedAt: Date | null;
  lastAttemptedAt: Date | null;
  disabledAt: Date | null;
  disabledReason: string | null;
  disabledPreviousInterval: number | null;
};

export function mapAutoUpdateStateRow(
  row: RawAutoUpdateStateRow | null,
): AutoUpdateStateFields | null {
  if (!row) return null;
  return {
    externalFailureCount: Number(row.externalFailureCount) || 0,
    failureSourceState: row.failureSourceState,
    lastFailedAt: toDate(row.lastFailedAt),
    lastAttemptedAt: toDate(row.lastAttemptedAt),
    disabledAt: toDate(row.disabledAt),
    disabledReason: row.disabledReason,
    disabledPreviousInterval:
      row.disabledPreviousInterval === null ? null : Number(row.disabledPreviousInterval),
  };
}

type RawSubscriptionRow = {
  id: string;
  ownerId: string;
  name: string;
  token: string;
  isPrimary: number;
  encryptedUrls: string;
  encryptedNodes: string;
  encryptedConfig: string;
  encryptedSubscriptionInfo: string | null;
  autoUpdateInterval: number | null;
  cacheExpiresAt: string | number | null;
  lastAccessedAt: string | number | null;
  lastUpdatedAt: string | number | null;
  createdAt: string | number;
  updatedAt: string | number;
};

type RawSubscriptionWithJoinRow = RawSubscriptionRow & {
  owner_username?: string | null;
  state_externalFailureCount?: number | null;
  state_failureSourceState?: string | null;
  state_lastFailedAt?: string | number | null;
  state_lastAttemptedAt?: string | number | null;
  state_disabledAt?: string | number | null;
  state_disabledReason?: string | null;
  state_disabledPreviousInterval?: number | null;
};

export function mapSubscriptionRow(row: RawSubscriptionWithJoinRow): SubscriptionRow {
  const autoUpdateState =
    row.state_externalFailureCount !== undefined && row.state_externalFailureCount !== null
      ? mapAutoUpdateStateRow({
          subscriptionId: row.id,
          externalFailureCount: Number(row.state_externalFailureCount) || 0,
          failureSourceState: row.state_failureSourceState ?? null,
          lastFailedAt: row.state_lastFailedAt ?? null,
          lastAttemptedAt: row.state_lastAttemptedAt ?? null,
          disabledAt: row.state_disabledAt ?? null,
          disabledReason: row.state_disabledReason ?? null,
          disabledPreviousInterval:
            row.state_disabledPreviousInterval === null || row.state_disabledPreviousInterval === undefined
              ? null
              : Number(row.state_disabledPreviousInterval),
        })
      : null;
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    token: row.token,
    isPrimary: Boolean(row.isPrimary),
    encryptedUrls: row.encryptedUrls,
    encryptedNodes: row.encryptedNodes,
    encryptedConfig: row.encryptedConfig,
    encryptedSubscriptionInfo: row.encryptedSubscriptionInfo,
    autoUpdateInterval: row.autoUpdateInterval,
    cacheExpiresAt: toDate(row.cacheExpiresAt),
    lastAccessedAt: toDate(row.lastAccessedAt),
    lastUpdatedAt: toDate(row.lastUpdatedAt),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    autoUpdateState: autoUpdateState ?? undefined,
  };
}

export type RawSubscriptionWithOwnerRow = RawSubscriptionWithJoinRow & {
  owner_username: string | null;
};

export function mapSubscriptionWithOwnerRow(
  row: RawSubscriptionWithOwnerRow,
): SubscriptionRow & { owner: { username: string | null } } {
  return {
    ...mapSubscriptionRow(row),
    owner: { username: row.owner_username ?? null },
  };
}
