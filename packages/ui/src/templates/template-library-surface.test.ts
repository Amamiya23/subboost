import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captures: {} as Record<string, any>,
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  searchParams: {
    get: vi.fn(),
  },
  userStore: {} as Record<string, any>,
  configStore: {} as Record<string, any>,
  confirmDialog: vi.fn(),
  toast: vi.fn(),
}));

const stateMock = vi.hoisted(() => ({
  enabled: false,
  callIndex: 0,
  overrides: {} as Record<number, unknown>,
  runEffectCleanups: false,
  runEffects: false,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void), deps?: React.DependencyList) => {
      if (!stateMock.runEffects) return actual.useEffect(effect, deps);
      const cleanup = effect();
      if (stateMock.runEffectCleanups && typeof cleanup === "function") cleanup();
      return undefined;
    },
    useState: (initial: unknown) => {
      if (!stateMock.enabled) return actual.useState(initial);
      const index = stateMock.callIndex++;
      const value = Object.prototype.hasOwnProperty.call(stateMock.overrides, index) ? stateMock.overrides[index] : initial;
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
  useRouter: () => mocks.router,
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("lucide-react", () => ({
  FileCode: () => null,
  Loader2: () => null,
  Plus: () => null,
  Search: () => null,
  Upload: () => null,
}));
vi.mock("@subboost/ui/components/ui/button", () => ({
  Button: (props: any) => {
    mocks.captures.buttons.push(props);
    return null;
  },
}));
vi.mock("@subboost/ui/components/ui/input", () => ({
  Input: (props: any) => {
    mocks.captures.input = props;
    return null;
  },
}));
vi.mock("@subboost/ui/components/ui/tabs", () => ({
  Tabs: (props: any) => {
    mocks.captures.tabs = props;
    return props.children;
  },
  TabsContent: (props: any) => (props.value === mocks.captures.tabs?.value ? props.children : null),
  TabsList: (props: any) => props.children,
  TabsTrigger: (props: any) => {
    mocks.captures.tabTriggers.push(props);
    return null;
  },
}));
vi.mock("@subboost/ui/components/ui/confirm-dialog", () => ({ confirmDialog: mocks.confirmDialog }));
vi.mock("@subboost/ui/components/ui/toaster", () => ({ toast: mocks.toast }));
vi.mock("@subboost/ui/store/user-store", () => ({ useUserStore: () => mocks.userStore }));
vi.mock("@subboost/ui/store/config-store", () => {
  const useConfigStore = () => mocks.configStore;
  useConfigStore.getState = () => mocks.configStore;
  return { useConfigStore };
});
vi.mock("@subboost/core/templates/builtin", () => ({ builtinIdToType: (id: string) => (id === "builtin-minimal" ? "minimal" : null) }));
vi.mock("@subboost/core/time/beijing", () => ({ formatDateInBeijing: (iso: string) => `fmt:${iso}` }));
vi.mock("@subboost/ui/product/interactions", () => ({
  ProductInteractionAdapterProvider: (props: any) => props.children,
}));
vi.mock("@subboost/ui/templates/template-card", () => ({
  TemplateCard: (props: any) => {
    mocks.captures.cards.push(props);
    return null;
  },
}));
vi.mock("@subboost/ui/templates/template-upload-dialog", () => ({
  TemplateUploadDialog: (props: any) => {
    mocks.captures.uploadDialog = props;
    return null;
  },
}));
vi.mock("./template-editor-dialog", () => ({
  TemplateEditorDialog: (props: any) => {
    mocks.captures.editor = props;
    return null;
  },
}));

import { TemplateLibrarySurface } from "./template-library-surface";

const templates = [
  {
    id: "builtin-minimal",
    name: "Minimal",
    description: "Built in",
    tags: ["basic"],
    engagementCount: 999,
    isEngaged: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "tpl-config",
    name: "Work Config",
    description: "Proxy groups",
    tags: ["work", "basic"],
    engagementCount: 12,
    isEngaged: false,
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "tpl-yaml",
    name: "Yaml Template",
    description: "Raw yaml",
    tags: ["yaml"],
    engagementCount: 1,
    isEngaged: true,
    updatedAt: "2026-01-03T00:00:00.000Z",
  },
];

function createAdapter(overrides: Record<string, unknown> = {}) {
  return {
    interactions: {
      templateUploadOpened: vi.fn(),
      templateSelected: vi.fn(),
      templateApplied: vi.fn(),
      templateEngagementToggled: vi.fn(),
      templateSearchCompleted: vi.fn(),
    },
    labels: {
      catalogTab: "公开模板",
      engagementAction: "喜欢",
      engagementLoginRequired: "登录后喜欢",
    },
    enabledTabs: { default: true, catalog: true, my: true },
    allowUpload: true,
    allowEngagement: true,
    allowDelete: true,
    allowPublicTemplates: true,
    uploadSearchParam: true,
    loadTemplates: vi.fn(async () => templates),
    loadTemplateDetail: vi.fn(async (id: string) => {
      if (id === "builtin-minimal") return { kind: "config", name: "Edited minimal", config: { template: "minimal", mixedPort: 9999 } };
      if (id === "tpl-config") return { kind: "config", config: { template: "minimal" } };
      if (id === "tpl-yaml") return { kind: "yaml", config: "yaml" };
      return null;
    }),
    deleteTemplate: vi.fn(async () => undefined),
    updateTemplate: vi.fn(async () => undefined),
    resetTemplate: vi.fn(async () => undefined),
    toggleTemplateEngagement: vi.fn(async () => ({ engagementCount: 13, isEngaged: true })),
    uploadTemplate: vi.fn(async () => undefined),
    ...overrides,
  } as any;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function textOf(children: unknown): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (React.isValidElement(children)) return textOf((children.props as { children?: unknown }).children);
  return "";
}

function renderSurface(
  adapter = createAdapter(),
  overrides: Record<number, unknown> = {},
  options: { runEffectCleanups?: boolean; runEffects?: boolean } = {}
) {
  stateMock.enabled = true;
  stateMock.callIndex = 0;
  stateMock.overrides = overrides;
  stateMock.runEffectCleanups = Boolean(options.runEffectCleanups);
  stateMock.runEffects = Boolean(options.runEffects);
  stateMock.setters = [];
  mocks.captures.buttons = [];
  mocks.captures.tabTriggers = [];
  mocks.captures.cards = [];
  mocks.captures.uploadDialog = undefined;
  mocks.captures.editor = undefined;
  try {
    const html = renderToStaticMarkup(React.createElement(TemplateLibrarySurface, { adapter }));
    return { html, setters: stateMock.setters, adapter };
  } finally {
    stateMock.enabled = false;
    stateMock.runEffectCleanups = false;
    stateMock.runEffects = false;
  }
}

describe("TemplateLibrarySurface", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    mocks.captures = { buttons: [], tabTriggers: [], cards: [] };
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.searchParams.get.mockReturnValue(null);
    mocks.userStore = { user: { id: "user-1", isAdmin: true }, fetchUser: vi.fn() };
    mocks.configStore = {
      template: "minimal",
      enabledProxyGroups: ["Auto"],
      hiddenProxyGroups: [],
      customProxyGroups: [],
      customRuleSets: [],
      builtinRuleEdits: {},
      customRules: [],
      ruleOrder: [],
      dialerProxyGroups: [],
      proxyGroupNameOverrides: {},
      dnsYaml: "",
      mixedPort: 7890,
      allowLan: false,
      testUrl: "https://example.com",
      testInterval: 300,
      ruleProviderBaseUrl: "",
      cnIpNoResolve: false,
      experimentalCnUseCnRuleSet: false,
      setTemplate: vi.fn(),
      applyTemplateConfig: vi.fn(),
      setAppliedTemplateId: vi.fn(),
    };
  });

  it("renders tabs, filters templates, and opens upload from the header", () => {
    const { setters, adapter } = renderSurface(createAdapter(), { 0: "work", 1: "work", 2: "catalog", 3: templates });

    expect(mocks.captures.tabs).toEqual(expect.objectContaining({ value: "catalog" }));
    expect(mocks.captures.tabTriggers.map((props: any) => props.value)).toEqual(["default", "catalog", "my"]);
    expect(mocks.captures.cards).toHaveLength(1);
    expect(mocks.captures.cards[0]).toEqual(expect.objectContaining({ template: templates[1], engagementActionLabel: "喜欢" }));
    expect(mocks.captures.cards[0].formatDate("2026-01-01T00:00:00.000Z")).toBe("fmt:2026-01-01T00:00:00.000Z");
    expect(mocks.captures.cards[0].formatNumber(1500)).toBe("1.5k");
    expect(mocks.captures.cards[0].formatNumber(12)).toBe("12");

    mocks.captures.input.onChange({ target: { value: "yaml" } });
    expect(setters[0]).toHaveBeenCalledWith("yaml");
    mocks.captures.buttons.find((props: any) => props.children === "全部").onClick();
    expect(setters[1]).toHaveBeenCalledWith(null);
    mocks.captures.buttons.find((props: any) => props.children === "basic").onClick();
    expect(setters[1]).toHaveBeenCalledWith("basic");
    mocks.captures.tabs.onValueChange("my");
    expect(setters[2]).toHaveBeenCalledWith("my");

    mocks.captures.buttons[0].onClick();
    expect(adapter.interactions.templateUploadOpened).toHaveBeenCalledWith({ entry: "templatesPage" });
    expect(setters[6]).toHaveBeenCalledWith(true);
    expect(setters[7]).toHaveBeenCalledWith("");
    expect(setters[12]).toHaveBeenCalledWith("config");
  });

  it("applies builtin, config, yaml, missing, and failing templates", async () => {
    const adapter = createAdapter();
    renderSurface(adapter, { 2: "catalog", 3: templates });

    await mocks.captures.cards[0].onApply();
    expect(adapter.loadTemplateDetail).toHaveBeenCalledWith("builtin-minimal");
    expect(mocks.configStore.applyTemplateConfig).toHaveBeenCalledWith({ template: "minimal", mixedPort: 9999 });
    expect(mocks.configStore.setTemplate).not.toHaveBeenCalled();
    expect(adapter.interactions.templateSelected).toHaveBeenCalledWith({ source: "builtin", templateType: "minimal" });
    expect(mocks.router.push).toHaveBeenCalledWith("/");

    await mocks.captures.cards[1].onApply();
    expect(mocks.configStore.setAppliedTemplateId).toHaveBeenCalledWith("tpl-config");
    expect(mocks.configStore.applyTemplateConfig).toHaveBeenCalledWith({ template: "minimal" });
    expect(adapter.interactions.templateApplied).toHaveBeenCalledWith({ source: "catalog", kind: "config", result: "success" });

    await mocks.captures.cards[2].onApply();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("YAML 模板无法一键应用"), variant: "warning" }));
    expect(adapter.interactions.templateApplied).toHaveBeenCalledWith({ source: "catalog", kind: "yaml", result: "validationError" });

    adapter.loadTemplateDetail.mockResolvedValueOnce(null);
    await mocks.captures.cards[1].onApply();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "获取模板失败", variant: "destructive" }));

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    adapter.loadTemplateDetail.mockRejectedValueOnce(new Error("offline"));
    await mocks.captures.cards[1].onApply();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "应用模板失败，请稍后重试", variant: "destructive" }));
  });

  it("engages and deletes templates with guards and error handling", async () => {
    const adapter = createAdapter();
    const { setters } = renderSurface(adapter, { 2: "my", 3: templates });

    mocks.captures.cards[1].onEngage();
    await flushPromises();
    expect(adapter.toggleTemplateEngagement).toHaveBeenCalledWith("tpl-config");
    expect(setters[3]).toHaveBeenCalledWith(expect.any(Function));
    expect(adapter.interactions.templateEngagementToggled).toHaveBeenCalledWith({ source: "my", engaged: true });

    mocks.captures.cards[1].onDelete();
    await flushPromises();
    expect(mocks.confirmDialog).toHaveBeenCalledWith(expect.objectContaining({ confirmText: "删除" }));
    expect(adapter.deleteTemplate).toHaveBeenCalledWith("tpl-config");
    expect(setters[3]).toHaveBeenCalledWith(expect.any(Function));

    mocks.confirmDialog.mockResolvedValueOnce(false);
    mocks.captures.cards[2].onDelete();
    await flushPromises();
    expect(adapter.deleteTemplate).not.toHaveBeenCalledWith("tpl-yaml");

    adapter.deleteTemplate.mockRejectedValueOnce(new Error("delete failed"));
    mocks.captures.cards[1].onDelete();
    await flushPromises();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "delete failed", variant: "destructive" }));

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    adapter.toggleTemplateEngagement.mockRejectedValueOnce(new Error("engage failed"));
    mocks.captures.cards[1].onEngage();
    await flushPromises();
  });

  it("opens the saved detail without applying it and persists edits to the same template", async () => {
    const adapter = createAdapter();
    const { setters } = renderSurface(adapter, { 3: templates });
    mocks.captures.cards[0].onView();
    await flushPromises();
    expect(setters[14]).toHaveBeenCalledWith(expect.objectContaining({ id: "builtin-minimal", name: "Edited minimal", config: { template: "minimal", mixedPort: 9999 } }));
    expect(mocks.configStore.applyTemplateConfig).not.toHaveBeenCalled();
    const editor = { id: "builtin-minimal", name: "Edited minimal", description: "desc", config: { template: "minimal" }, isModified: true };
    renderSurface(adapter, { 14: editor });
    expect(mocks.captures.editor.canEdit).toBe(true);
    const payload = { name: "Updated", description: "desc", config: { template: "minimal", mixedPort: 8888 } };
    await mocks.captures.editor.onSave(payload);
    expect(adapter.updateTemplate).toHaveBeenCalledWith("builtin-minimal", payload);
    expect(adapter.loadTemplates).toHaveBeenCalledWith("default");
    await mocks.captures.editor.onReset();
    expect(adapter.resetTemplate).toHaveBeenCalledWith("builtin-minimal");

    mocks.userStore.user = null;
    renderSurface(adapter, { 14: editor });
    expect(mocks.captures.editor.canEdit).toBe(false);
  });

  it("reports detail failures without opening an editor", async () => {
    const adapter = createAdapter();
    const { setters } = renderSurface(adapter, { 3: templates });
    adapter.loadTemplateDetail.mockRejectedValueOnce(new Error("offline"));
    mocks.captures.cards[0].onView();
    await flushPromises();
    expect(mocks.toast).toHaveBeenCalledWith({ title: "offline", variant: "destructive" });
    expect(setters[14]).not.toHaveBeenCalled();
  });

  it("uploads config templates, handles yaml mode, and respects visibility controls", async () => {
    const adapter = createAdapter();
    renderSurface(adapter, {
      2: "my",
      3: templates,
      6: true,
      7: "My Template",
      8: "Description",
      9: false,
      10: true,
      12: "config",
    });

    await mocks.captures.uploadDialog.onUpload();
    expect(adapter.uploadTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "My Template",
        description: "Description",
        isPublic: true,
        isOfficial: true,
        config: expect.objectContaining({
          schema: "subboost-template-config/v1",
          template: "minimal",
          mixedPort: 7890,
        }),
      })
    );
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "模板上传成功！", variant: "success" }));

    renderSurface(adapter, { 6: true, 7: "Yaml", 12: "yaml" });
    await mocks.captures.uploadDialog.onUpload();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "YAML 模板上传开发中", variant: "info" }));

    adapter.uploadTemplate.mockRejectedValueOnce(new Error("upload failed"));
    renderSurface(adapter, { 6: true, 7: "Broken", 12: "config" });
    await mocks.captures.uploadDialog.onUpload();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "upload failed", variant: "destructive" }));

    const noPublicAdapter = createAdapter({ allowPublicTemplates: false });
    renderSurface(noPublicAdapter, { 6: true, 7: "Private", 9: true, 10: true });
    await mocks.captures.uploadDialog.onUpload();
    expect(noPublicAdapter.uploadTemplate).toHaveBeenCalledWith(expect.objectContaining({ isPublic: false }));

    const privateAdapter = createAdapter();
    renderSurface(privateAdapter, { 2: "my", 6: true, 7: "Private", 9: true, 10: false });
    await mocks.captures.uploadDialog.onUpload();
    expect(privateAdapter.loadTemplates).toHaveBeenCalledWith("my");
  });

  it("renders loading, empty, disabled tabs, and guest upload states", () => {
    renderSurface(createAdapter(), { 3: [], 4: true });
    expect(mocks.captures.cards).toEqual([]);

    mocks.userStore = { user: null, fetchUser: vi.fn() };
    renderSurface(createAdapter(), { 2: "my", 3: [] });
    expect(mocks.captures.tabTriggers.map((props: any) => props.value)).toEqual(["default", "catalog"]);
    expect(mocks.captures.uploadDialog).toBeUndefined();

    renderSurface(createAdapter({ enabledTabs: { default: true, catalog: false, my: false }, allowUpload: false }), { 3: [] });
    expect(mocks.captures.tabTriggers.map((props: any) => props.value)).toEqual(["default"]);

    mocks.userStore = { user: { id: "user-1", isAdmin: true }, fetchUser: vi.fn() };
    const { setters, adapter } = renderSurface(createAdapter(), { 2: "my", 3: [] });
    mocks.captures.buttons.find((props: any) => textOf(props.children).includes("创建模板")).onClick();
    expect(adapter.interactions.templateUploadOpened).toHaveBeenCalledWith({ entry: "templatesPage" });
    expect(setters[6]).toHaveBeenCalledWith(true);
  });

  it("runs mount, upload query, load, and search effects", async () => {
    const timerId = 123 as unknown as number;
    const setTimeoutMock = vi.fn((handler: () => void) => {
      handler();
      return timerId;
    });
    const clearTimeoutMock = vi.fn();
    vi.stubGlobal("window", { setTimeout: setTimeoutMock, clearTimeout: clearTimeoutMock });
    mocks.searchParams.get.mockReturnValue("1");
    const adapter = createAdapter();

    const { setters } = renderSurface(
      adapter,
      {
        0: "work",
        3: templates,
      },
      { runEffectCleanups: true, runEffects: true }
    );
    await flushPromises();

    expect(mocks.userStore.fetchUser).toHaveBeenCalled();
    expect(adapter.loadTemplates).toHaveBeenCalledWith("default");
    expect(setters[2]).toHaveBeenCalledWith("my");
    expect(mocks.router.replace).toHaveBeenCalledWith("/templates");
    expect(adapter.interactions.templateSearchCompleted).toHaveBeenCalledWith({ source: "default", resultCount: 1 });
    expect(clearTimeoutMock).toHaveBeenCalledWith(timerId);
  });

  it("handles load failures and invalid active tabs during effects", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failingAdapter = createAdapter({ loadTemplates: vi.fn(async () => {
      throw new Error("offline");
    }) });
    const failed = renderSurface(failingAdapter, {}, { runEffects: true });
    await flushPromises();

    expect(consoleError).toHaveBeenCalledWith("Load templates error:", expect.any(Error));
    expect(failed.setters[3]).toHaveBeenCalledWith([]);
    expect(failed.setters[4]).toHaveBeenCalledWith(false);

    mocks.userStore = { user: null, fetchUser: vi.fn() };
    const guarded = renderSurface(createAdapter(), { 2: "my" }, { runEffects: true });
    expect(guarded.setters[2]).toHaveBeenCalledWith("default");
  });
});
