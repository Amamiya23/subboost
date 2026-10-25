import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captures = vi.hoisted(() => ({
  buttons: [] as any[],
  inputs: [] as any[],
  switches: [] as any[],
  dialogs: [] as any[],
}));

vi.mock("@subboost/core/subscription/auto-update-interval", () => ({
  getAutoUpdateIntervalPolicyMinLabel: (policy: { minHours: number }) => `${policy.minHours} 小时`,
  resolveAutoUpdateIntervalPolicy: (isAdmin: boolean) => ({
    defaultHours: 24,
    minHours: isAdmin ? 1 : 6,
    stepHours: 1,
    requireIntegerHours: true,
  }),
}));

vi.mock("@subboost/ui/components/subscription/smart-node-matching-help", () => ({
  SmartNodeMatchingHelp: ({ enabled }: { enabled: boolean }) =>
    React.createElement("span", null, enabled ? "smart-on" : "smart-off"),
}));

vi.mock("@subboost/ui/components/coss/compat/button", () => ({
  Button: (props: any) => {
    captures.buttons.push(props);
    return React.createElement("button", props, props.children);
  },
}));

vi.mock("@subboost/ui/components/coss/compat/input", () => ({
  Input: (props: any) => {
    captures.inputs.push(props);
    return React.createElement("input", props);
  },
}));

vi.mock("@subboost/ui/components/coss/compat/label", () => ({
  Label: (props: any) => React.createElement("label", props, props.children),
}));

vi.mock("@subboost/ui/components/coss/compat/switch", () => ({
  Switch: (props: any) => {
    captures.switches.push(props);
    return React.createElement("button", {
      type: "button",
      "data-checked": String(props.checked),
      onClick: () => props.onCheckedChange?.(!props.checked),
    });
  },
}));

vi.mock("@subboost/ui/components/coss/compat/dialog", () => ({
  Dialog: (props: any) => {
    captures.dialogs.push(props);
    return React.createElement("div", null, props.children);
  },
  DialogContent: (props: any) => React.createElement("div", props, props.children),
  DialogDescription: (props: any) => React.createElement("p", props, props.children),
  DialogFooter: (props: any) => React.createElement("footer", props, props.children),
  DialogHeader: (props: any) => React.createElement("header", props, props.children),
  DialogPanel: (props: any) => React.createElement("div", props, props.children),
  DialogTitle: (props: any) => React.createElement("h2", props, props.children),
}));

import { SubscriptionSettingsDialog } from "./subscription-settings-dialog";

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  subscription: {
    id: "sub-1",
    name: "Primary",
    subscriptionUrl: "https://example.com/sub",
    isPrimary: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastUpdatedAt: null,
    autoUpdateInterval: null,
    smartNodeMatchingEnabled: true,
    autoUpdateState: {
      disabledAt: "2026-01-02T00:00:00.000Z",
      disabledReason: "fetch_failed",
    },
  } as any,
  settingsName: "Primary",
  setSettingsName: vi.fn(),
  smartNodeMatchingEnabled: true,
  setSmartNodeMatchingEnabled: vi.fn(),
  autoUpdateEnabled: false,
  setAutoUpdateEnabled: vi.fn(),
  autoUpdateHours: 24,
  setAutoUpdateHours: vi.fn(),
  savingSettings: false,
  onSave: vi.fn(),
  userIsAdmin: false,
};

describe("SubscriptionSettingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captures.buttons = [];
    captures.inputs = [];
    captures.switches = [];
    captures.dialogs = [];
  });

  it("renders disabled auto-update warning and wires basic controls", () => {
    const html = renderToStaticMarkup(React.createElement(SubscriptionSettingsDialog, baseProps));

    expect(captures.dialogs[0]).toMatchObject({ open: true });
    expect(html).toContain("订阅设置");
    expect(html).toContain("最小 6 小时");
    expect(html).toContain("自动更新已关闭：fetch_failed");
    expect(captures.inputs[0]).toMatchObject({ value: "Primary", maxLength: 100 });
    expect(captures.switches).toHaveLength(2);

    captures.inputs[0].onChange({ target: { value: "Renamed" } });
    captures.switches[0].onCheckedChange(false);
    captures.switches[1].onCheckedChange(true);
    captures.buttons[0].onClick();
    captures.buttons[1].onClick();

    expect(baseProps.setSettingsName).toHaveBeenCalledWith("Renamed");
    expect(baseProps.setSmartNodeMatchingEnabled).toHaveBeenCalledWith(false);
    expect(baseProps.setAutoUpdateEnabled).toHaveBeenCalledWith(true);
    expect(baseProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(baseProps.onSave).toHaveBeenCalled();
  });

  it("renders auto-update interval input and saving state", () => {
    const html = renderToStaticMarkup(
      React.createElement(SubscriptionSettingsDialog, {
        ...baseProps,
        autoUpdateEnabled: true,
        autoUpdateHours: 12,
        savingSettings: true,
        userIsAdmin: true,
      })
    );

    expect(html).toContain("最小 1 小时");
    expect(html).toContain("自动更新间隔");
    expect(captures.inputs[1]).toMatchObject({ type: "number", min: 1, value: 12 });
    expect(captures.buttons[0]).toMatchObject({ disabled: true });
    expect(captures.buttons[1]).toMatchObject({ disabled: true });

    captures.inputs[1].onChange({ target: { value: "18" } });
    expect(baseProps.setAutoUpdateHours).toHaveBeenCalledWith(18);
  });
});
