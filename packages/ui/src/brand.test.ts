import { describe, expect, it } from "vitest";
import {
  createSubBoostManifest,
  SUBBOOST_FAVICON_PATH,
  SUBBOOST_FOOTER_DESCRIPTION,
  SUBBOOST_ICON_PATH,
  SUBBOOST_KEYWORDS,
  SUBBOOST_MANIFEST_CATEGORIES,
  SUBBOOST_PRODUCT_DESCRIPTION,
  SUBBOOST_PRODUCT_TITLE,
  SUBBOOST_SITE_NAME,
  SUBBOOST_THEME_COLOR,
} from "./brand";

describe("SubBoost brand constants", () => {
  it("exposes public product metadata", () => {
    expect(SUBBOOST_SITE_NAME).toBe("SubBoost");
    expect(SUBBOOST_PRODUCT_TITLE).toContain("SubBoost");
    expect(SUBBOOST_PRODUCT_DESCRIPTION).toContain("Clash");
    expect(SUBBOOST_FOOTER_DESCRIPTION).toContain("配置");
    expect(SUBBOOST_THEME_COLOR).toMatch(/^#[0-9a-f]{6}$/i);
    expect(SUBBOOST_ICON_PATH).toBe("/icon.png");
    expect(SUBBOOST_FAVICON_PATH).toBe("/favicon.ico");
    expect(SUBBOOST_KEYWORDS).toContain("订阅转换");
    expect(SUBBOOST_MANIFEST_CATEGORIES).toEqual(["utilities", "productivity"]);
  });

  it("builds the shared app manifest", () => {
    expect(createSubBoostManifest()).toEqual({
      name: SUBBOOST_PRODUCT_TITLE,
      short_name: SUBBOOST_SITE_NAME,
      description: SUBBOOST_PRODUCT_DESCRIPTION,
      start_url: "/",
      display: "standalone",
      background_color: "#111111",
      theme_color: SUBBOOST_THEME_COLOR,
      orientation: "portrait-primary",
      icons: [
        {
          src: SUBBOOST_ICON_PATH,
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: SUBBOOST_ICON_PATH,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
      categories: ["utilities", "productivity"],
      lang: "zh-CN",
    });
  });
});
