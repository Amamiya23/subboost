import { describe, expect, it } from "vitest";
import { buildDefaultSubBoostTemplateConfig } from "@subboost/core/config/defaults";
import { parseTemplateDocument, serializeTemplateDocument } from "./template-document";

describe("editable template documents", () => {
  it("roundtrips defaults and validates edited fields", () => {
    const config = buildDefaultSubBoostTemplateConfig("standard");
    const source = serializeTemplateDocument({ ...config, mixedPort: 9999, dnsYaml: "dns:\n  enable: true\n" });
    const result = parseTemplateDocument(source);
    expect(result).toMatchObject({ ok: true, config: { template: "standard", mixedPort: 9999, dnsYaml: "dns:\n  enable: true\n" } });
  });

  it.each(["[", "null", "schema: wrong", serializeTemplateDocument({ ...buildDefaultSubBoostTemplateConfig("minimal"), mixedPort: -1 })])("rejects malformed or invalid configuration: %s", (source) => {
    expect(parseTemplateDocument(source)).toMatchObject({ ok: false, error: expect.any(String) });
  });
});
