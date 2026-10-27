import { runLocalSubscriptionAutoUpdateCron } from "./auto-update-service";
import { refreshRuleIndex } from "./rule-catalog";
import { runAutomaticWebDavBackups } from "./webdav-backup-service";

export function runUpdateSubscriptionsJob() {
  return runLocalSubscriptionAutoUpdateCron();
}

export function runUpdateRuleIndexJob(force = false) {
  return refreshRuleIndex({ force });
}

export function runWebDavAutoBackupJob() {
  return runAutomaticWebDavBackups();
}
