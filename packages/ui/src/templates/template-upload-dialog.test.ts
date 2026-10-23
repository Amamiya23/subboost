import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buttons: [] as any[],
  dialogs: [] as any[],
  inputs: [] as any[],
  rawButtons: [] as any[],
  textareas: [] as any[],
}));

vi.mock("react/jsx-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react/jsx-runtime")>();
  const capture = (type: any, props: any) => {
    if (type === "button") mocks.rawButtons.push(props ?? {});
  };
  return {
    ...actual,
    jsx: (type: any, props: any, key: any) => {
      capture(type, props);
      return actual.jsx(type, props, key);
    },
    jsxs: (type: any, props: any, key: any) => {
      capture(type, props);
      return actual.jsxs(type, props, key);
    },
  };
});

vi.mock("lucide-react", () => ({
  Globe: () => React.createElement("span", null, "globe-icon"),
  Loader2: () => React.createElement("span", null, "loader-icon"),
  Lock: () => React.createElement("span", null, "lock-icon"),
  Upload: () => React.createElement("span", null, "upload-icon"),
}));
vi.mock("@subboost/ui/components/coss/compat/button", () => ({
  Button: (props: any) => {
    mocks.buttons.push(props);
    return React.createElement("button", props, props.children);
  },
}));
vi.mock("@subboost/ui/components/coss/compat/dialog", () => ({
  Dialog: (props: any) => {
    mocks.dialogs.push(props);
    return React.createElement("div", null, props.children);
  },
  DialogContent: (props: any) => React.createElement("section", props, props.children),
  DialogDescription: (props: any) => React.createElement("p", props, props.children),
  DialogFooter: (props: any) => React.createElement("footer", props, props.children),
  DialogHeader: (props: any) => React.createElement("header", props, props.children),
  DialogTitle: (props: any) => React.createElement("h2", props, props.children),
}));
vi.mock("@subboost/ui/components/coss/compat/input", () => ({
  Input: (props: any) => {
    mocks.inputs.push(props);
    return React.createElement("input", props);
  },
}));
vi.mock("@subboost/ui/components/coss/compat/textarea", () => ({
  Textarea: (props: any) => {
    mocks.textareas.push(props);
    return React.createElement("textarea", props);
  },
}));
vi.mock("@subboost/ui/lib/utils", () => ({ cn: (...parts: unknown[]) => parts.filter(Boolean).join(" ") }));

import { TemplateUploadDialog } from "./template-upload-dialog";

function renderDialog(overrides: Partial<React.ComponentProps<typeof TemplateUploadDialog>> = {}) {
  mocks.buttons = [];
  mocks.dialogs = [];
  mocks.inputs = [];
  mocks.rawButtons = [];
  mocks.textareas = [];
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    userIsAdmin: true,
    name: "Template",
    onNameChange: vi.fn(),
    description: "Description",
    onDescriptionChange: vi.fn(),
    isPublic: false,
    onPublicChange: vi.fn(),
    asDefault: false,
    onDefaultChange: vi.fn(),
    isUploading: false,
    mode: "config" as const,
    onModeChange: vi.fn(),
    yamlContent: "",
    onYamlContentChange: vi.fn(),
    onUpload: vi.fn(),
    ...overrides,
  };
  const html = renderToStaticMarkup(React.createElement(TemplateUploadDialog, props));
  return { html, props };
}

describe("TemplateUploadDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders config upload controls and forwards visibility changes", () => {
    const { html, props } = renderDialog();

    expect(html).toContain("上传模板");
    expect(html).toContain("配置模板");
    expect(html).toContain("私有模板");
    expect(html).toContain("仅自己可见和使用");
    expect(html).toContain("lock-icon");

    mocks.inputs[0].onChange({ target: { value: "New template" } });
    mocks.textareas[0].onChange({ target: { value: "New description" } });
    mocks.buttons.find((button) => button.children === "配置模板").onClick();
    mocks.buttons.find((button) => button.children === "YAML（开发中）").onClick();
    mocks.rawButtons[0].onClick();
    mocks.rawButtons[1].onClick();
    mocks.buttons.at(-2).onClick();
    mocks.buttons.at(-1).onClick();

    expect(props.onNameChange).toHaveBeenCalledWith("New template");
    expect(props.onDescriptionChange).toHaveBeenCalledWith("New description");
    expect(props.onModeChange).toHaveBeenCalledWith("config");
    expect(props.onModeChange).toHaveBeenCalledWith("yaml");
    expect(props.onDefaultChange).toHaveBeenCalledWith(true);
    expect(props.onPublicChange).toHaveBeenCalledWith(true);
    expect(props.onYamlContentChange).toHaveBeenCalledWith("");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onUpload).toHaveBeenCalled();
  });

  it("renders yaml/uploading and default-public states", () => {
    const { html, props } = renderDialog({
      mode: "yaml",
      yamlContent: "",
      isUploading: true,
      asDefault: true,
      isPublic: true,
      showVisibilityControls: false,
    });

    expect(html).toContain("YAML 模板上传开发中。");
    expect(html).toContain("配置内容（YAML）");
    expect(html).toContain("loader-icon");
    expect(html).not.toContain("公开模板");
    mocks.textareas[1].onChange({ target: { value: "mixed-port: 7890" } });
    expect(props.onYamlContentChange).toHaveBeenCalledWith("mixed-port: 7890");
    expect(mocks.buttons.at(-1)).toEqual(expect.objectContaining({ disabled: true }));

    renderDialog({
      mode: "yaml",
      yamlContent: "mixed-port: 7890",
      isUploading: false,
    });
    expect(mocks.buttons.at(-1)).toEqual(expect.objectContaining({ disabled: false }));
  });

  it("renders non-admin public visibility without default controls", () => {
    const { html, props } = renderDialog({
      userIsAdmin: false,
      isPublic: true,
      asDefault: false,
    });

    expect(html).toContain("公开模板");
    expect(html).toContain("其他用户可以搜索和使用此模板");
    expect(html).toContain("globe-icon");
    expect(mocks.rawButtons).toHaveLength(1);
    mocks.rawButtons[0].onClick();
    expect(props.onPublicChange).toHaveBeenCalledWith(false);
  });

  it("keeps default templates public and locks the visibility toggle", () => {
    const { html, props } = renderDialog({
      asDefault: true,
      isPublic: true,
    });

    expect(html).toContain("默认模板");
    expect(html).toContain("将展示在默认模板中");
    mocks.rawButtons[1].onClick();
    expect(props.onPublicChange).not.toHaveBeenCalled();
  });
});
