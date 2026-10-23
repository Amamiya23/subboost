import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultSubBoostTemplateConfig } from "@subboost/core/config/defaults";
import { parseTemplateDocument, serializeTemplateDocument } from "./template-document";

const mocks = vi.hoisted(() => ({
  states: [] as unknown[], index: 0, buttons: [] as any[], inputs: [] as any[], checkboxes: [] as any[], textarea: null as any, dialog: null as any,
  confirm: vi.fn(), toast: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = mocks.index++;
    if (!(index in mocks.states)) mocks.states[index] = typeof initial === "function" ? initial() : initial;
    return [mocks.states[index], (next: unknown) => { mocks.states[index] = typeof next === "function" ? next(mocks.states[index]) : next; }];
  },
}));
vi.mock("react/jsx-runtime", async (original) => {
  const actual = await original<typeof import("react/jsx-runtime")>();
  return { ...actual, jsx: (type: any, props: any, key?: any) => {
    if (type === "input" && props.type === "checkbox") mocks.checkboxes.push(props);
    return actual.jsx(type, props, key);
  } };
});
vi.mock("@subboost/ui/components/coss/compat/button", () => ({ Button: (props: any) => { mocks.buttons.push(props); return null; } }));
vi.mock("@subboost/ui/components/coss/compat/input", () => ({ Input: (props: any) => { mocks.inputs.push(props); return null; } }));
vi.mock("@subboost/ui/components/coss/compat/textarea", () => ({ Textarea: (props: any) => { mocks.textarea = props; return null; } }));
vi.mock("@subboost/ui/components/coss/compat/dialog", () => ({
  Dialog: (props: any) => { mocks.dialog = props; return props.children; },
  DialogContent: (props: any) => props.children, DialogHeader: (props: any) => props.children,
  DialogTitle: (props: any) => props.children, DialogDescription: (props: any) => props.children, DialogFooter: (props: any) => props.children,
}));
vi.mock("@subboost/ui/components/coss/compat/tabs", () => ({ Tabs: (props: any) => props.children, TabsList: (props: any) => props.children, TabsTrigger: (props: any) => props.children, TabsContent: (props: any) => props.children }));
vi.mock("@subboost/ui/components/ui/confirm-dialog", () => ({ confirmDialog: mocks.confirm }));
vi.mock("@subboost/ui/components/coss/compat/toaster", () => ({ toast: mocks.toast }));
import { TemplateEditorDialog } from "./template-editor-dialog";

const template = { id: "builtin-minimal", name: "精简版", description: "默认", config: buildDefaultSubBoostTemplateConfig("minimal"), isModified: true };
function render(overrides: Partial<React.ComponentProps<typeof TemplateEditorDialog>> = {}) {
  mocks.index = 0; mocks.buttons = []; mocks.inputs = []; mocks.checkboxes = [];
  const props = { template, canEdit: true, onClose: vi.fn(), onSave: vi.fn(async () => {}), onReset: vi.fn(async () => {}), ...overrides };
  const html = renderToStaticMarkup(React.createElement(TemplateEditorDialog, props));
  return { props, html };
}
function button(text: string) { return mocks.buttons.find((props: any) => React.Children.toArray(props.children).includes(text)); }

describe("TemplateEditorDialog", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.states = []; mocks.confirm.mockResolvedValue(true); });

  it("edits template content without touching the active configuration", async () => {
    render();
    expect(button("保存修改").disabled).toBe(true);
    mocks.inputs[0].onChange({ target: { value: "定制模板" } });
    const source = serializeTemplateDocument({ ...template.config, mixedPort: 9999 });
    mocks.textarea.onChange({ target: { value: source } });
    const { props } = render();
    expect(button("保存修改").disabled).toBe(false);
    await button("保存修改").onClick();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "定制模板", config: expect.objectContaining({ mixedPort: 9999 }) }));
  });

  it("keeps group selection and source synchronized", () => {
    render();
    const firstEnabled = mocks.checkboxes.find((item) => item.checked && !item.disabled);
    expect(firstEnabled).toBeDefined();
    const before = template.config.enabledProxyGroups!.length;
    firstEnabled.onChange();
    const parsed = parseTemplateDocument(mocks.states[2] as string);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.config.enabledProxyGroups).toHaveLength(before - 1);
  });

  it("unhides enabled groups and prevents removing the last visible group", () => {
    mocks.states[2] = serializeTemplateDocument({ ...template.config, enabledProxyGroups: ["select", "auto"], hiddenProxyGroups: ["auto"] });
    render();
    mocks.checkboxes[0].onChange();
    expect(parseTemplateDocument(mocks.states[2] as string).ok).toBe(true);
    mocks.checkboxes[1].onChange();
    const parsed = parseTemplateDocument(mocks.states[2] as string);
    expect(parsed).toMatchObject({ ok: true, config: { enabledProxyGroups: ["select", "auto"], hiddenProxyGroups: [] } });
  });

  it("shows validation errors and prevents saving invalid source", async () => {
    mocks.states[2] = "[";
    const { html, props } = render();
    expect(html).toContain('role="alert"');
    expect(mocks.textarea["aria-invalid"]).toBe(true);
    expect(button("保存修改").disabled).toBe(true);
    await button("保存修改").onClick();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("makes guest inspection read-only", () => {
    const { html } = render({ canEdit: false });
    expect(html).toContain("查看模板");
    expect(mocks.inputs.every((input) => input.readOnly)).toBe(true);
    expect(mocks.textarea.readOnly).toBe(true);
    expect(mocks.checkboxes.every((input) => input.disabled)).toBe(true);
    expect(button("保存修改")).toBeUndefined();
    expect(button("恢复内置")).toBeUndefined();
  });

  it("confirms discard and reset and keeps failed saves open", async () => {
    mocks.states[0] = "Unsaved";
    const { props } = render({ onSave: vi.fn(async () => { throw new Error("offline"); }) });
    mocks.confirm.mockResolvedValueOnce(false);
    await button("取消").onClick();
    expect(props.onClose).not.toHaveBeenCalled();
    await button("保存修改").onClick();
    expect(mocks.toast).toHaveBeenCalledWith({ title: "offline", variant: "destructive" });
    await button("恢复内置").onClick();
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ confirmText: "恢复内置" }));
    expect(props.onReset).toHaveBeenCalledOnce();
  });
});
