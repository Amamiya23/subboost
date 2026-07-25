import type { ScheduledController } from "./worker-types";
import { runUpdateRuleIndexJob, runUpdateSubscriptionsJob } from "../src/lib/cron-jobs";

const UPDATE_SUBSCRIPTIONS_CRON = "*/5 * * * *";
const UPDATE_RULE_INDEX_CRON = "0 3 * * *";

export async function runScheduledJob(controller: ScheduledController): Promise<void> {
  if (controller.cron === UPDATE_SUBSCRIPTIONS_CRON) {
    const summary = await runUpdateSubscriptionsJob();
    const results = "results" in summary ? summary.results : summary;
    console.info("[scheduled] update-subscriptions complete", {
      results,
    });
    return;
  }
  if (controller.cron === UPDATE_RULE_INDEX_CRON) {
    const result = await runUpdateRuleIndexJob();
    if (result.status === "unavailable") {
      console.warn("[scheduled] update-rule-index unavailable", { error: result.error });
      return;
    }
    console.info("[scheduled] update-rule-index complete", {
      status: result.status,
      source: result.index.source,
      fetchedAt: result.index.fetchedAt,
    });
    return;
  }
  console.warn("[scheduled] unknown cron expression, ignoring", { cron: controller.cron });
}
