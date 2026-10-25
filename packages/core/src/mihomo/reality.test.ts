import { describe, expect, it } from "vitest";
import { hasRealityConfig } from "./reality";

describe("hasRealityConfig", () => {
  it("identifies REALITY nodes and independent XHTTP download REALITY", () => {
    expect(hasRealityConfig({ type: "vless", "reality-opts": { "public-key": "key" } })).toBe(true);
    expect(hasRealityConfig({
      type: "vless",
      network: "xhttp",
      "xhttp-opts": { "download-settings": { "reality-opts": { "public-key": "key" } } },
    })).toBe(true);
    for (const node of [null, {}, { type: "ss" }, { "reality-opts": {} }, { "reality-opts": { "public-key": " " } }]) {
      expect(hasRealityConfig(node)).toBe(false);
    }
    expect(hasRealityConfig({
      type: "vless",
      network: "xhttp",
      "xhttp-opts": { "download-settings": { "reality-opts": { "public-key": "" } } },
    })).toBe(false);
  });
});
