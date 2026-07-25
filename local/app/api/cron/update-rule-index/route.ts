import { NextRequest, NextResponse } from "next/server";
import { requireLocalCronAuth } from "@local/lib/cron-auth";
import { runUpdateRuleIndexJob } from "@local/lib/cron-jobs";

export async function POST(request: NextRequest) {
  const authError = requireLocalCronAuth(request);
  if (authError) return authError;

  const force = new URL(request.url).searchParams.get("force") === "1";
  const result = await runUpdateRuleIndexJob(force);

  if (result.status === "unavailable") {
    return NextResponse.json(
      {
        success: false,
        status: result.status,
        error: result.error,
        code: "RULE_INDEX_UNAVAILABLE",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    status: result.status,
    source: result.index.source,
    fetchedAt: result.index.fetchedAt,
    expiresAt: result.index.expiresAt,
    diff: result.diff,
    ...(result.error ? { error: result.error } : {}),
  });
}
