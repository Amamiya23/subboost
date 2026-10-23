import { dbQueryOne } from "./db";
import { getCredentialVersion, readSession } from "./session";

export type CurrentAdmin = {
  id: string;
  username: string;
};

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await readSession();
  if (!session) return null;
  const row = await dbQueryOne<{ id: string; username: string; passwordHash: string }>(
    "SELECT id, username, passwordHash FROM LocalAdmin WHERE id = ?",
    session.adminId,
  );
  if (!row || session.credentialVersion !== await getCredentialVersion(row.passwordHash)) return null;
  return { id: row.id, username: row.username };
}

export async function isSetupRequired(): Promise<boolean> {
  const row = await dbQueryOne<{ count: number }>("SELECT COUNT(*) as count FROM LocalAdmin");
  return Number(row?.count ?? 0) === 0;
}
