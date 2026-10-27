import { NextRequest } from "next/server";
import { json } from "@local/lib/http";
import { requireLocalCronAuth } from "@local/lib/cron-auth";
import { runWebDavAutoBackupJob } from "@local/lib/cron-jobs";

export async function POST(request: NextRequest) {
  const authError = requireLocalCronAuth(request);
  if (authError) return authError;

  const summary = await runWebDavAutoBackupJob();
  return json({ results: summary, timestamp: new Date().toISOString() });
}
