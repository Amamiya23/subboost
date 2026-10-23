import { dump, load } from "js-yaml";
import { validateSubBoostTemplateConfig } from "@subboost/core/templates/config-template";

export function serializeTemplateDocument(config: unknown): string {
  return dump(config, { lineWidth: -1, noRefs: true });
}

export function parseTemplateDocument(source: string) {
  try {
    return validateSubBoostTemplateConfig(load(source));
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "配置格式无效" };
  }
}
