export function isCleanNewSubscriptionIntent(searchParams: Pick<URLSearchParams, "get">): boolean {
  return searchParams.get("newSubscription") === "1" && !searchParams.get("editSubscriptionId") && !searchParams.get("copySubscriptionId");
}
