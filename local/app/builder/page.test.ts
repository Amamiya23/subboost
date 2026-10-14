import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "../page";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

describe("default subscriptions entry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves deep links, repeated parameters, and encoded IDs", async () => {
    await Page({ searchParams: Promise.resolve({
      copySubscriptionId: "sub /1", tag: ["first", "second"], empty: undefined,
    }) });
    expect(mocks.redirect).toHaveBeenCalledWith("/builder?copySubscriptionId=sub+%2F1&tag=first&tag=second");
  });
});
