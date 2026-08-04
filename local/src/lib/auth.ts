import { dbQuery, dbQueryOne } from "./db";
import { readSession } from "./session";

export type CurrentAdmin = {
  id: string;
  username: string;
};

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await readSession();
  if (!session) return null;
  const row = await dbQueryOne<{ id: string; username: string }>(
    "SELECT id, username FROM LocalAdmin WHERE id = ?",
    session.adminId,
  );
  return row ? { id: row.id, username: row.username } : null;
}

export async function isSetupRequired(): Promise<boolean> {
  const row = await dbQueryOne<{ count: number }>("SELECT COUNT(*) as count FROM LocalAdmin");
  return Number(row?.count ?? 0) === 0;
}
