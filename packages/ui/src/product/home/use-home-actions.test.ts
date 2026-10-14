import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const useConfigStore = vi.fn() as any;
  const bag = {
    storeState: {
      sources: [] as any[],
      nodes: [] as any[],
      template: "full",
      customRules: [] as any[],
      customProxyGroups: [] as any[],
      dnsYaml: "",
      listenerPorts: {} as Record<string, unknown>,
      generatedYamlError: null as string | null,
      isLoading: false,
      parseSingleSource: vi.fn(async (_id: string) => undefined),
    },
    interactions: {
      configDownloaded: vi.fn(),
      configGenerated: vi.fn(),
      sourceImported: vi.fn(),
    },
  };
  useConfigStore.getState = vi.fn(() => bag.storeState);
  useConfigStore.setState = vi.fn((patch) => Object.assign(bag.storeState, patch));

  return {
    bag,
    toast: vi.fn(),
    useConfigStore,
    useProductInteractionAdapter: vi.fn(() => bag.interactions),
    useCallback: vi.fn((callback: unknown) => callback),
    useMemo: vi.fn((factory: () => unknown) => factory()),
  };
});

vi.mock("react", () => ({
  useCallback: mocks.useCallback,
  useMemo: mocks.useMemo,
}));

vi.mock("@subboost/ui/product/interactions", () => ({
  useProductInteractionAdapter: mocks.useProductInteractionAdapter,
}));

vi.mock("@subboost/core/time/beijing", () => ({
  getCompactDateStampInBeijing: () => "20260606",
}));

vi.mock("@subboost/ui/store/config-store", () => ({
  useConfigStore: mocks.useConfigStore,
}));

vi.mock("@subboost/ui/components/ui/toaster", () => ({
  toast: mocks.toast,
}));

import { useHomeActions } from "./use-home-actions";

function makeSource(overrides: Record<string, unknown> = {}) {
  return {
    id: "source-1",
    type: "yaml",
    content: "proxies: []",
    parsed: false,
    parsing: false,
    ...overrides,
  } as any;
}

function makeOptions(overrides: Record<string, unknown> = {}) {
  return {
    generatedYaml: "mode: rule",
    generatedYamlError: null,
    appliedTemplateId: "template-1",
    recordConfigDownload: vi.fn(),
    storeSources: [],
    nodes: [],
    clearNodes: vi.fn(),
    parseMultipleSources: vi.fn(async () => undefined),
    generateConfig: vi.fn(() => "mode: changed"),
    ...overrides,
  } as any;
}

function useRenderedHook(overrides: Record<string, unknown> = {}) {
  return useHomeActions(makeOptions(overrides));
}

describe("useHomeActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bag.storeState = {
      sources: [],
      nodes: [],
      template: "full",
      customRules: [],
      customProxyGroups: [],
      dnsYaml: "",
      listenerPorts: {},
      generatedYamlError: null,
      isLoading: false,
      parseSingleSource: vi.fn(async (_id: string) => undefined),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("imports pending sources without clearing existing nodes", async () => {
    const existing = { name: "Existing node" };
    const pending = makeSource();
    mocks.bag.storeState.nodes = [existing];
    mocks.bag.storeState.sources = [pending];
    mocks.bag.storeState.parseSingleSource.mockImplementation(async () => {
      pending.parsed = true;
      mocks.bag.storeState.nodes.push({ name: "Imported node" });
    });
    const options = makeOptions({ nodes: [existing], storeSources: [pending] });
    await useHomeActions(options).handleGenerate("quick");
    expect(options.clearNodes).not.toHaveBeenCalled();
    expect(mocks.bag.storeState.nodes).toContain(existing);
    expect(options.generateConfig).toHaveBeenCalledOnce();
    expect(mocks.bag.storeState.isLoading).toBe(false);
  });

  it("keeps failed pending sources visible and does not report successful generation", async () => {
    const pending = makeSource();
    mocks.bag.storeState.sources = [pending];
    const options = makeOptions({ nodes: [{ name: "Existing" }], storeSources: [pending] });
    await useHomeActions(options).handleGenerate("quick");
    expect(options.generateConfig).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "配置尚未就绪", variant: "warning" }));
    expect(mocks.bag.storeState.isLoading).toBe(false);
  });

  it("downloads generated YAML and records the interaction", () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const anchor = { href: "", download: "", style: { display: "" }, click };
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const createObjectURL = vi.fn(() => "blob:config");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", {
      body: { appendChild, removeChild },
      createElement: vi.fn(() => anchor),
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    mocks.bag.storeState.nodes = [{ name: "Node A" }, { name: "Node B" }];
    mocks.bag.storeState.template = "minimal";

    const recordConfigDownload = vi.fn();
    const { handleDownload } = useRenderedHook({ recordConfigDownload });

    handleDownload("quick");
    expect(recordConfigDownload).toHaveBeenCalledWith("template-1");
    expect(mocks.bag.interactions.configDownloaded).toHaveBeenCalledWith({
      mode: "quick",
      nodeCount: 2,
      templateType: "minimal",
    });
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(File));
    expect(anchor).toEqual(expect.objectContaining({
      href: "blob:config",
      download: "clash-config-20260606.yaml",
    }));
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(removeChild).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:config");
  });

  it("skips downloads when YAML is empty or invalid", () => {
    const recordConfigDownload = vi.fn();

    useRenderedHook({ generatedYaml: "", recordConfigDownload }).handleDownload("quick");
    useRenderedHook({ generatedYamlError: "bad yaml", recordConfigDownload }).handleDownload("advanced");

    expect(recordConfigDownload).not.toHaveBeenCalled();
    expect(mocks.bag.interactions.configDownloaded).not.toHaveBeenCalled();
  });

  it("generates from existing nodes without re-importing pending sources", async () => {
    const generateConfig = vi.fn(() => "after");
    const parseMultipleSources = vi.fn();
    const { handleGenerate, hasValidSources } = useRenderedHook({
      generatedYaml: "before",
      nodes: [{ name: "Node A" }],
      storeSources: [makeSource()],
      generateConfig,
      parseMultipleSources,
    });

    expect(hasValidSources).toBe(true);
    await handleGenerate("advanced", false);

    expect(generateConfig).toHaveBeenCalled();
    expect(parseMultipleSources).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "已生成配置（存在待导入源）",
      description: "本次仅使用当前节点，未导入的来源不会包含在下载配置中。",
      variant: "info",
    });
    expect(mocks.bag.interactions.configGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "advanced", result: "success" })
    );
  });

  it("generates from existing nodes when there are no pending imports", async () => {
    mocks.bag.storeState.sources = [
      makeSource({ content: "proxies: []", parsed: true, lastParsedContent: "proxies: []" }),
      makeSource({ id: "empty", content: "   ", parsed: true }),
    ];
    mocks.bag.storeState.nodes = [{ name: "Node A" }, { name: "Node B" }];
    mocks.bag.storeState.customRules = [{ id: "rule-1" }];
    mocks.bag.storeState.customProxyGroups = [{ id: "group-1" }];
    mocks.bag.storeState.dnsYaml = "nameserver: []";
    mocks.bag.storeState.listenerPorts = { mixed: 7890, invalid: "7891" };

    const { handleGenerate } = useRenderedHook({
      generatedYaml: "before",
      nodes: [{ name: "Node A" }],
      storeSources: [makeSource({ content: "proxies: []", parsed: true, lastParsedContent: "proxies: []" })],
      generateConfig: vi.fn(() => "after"),
    });

    await handleGenerate("quick");

    expect(mocks.toast).toHaveBeenCalledWith({ title: "已生成配置", variant: "success" });
    expect(mocks.bag.interactions.configGenerated).toHaveBeenCalledWith({
      mode: "quick",
      result: "success",
      sourceCount: 1,
      nodeCount: 2,
      templateType: "full",
      hasCustomRules: true,
      hasCustomProxyGroups: true,
      hasDnsYaml: true,
      hasListenerPorts: true,
    });

    mocks.toast.mockClear();
    await useRenderedHook({
      generatedYaml: "same",
      nodes: [{ name: "Node A" }],
      storeSources: [makeSource({ content: "proxies: []", parsed: true, lastParsedContent: "proxies: []" })],
      generateConfig: vi.fn(() => "same"),
    }).handleGenerate("advanced");

    expect(mocks.toast).toHaveBeenCalledWith({ title: "配置未变化", variant: "info" });
  });

  it("shows validation feedback when generation reports an error", async () => {
    mocks.bag.storeState.generatedYamlError = "dns yaml invalid";
    const { handleGenerate } = useRenderedHook({
      nodes: [{ name: "Node A" }],
      generateConfig: vi.fn(() => "after"),
    });

    await handleGenerate("quick");

    expect(mocks.toast).toHaveBeenCalledWith({
      title: "基础和 DNS 配置有错误",
      description: "dns yaml invalid",
      variant: "destructive",
    });
    expect(mocks.bag.interactions.configGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "quick", result: "validationError" })
    );
  });

  it("imports pending sources, tracks source results, and reports imported node count", async () => {
    const pendingSources = [
      makeSource({ id: "success-source" }),
      makeSource({ id: "runtime-source" }),
      makeSource({ id: "validation-source" }),
    ];
    const parseMultipleSources = vi.fn(async () => {
      mocks.bag.storeState.sources = [
        makeSource({ id: "success-source", parsed: true, nodeCount: 2, useProxyProviders: true }),
        makeSource({ id: "runtime-source", error: "fetch failed" }),
        makeSource({ id: "validation-source" }),
      ];
      mocks.bag.storeState.nodes = [{ name: "Node A" }, { name: "Node B" }];
    });
    const { handleGenerate } = useRenderedHook({
      storeSources: pendingSources,
      parseMultipleSources,
      clearNodes: vi.fn(),
    });

    await handleGenerate("quick");

    expect(parseMultipleSources).toHaveBeenCalledWith(pendingSources);
    expect(mocks.bag.interactions.sourceImported).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "quick",
        result: "success",
        nodeCount: 2,
        usesProxyProvider: true,
      })
    );
    expect(mocks.bag.interactions.sourceImported).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "quick", result: "runtimeError" })
    );
    expect(mocks.bag.interactions.sourceImported).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "quick", result: "validationError" })
    );
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "已导入 2 个节点，部分来源未完成",
      description: "还有 2 个来源未导入，请检查来源提示后重试。",
      variant: "warning",
    });
    expect(mocks.bag.interactions.configGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "quick", result: "validationError" })
    );
  });

  it("reports empty imports and failed imports", async () => {
    const pendingSource = makeSource({ id: "pending-source" });
    const parseWithoutNodes = vi.fn(async () => {
      mocks.bag.storeState.sources = [makeSource({ id: "pending-source", parsed: false })];
      mocks.bag.storeState.nodes = [];
    });
    await useRenderedHook({
      storeSources: [pendingSource],
      parseMultipleSources: parseWithoutNodes,
      clearNodes: vi.fn(),
    }).handleGenerate("quick");

    expect(mocks.toast).toHaveBeenCalledWith({ title: "未解析到有效节点", variant: "warning" });
    expect(mocks.bag.interactions.configGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "quick", result: "runtimeError" })
    );

    const failedImport = vi.fn(async () => {
      mocks.bag.storeState.sources = [makeSource({ id: "pending-source", content: "   " })];
      throw new Error("fetch failed");
    });
    await expect(
      useRenderedHook({
        storeSources: [pendingSource],
        parseMultipleSources: failedImport,
      }).handleGenerate("advanced")
    ).rejects.toThrow("fetch failed");

    expect(mocks.bag.interactions.sourceImported).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "advanced", result: "noInput" })
    );
    expect(mocks.bag.interactions.configGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "advanced", result: "runtimeError" })
    );
  });

  it("reports no input when generating an empty draft", async () => {
    const generateConfig = vi.fn(() => "mode: rule");
    const { handleGenerate, hasValidSources } = useRenderedHook({
      generatedYaml: "mode: rule",
      storeSources: [makeSource({ content: "   ", parsed: false })],
      generateConfig,
    });

    expect(hasValidSources).toBe(false);
    await handleGenerate("advanced");

    expect(generateConfig).toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({ title: "配置未变化", variant: "info" });
    expect(mocks.bag.interactions.configGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "advanced", result: "noInput" })
    );
  });

  it("generates a config from existing source content even when no source is pending", async () => {
    const source = makeSource({ parsed: true, lastParsedContent: "proxies: []" });
    const generateConfig = vi.fn(() => "mode: changed");
    const { handleGenerate } = useRenderedHook({
      generatedYaml: "mode: old",
      storeSources: [source],
      generateConfig,
    });

    await handleGenerate("quick");

    expect(generateConfig).toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith({ title: "已生成配置", variant: "success" });
    expect(mocks.bag.interactions.configGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "quick", result: "success" })
    );
  });
});
