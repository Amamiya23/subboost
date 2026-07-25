import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  yamlHighlight: undefined as any,
  textareas: [] as any[],
  buttons: [] as any[],
  useState: vi.fn(),
}));

vi.mock("@subboost/ui/product/preview/diff-highlight", () => ({
  YamlHighlight: (props: any) => {
    mocks.yamlHighlight = props;
    return React.createElement("pre", { "data-test": "yaml-highlight" }, props.content);
  },
}));

vi.mock("@subboost/ui/components/ui/textarea", () => ({
  Textarea: React.forwardRef(function MockTextarea(props: any) {
    mocks.textareas.push(props);
    return React.createElement("textarea", { "data-test": "textarea" }, props.value);
  }),
}));

vi.mock("@subboost/ui/components/ui/button", () => ({
  Button: (props: any) => {
    mocks.buttons.push(props);
    return React.createElement(
      "button",
      { onClick: props.onClick, disabled: props.disabled },
      props.children,
    );
  },
}));

function extractLabel(children: unknown): string {
  if (typeof children === "string") return children.trim();
  if (Array.isArray(children)) {
    for (const child of children) {
      if (typeof child === "string") return child.trim();
    }
  }
  return "";
}

function findButton(label: string) {
  return mocks.buttons.find((b) => extractLabel(b.children) === label);
}

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react");
  return {
    ...actual,
    useEffect: vi.fn(),
    useCallback: <T,>(fn: T) => fn,
    useState: (initial: unknown) => mocks.useState(initial),
  };
});

vi.mock("lucide-react", () => ({
  Check: () => React.createElement("span", null, "check"),
  Pencil: () => React.createElement("span", null, "pencil"),
  X: () => React.createElement("span", null, "x"),
}));

import { YamlPreviewEditor } from "./yaml-preview-editor";

function installUseState(values: { editing: boolean; draft: string }) {
  // Component calls useState in this order: isEditing(false), draft(content).
  mocks.useState.mockImplementation((initial: unknown) => {
    if (initial === false) return [values.editing, vi.fn()];
    if (typeof initial === "string") return [values.draft, vi.fn()];
    return [initial, vi.fn()];
  });
}

describe("YamlPreviewEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.yamlHighlight = undefined;
    mocks.textareas = [];
    mocks.buttons = [];
    mocks.useState.mockImplementation((initial: unknown) => [initial, vi.fn()]);
  });

  it("renders the highlight view with an edit trigger by default", () => {
    const onContentChange = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(YamlPreviewEditor, {
        content: "mixed-port: 7890",
        onContentChange,
      }),
    );

    expect(mocks.yamlHighlight).toMatchObject({ content: "mixed-port: 7890" });
    expect(mocks.textareas).toHaveLength(0);
    expect(html).toContain("pencil");
    expect(html).toContain("编辑");
    // The edit trigger is a native <button> overlay (not the Button component),
    // so we just assert it appears in the rendered markup with the right label.
    expect(html).toMatch(/<button[^>]*>.*编辑.*<\/button>/s);
  });

  it("renders a draft textarea with save and cancel actions in edit mode", () => {
    installUseState({ editing: true, draft: "mixed-port: 7890" });

    const onContentChange = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(YamlPreviewEditor, {
        content: "mixed-port: 7890",
        onContentChange,
      }),
    );

    expect(mocks.textareas).toHaveLength(1);
    expect(mocks.textareas[0]).toMatchObject({ value: "mixed-port: 7890" });
    expect(typeof mocks.textareas[0].onChange).toBe("function");
    expect(html).toContain("编辑模式");
    expect(html).toContain("保存");
    expect(html).toContain("取消");

    const labels = mocks.buttons.map((b) => extractLabel(b.children));
    expect(labels).toContain("保存");
    expect(labels).toContain("取消");

    const saveButton = findButton("保存");
    // Save disabled when draft equals content.
    expect(saveButton.disabled).toBe(true);
  });

  it("enables save and commits the draft through onContentChange", () => {
    installUseState({ editing: true, draft: "mixed-port: 7891" });

    const onContentChange = vi.fn();
    renderToStaticMarkup(
      React.createElement(YamlPreviewEditor, {
        content: "mixed-port: 7890",
        onContentChange,
      }),
    );

    const saveButton = findButton("保存");
    expect(saveButton.disabled).toBe(false);
    saveButton.onClick();
    expect(onContentChange).toHaveBeenCalledWith("mixed-port: 7891");
  });

  it("cancel does not call onContentChange", () => {
    installUseState({ editing: true, draft: "mixed-port: 9999" });

    const onContentChange = vi.fn();
    renderToStaticMarkup(
      React.createElement(YamlPreviewEditor, {
        content: "mixed-port: 7890",
        onContentChange,
      }),
    );

    const cancelButton = findButton("取消");
    cancelButton.onClick();
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it("forwards className to the outer wrapper", () => {
    renderToStaticMarkup(
      React.createElement(YamlPreviewEditor, {
        content: "x: 1",
        onContentChange: vi.fn(),
        className: "h-full",
      }),
    );
    expect(mocks.yamlHighlight.className).toBe("h-full");
  });
});
