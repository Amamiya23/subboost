export const SUBBOOST_SITE_NAME = "SubBoost";

export const SUBBOOST_PRODUCT_TITLE = "SubBoost - Clash 订阅转换与管理服务";

export const SUBBOOST_PRODUCT_DESCRIPTION =
  "Clash 订阅转换、生成与管理工具，支持链式代理、智能分流、多协议和多订阅聚合。";

export const SUBBOOST_FOOTER_DESCRIPTION =
  "Clash 订阅转换、生成和管理工具，让配置更简单";

export const SUBBOOST_THEME_COLOR = "#111111";

export const SUBBOOST_ICON_PATH = "/icon.png";

export const SUBBOOST_FAVICON_PATH = "/favicon.ico";

export const SUBBOOST_KEYWORDS = [
  "Clash",
  "订阅转换",
  "订阅生成",
  "订阅管理",
  "链式代理",
  "智能分流",
  "订阅聚合",
  "代理配置",
  "SubBoost",
  "Clash 配置",
  "多订阅管理",
];

export const SUBBOOST_MANIFEST_CATEGORIES = ["utilities", "productivity"];

export type SubBoostManifest = {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: "standalone";
  background_color: string;
  theme_color: string;
  orientation: "portrait-primary";
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose: "any" | "maskable";
  }>;
  categories: string[];
  lang: string;
};

export function createSubBoostManifest(): SubBoostManifest {
  return {
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
    categories: [...SUBBOOST_MANIFEST_CATEGORIES],
    lang: "zh-CN",
  };
}
