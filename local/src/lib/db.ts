import { getWorkersEnv, type WorkersEnv } from "./workers-env";

export type BindValue = string | number | boolean | null;

type D1Result<T> = {
  results: T[];
  success: boolean;
  meta: {
    changes: number;
    [key: string]: unknown;
  };
};

type D1DatabaseLike = {
  prepare(sql: string): {
    bind(...values: BindValue[]): {
      all<T>(): Promise<D1Result<T>>;
      first<T>(): Promise<T | null>;
      run<T>(): Promise<D1Result<T>>;
    };
  };
  batch<T>(statements: { bind(...values: BindValue[]): { run<T>(): Promise<D1Result<T>> } }[]): Promise<D1Result<T>[]>;
};

function getCloudflareWorkersEnv(): WorkersEnv | null {
  try {
    // OpenNext bundles API routes into a separate server-function module graph;
    // the module-level `capturedEnv` set via worker/index.ts is NOT visible there.
    // getCloudflareContext() reaches across that boundary via OpenNext's request context.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
      getCloudflareContext: () => { env: WorkersEnv };
    };
    return getCloudflareContext().env;
  } catch {
    return null;
  }
}

function getDB(): D1DatabaseLike {
  const env = getWorkersEnv() ?? getCloudflareWorkersEnv();
  const db = env?.DB;
  if (!db) throw new Error("D1 database binding is not available.");
  return db as unknown as D1DatabaseLike;
}

export function dbQuery<T>(sql: string, ...binds: BindValue[]): Promise<T[]> {
  return getDB()
    .prepare(sql)
    .bind(...binds)
    .all<T>()
    .then((result) => result.results);
}

export function dbQueryOne<T>(sql: string, ...binds: BindValue[]): Promise<T | null> {
  return getDB()
    .prepare(sql)
    .bind(...binds)
    .first<T>();
}

export async function dbExecute(sql: string, ...binds: BindValue[]): Promise<number> {
  const result = await getDB()
    .prepare(sql)
    .bind(...binds)
    .run();
  return result.meta.changes ?? 0;
}

export type PreparedStatement = {
  sql: string;
  binds: BindValue[];
};

export function stmt(sql: string, ...binds: BindValue[]): PreparedStatement {
  return { sql, binds };
}

export async function dbBatch(statements: PreparedStatement[]): Promise<void> {
  const db = getDB();
  const prepared = statements.map((s) => db.prepare(s.sql).bind(...s.binds));
  await db.batch(prepared as never);
}

export function generateId(): string {
  return crypto.randomUUID();
}
