import { dbQueryOne } from "@local/lib/db";
import { json } from "@local/lib/http";

export async function GET() {
  try {
    await dbQueryOne("SELECT 1 as ok");
    return json({ ok: true, database: "ready" });
  } catch {
    return json({ ok: false, database: "unavailable" }, 503);
  }
}
