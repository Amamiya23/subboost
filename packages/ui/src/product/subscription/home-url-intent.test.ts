import { describe, expect, it } from "vitest";
import { isCleanNewSubscriptionIntent } from "./home-url-intent";

describe("isCleanNewSubscriptionIntent", () => {
  it.each([
    ["", false],
    ["newSubscription=1", true],
    ["newSubscription=1&editSubscriptionId=existing", false],
    ["copySubscriptionId=existing", false],
    ["newSubscription=1&copySubscriptionId=existing", false],
  ])("resolves %s without clearing an edit or copied draft", (query, expected) => {
    expect(isCleanNewSubscriptionIntent(new URLSearchParams(query))).toBe(expected);
  });
});
