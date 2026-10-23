import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buttons: [] as any[],
  routerPush: vi.fn(),
  storeState: { nodes: [] as any[], sources: [] as any[] },
  isSourcePendingImport: vi.fn(),
  listeners: new Map<string, EventListener>(),
}));

const stateMock = vi.hoisted(() => ({
  enabled: false,
  callIndex: 0,
  overrides: {} as Record<number, unknown>,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useMemo: (factory: () => unknown) => factory(),
    useEffect: (effect: () => void | (() => void)) => {
      effect();
    },
    useState: (initial: unknown) => {
      if (!stateMock.enabled) return actual.useState(initial);
      const index = stateMock.callIndex++;
      const value = Object.prototype.hasOwnProperty.call(stateMock.overrides, index)
        ? stateMock.overrides[index]
        : initial;
      const setter = vi.fn((next: unknown) => {
        const resolved = typeof next === "function" ? (next as (prev: unknown) => unknown)(value) : next;
        (setter as any).lastValue = resolved;
        return resolved;
      });
      stateMock.setters[index] = setter;
      return [value, setter];
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => React.createElement("span", null, "alert"),
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: (selector: unknown) => selector,
}));

vi.mock("@subboost/ui/components/coss/compat/dialog", () => ({
  Dialog: (props: any) => React.createElement("div", { "data-open": props.open }, props.children),
  DialogContent: (props: any) => React.createElement("section", null, props.children),
  DialogDescription: (props: any) => React.createElement("p", null, props.children),
  DialogFooter: (props: any) => React.createElement("footer", null, props.children),
  DialogHeader: (props: any) => React.createElement("header", null, props.children),
  DialogTitle: (props: any) => React.createElement("h2", null, props.children),
}));

vi.mock("@subboost/ui/components/coss/compat/button", () => ({
  Button: (props: any) => {
    mocks.buttons.push(props);
    return React.createElement("button", props, props.children);
  },
}));

vi.mock("@subboost/ui/product/subscription/source-import-state", () => ({
  isSourcePendingImport: mocks.isSourcePendingImport,
}));

vi.mock("@subboost/ui/store/config-store", () => ({
  useConfigStore: (selector: (state: typeof mocks.storeState) => unknown) => selector(mocks.storeState),
}));

import { UnsavedPrompt, useUnsavedChanges } from "./unsaved-prompt";

function stubBrowser(webdriver = false) {
  mocks.listeners.clear();
  vi.stubGlobal("navigator", { webdriver });
  vi.stubGlobal("window", {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      mocks.listeners.set(type, listener);
    }),
    removeEventListener: vi.fn((type: string) => {
      mocks.listeners.delete(type);
    }),
  });
  vi.stubGlobal("document", {
    addEventListener: vi.fn((type: string, listener: EventListener) => { mocks.listeners.set(type, listener); }),
    removeEventListener: vi.fn(),
  });
}

function renderPrompt(overrides: Record<number, unknown> = {}) {
  stateMock.enabled = true;
  stateMock.callIndex = 0;
  stateMock.overrides = overrides;
  stateMock.setters = [];
  mocks.buttons = [];
  try {
    const html = renderToStaticMarkup(React.createElement(UnsavedPrompt));
    return { html, setters: stateMock.setters, buttons: mocks.buttons };
  } finally {
    stateMock.enabled = false;
  }
}

describe("UnsavedPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.storeState = { nodes: [], sources: [] };
    mocks.isSourcePendingImport.mockImplementation((source: any) => Boolean(source.pending));
    stubBrowser(false);
  });

  it("registers beforeunload and exposes the global unsaved-check function", () => {
    mocks.storeState = { nodes: [{ name: "node-1" }], sources: [] };
    renderPrompt();

    expect((window as any).__checkUnsavedChanges()).toBe(true);
    const event = { preventDefault: vi.fn(), returnValue: "" } as any;
    mocks.listeners.get("beforeunload")?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe("您有未保存的配置更改，确定要离开吗？");
  });

  it("keeps beforeunload protection in automated browsers too", () => {
    stubBrowser(true);
    mocks.storeState = { nodes: [{ name: "node-1" }], sources: [] };
    renderPrompt();

    expect(mocks.listeners.has("beforeunload")).toBe(true);
  });

  it("renders the dialog and handles cancel/confirm callbacks", () => {
    const { html, buttons, setters } = renderPrompt({ 0: true, 1: "/next" });

    expect(html).toContain("未保存的更改");
    buttons.find((button) => button.variant === "outline").onClick();
    expect(setters[0]).toHaveBeenCalledWith(false);
    expect(setters[1]).toHaveBeenCalledWith(null);

    buttons.find((button) => button.variant === "destructive").onClick();
    expect(mocks.routerPush).toHaveBeenCalledWith("/next");
    expect(setters[1]).toHaveBeenLastCalledWith(null);
  });

  it("computes unsaved state from nodes and pending sources", () => {
    mocks.storeState = { nodes: [], sources: [] };
    expect(useUnsavedChanges()).toBe(false);

    mocks.storeState = { nodes: [], sources: [{ content: "ss://example", pending: true }] };
    expect(useUnsavedChanges()).toBe(true);

    mocks.storeState = { nodes: [{ name: "node-1" }], sources: [] };
    expect(useUnsavedChanges()).toBe(true);
  });
});
