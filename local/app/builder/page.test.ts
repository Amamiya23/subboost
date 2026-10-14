import { beforeEach, describe, expect, it, vi } from "vitest";
import LegacyBuilderPage from "./page";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

describe("legacy builder entry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects old bookmarks to the workbench", async () => {
    await LegacyBuilderPage({ searchParams: Promise.resolve({}) });
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("preserves deep links, repeated parameters, and encoded IDs", async () => {
    await LegacyBuilderPage({ searchParams: Promise.resolve({
      copySubscriptionId: "sub /1", tag: ["first", "second"], empty: undefined,
    }) });
    expect(mocks.redirect).toHaveBeenCalledWith("/?copySubscriptionId=sub+%2F1&tag=first&tag=second");
  });
});
