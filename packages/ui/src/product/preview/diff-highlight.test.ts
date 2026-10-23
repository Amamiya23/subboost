import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiffHighlight, YamlHighlight } from "./diff-highlight";

const reactMocks = vi.hoisted(() => ({
  useMemo: vi.fn((factory: () => unknown) => factory()),
  useEffect: vi.fn((effect: () => void | (() => void)) => effect()),
  useState: vi.fn((initial: unknown) => [initial, vi.fn()]),
}));

vi.mock("react", () => ({
  useMemo: reactMocks.useMemo,
  useEffect: reactMocks.useEffect,
  useState: reactMocks.useState,
}));

function visit(value: unknown, visitor: (value: unknown) => void) {
  if (value === null || value === undefined || typeof value === "boolean") return;
  visitor(value);
  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const props = record.props as Record<string, unknown> | undefined;
  if (props) {
    if (props.dangerouslySetInnerHTML) visitor(props.dangerouslySetInnerHTML);
    visit(props.children, visitor);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) visit(item, visitor);
  }
}

function collectText(value: unknown): string {
  const parts: string[] = [];
  visit(value, (item) => {
    if (typeof item === "string" || typeof item === "number") {
      parts.push(String(item));
    }
  });
  return parts.join("");
}

function collectHtml(value: unknown): string[] {
  const html: string[] = [];
  visit(value, (item) => {
    if (!item || typeof item !== "object") return;
    const raw = (item as { __html?: unknown }).__html;
    if (typeof raw === "string") html.push(raw);
  });
  return html;
}

describe("DiffHighlight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for empty input", () => {
    expect(DiffHighlight({ oldText: "", newText: "" })).toBeNull();
  });

  it("renders line-level additions and removals", () => {
    const rendered = DiffHighlight({
      oldText: "a\nb\nc",
      newText: "a\nx\nc\nd",
      className: "custom",
    });

    const text = collectText(rendered);
    expect(text).toContain("变更统计:");
    expect(text).toContain("+2 行");
    expect(text).toContain("-1 行");
    expect(text).toContain("a");
    expect(text).toContain("b");
    expect(text).toContain("x");
    expect(text).toContain("d");
  });
});

describe("YamlHighlight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reactMocks.useState.mockImplementation((initial: unknown) => [initial, vi.fn()]);
  });

  it("highlights comments, arrays, scalars, inline objects, and escaped HTML", () => {
    const rendered = YamlHighlight({
      content: [
        "# comment",
        "name: \"SubBoost\"",
        "port: 7890",
        "enabled: true",
        "missing: null",
        "type: ss",
        "browser: chrome",
        "escaped: <tag>&\"'",
        "- {name: node, type: vmess, tls: true, dialer-proxy: relay}",
        "list: [DIRECT, REJECT, {name: nested, port: 443}]",
      ].join("\n"),
    });

    const html = collectHtml(rendered).join("\n");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("text-success-foreground");
    expect(html).toContain("text-[color:var(--orange-11)]");
    expect(html).toContain("text-success-foreground");
    expect(html).toContain("text-destructive-foreground");
    expect(html).toContain("text-[color:var(--pink-11)]");
    expect(html).toContain("text-info-foreground");
    expect(html).toContain("&lt;tag&gt;&amp;&quot;&#039;");
    expect(html).toContain("text-warning-foreground font-medium");
    expect(html).toContain("text-destructive-foreground font-medium");
  });

  it("switches very large YAML content to plain mode", () => {
    const content = Array.from({ length: 2502 }, (_, index) => `line-${index}`).join("\n");

    const rendered = YamlHighlight({ content });

    const text = collectText(rendered);
    expect(text).toContain("YAML 内容较大，已切换纯文本模式以避免卡顿");
    expect(text).toContain("强制语法高亮");
    expect(text).toContain("line-2501");
    expect(collectHtml(rendered)).toEqual([]);
  });

  it("allows forced highlighting for large content", () => {
    reactMocks.useState.mockImplementationOnce(() => [true, vi.fn()]);
    const content = `${"x".repeat(4001)}\nname: value`;

    const rendered = YamlHighlight({ content });

    const text = collectText(rendered);
    expect(text).toContain("恢复纯文本");
    expect(collectHtml(rendered).join("\n")).toContain("text-[color:var(--cyan-11)]");
  });
});
