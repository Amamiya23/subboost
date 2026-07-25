import { runLocalSubscriptionAutoUpdateCron } from "./auto-update-service";
import { refreshRuleIndex } from "./rule-catalog";

export function runUpdateSubscriptionsJob() {
  return runLocalSubscriptionAutoUpdateCron();
}

export function runUpdateRuleIndexJob(force = false) {
  return refreshRuleIndex({ force });
}
