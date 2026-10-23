import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captures: {} as Record<string, any>,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => React.createElement("span", null, "AlertTriangle"),
  HelpCircle: () => React.createElement("span", null, "HelpCircle"),
  XCircle: () => React.createElement("span", null, "XCircle"),
}));

vi.mock("@subboost/ui/components/coss/compat/button", () => ({
  Button: (props: any) => {
    mocks.captures.buttons.push(props);
    return React.createElement("button", props, props.children);
  },
}));

vi.mock("@subboost/ui/components/coss/compat/dialog", () => ({
  Dialog: (props: any) => {
    mocks.captures.dialog = props;
    return React.createElement("div", { "data-open": String(props.open) }, props.children);
  },
  DialogContent: (props: any) => props.children,
  DialogDescription: (props: any) => React.createElement("p", props, props.children),
  DialogFooter: (props: any) => props.children,
  DialogHeader: (props: any) => props.children,
  DialogTitle: (props: any) => React.createElement("h2", props, props.children),
}));

async function loadConfirmDialogModule() {
  vi.resetModules();
  mocks.captures = { buttons: [] };
  return import("./confirm-dialog");
}

function renderHost(Host: React.ComponentType) {
  mocks.captures = { buttons: [] };
  return renderToStaticMarkup(React.createElement(Host));
}

function buttonText(children: unknown): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(buttonText).join("");
  if (React.isValidElement(children)) return buttonText((children.props as { children?: unknown }).children);
  return "";
}

function findButton(label: string) {
  return mocks.captures.buttons.find((props: any) => buttonText(props.children).includes(label));
}

describe("confirm dialog", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("renders inactive host with default closed state", async () => {
    const { ConfirmDialogHost } = await loadConfirmDialogModule();

    const html = renderHost(ConfirmDialogHost);

    expect(html).toContain('data-open="false"');
    expect(html).toContain("HelpCircle");
    expect(html).toContain("取消");
    expect(html).toContain("确认");
  });

  it("resolves queued confirmations in order", async () => {
    const { ConfirmDialogHost, confirmDialog } = await loadConfirmDialogModule();

    const first = confirmDialog({
      title: "Delete item",
      description: "This cannot be undone.",
      confirmText: "Delete",
      cancelText: "Keep",
      variant: "destructive",
    });
    const second = confirmDialog({ title: "Proceed?", variant: "warning" });

    let html = renderHost(ConfirmDialogHost);
    expect(html).toContain('data-open="true"');
    expect(html).toContain("XCircle");
    expect(html).toContain("Delete item");
    expect(html).toContain("This cannot be undone.");

    findButton("Delete").onClick();
    await expect(first).resolves.toBe(true);

    html = renderHost(ConfirmDialogHost);
    expect(html).toContain("AlertTriangle");
    expect(html).toContain("Proceed?");

    findButton("取消").onClick();
    await expect(second).resolves.toBe(false);
    expect(renderHost(ConfirmDialogHost)).toContain('data-open="false"');
  });

  it("cancels the active request when the dialog is closed externally", async () => {
    const { ConfirmDialogHost, confirmDialog } = await loadConfirmDialogModule();

    const pending = confirmDialog({ title: "Close me" });
    renderHost(ConfirmDialogHost);
    mocks.captures.dialog.onOpenChange(false);

    await expect(pending).resolves.toBe(false);
    expect(renderHost(ConfirmDialogHost)).toContain('data-open="false"');
  });
});
