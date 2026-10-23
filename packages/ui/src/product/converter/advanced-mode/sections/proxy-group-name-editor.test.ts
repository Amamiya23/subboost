import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buttons: [] as any[],
  dropdownItems: [] as any[],
  inputs: [] as any[],
}));

const stateMock = vi.hoisted(() => ({
  enabled: false,
  value: "",
  setter: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      if (!stateMock.enabled) return actual.useState(initial);
      return [stateMock.value, stateMock.setter];
    },
  };
});

vi.mock("lucide-react", () => ({
  ChevronDown: () => null,
  Shuffle: () => null,
}));

vi.mock("@subboost/ui/components/coss/compat/button", () => ({
  Button: (props: any) => {
    mocks.buttons.push(props);
    return props.children;
  },
}));

vi.mock("@subboost/ui/components/coss/compat/dropdown-menu", () => ({
  DropdownMenu: (props: any) => props.children,
  DropdownMenuContent: (props: any) => props.children,
  DropdownMenuItem: (props: any) => {
    mocks.dropdownItems.push(props);
    return props.children;
  },
  DropdownMenuTrigger: (props: any) => props.children,
}));

vi.mock("@subboost/ui/components/coss/compat/input", () => ({
  Input: (props: any) => {
    mocks.inputs.push(props);
    return null;
  },
}));

vi.mock("@subboost/ui/lib/utils", () => ({
  cn: (...parts: unknown[]) => parts.filter(Boolean).join(" "),
}));

import {
  ProxyGroupNameEditor,
  PROXY_GROUP_EMOJI_LIBRARY,
  buildProxyGroupName,
  parseProxyGroupNameDraft,
  toProxyGroupNameDraft,
} from "./proxy-group-name-editor";

describe("ProxyGroupNameEditor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.buttons = [];
    mocks.dropdownItems = [];
    mocks.inputs = [];
    stateMock.enabled = false;
    stateMock.value = "";
    stateMock.setter = vi.fn();
  });

  it("parses and builds proxy group name drafts", () => {
    expect(PROXY_GROUP_EMOJI_LIBRARY.length).toBeGreaterThan(300);
    expect(PROXY_GROUP_EMOJI_LIBRARY).toEqual(expect.arrayContaining(["😀", "🧠", "🚀", "🇺🇸"]));
    expect(parseProxyGroupNameDraft("🤖 AI 服务", "🧩")).toEqual({ emoji: "🤖", name: "AI 服务" });
    expect(parseProxyGroupNameDraft("Group A", "")).toEqual({ emoji: "", name: "Group A" });
    expect(parseProxyGroupNameDraft(123 as any, "🔗")).toEqual({ emoji: "🔗", name: "" });
    expect(toProxyGroupNameDraft("⚡ 快速选择", "🔗")).toEqual({ emoji: "⚡", name: "快速选择" });
    expect(toProxyGroupNameDraft(null)).toEqual({ emoji: "🧩", name: "" });
    expect(toProxyGroupNameDraft({ emoji: "", name: "" }, "🔗")).toEqual({ emoji: "", name: "" });
    expect(toProxyGroupNameDraft({ emoji: 1 as any, name: 2 as any }, "🔗")).toEqual({ emoji: "🔗", name: "" });
    expect(buildProxyGroupName({ emoji: "🧩", name: "自定义" })).toBe("🧩 自定义");
    expect(buildProxyGroupName("🔗 链路")).toBe("🔗 链路");
    expect(buildProxyGroupName({ emoji: "", name: "自定义" })).toBe("自定义");
    expect(buildProxyGroupName({ emoji: "🧩", name: "   " })).toBe("");
  });

  it("edits emoji and name values through the shared control", () => {
    const onChange = vi.fn();
    const onKeyDown = vi.fn();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const html = renderToStaticMarkup(
      React.createElement(ProxyGroupNameEditor, {
        value: { emoji: "🧩", name: "旧名称" },
        onChange,
        namePlaceholder: "代理组名称",
        allowEmptyEmoji: false,
        autoFocus: true,
        onKeyDown,
      })
    );

    const emojiInput = mocks.inputs.find((props: any) => props["aria-label"] === "emoji");
    const nameInput = mocks.inputs.find((props: any) => props.placeholder === "代理组名称");
    expect(emojiInput).toEqual(expect.objectContaining({ value: "🧩" }));
    expect(html).toContain("w-[51px]");
    expect(emojiInput.className).toContain("pl-2");
    expect(emojiInput.className).toContain("pr-5");
    expect(nameInput).toEqual(expect.objectContaining({ value: "旧名称", autoFocus: true }));
    expect(mocks.buttons.find((props: any) => props.title === "随机 emoji")).toBeUndefined();
    expect(mocks.buttons.find((props: any) => props.title === "选择 emoji").className).toContain("right-1");
    expect(mocks.dropdownItems[0]).toEqual(expect.objectContaining({ title: "随机 emoji" }));
    expect(mocks.dropdownItems[0].className).toContain("justify-center");
    expect(mocks.dropdownItems[1].children).toBe("🧩");

    emojiInput.onChange({ target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();

    emojiInput.onChange({ target: { value: "🤖" } });
    expect(onChange).toHaveBeenCalledWith({ emoji: "🤖", name: "旧名称" });

    nameInput.onChange({ target: { value: "新名称" } });
    expect(onChange).toHaveBeenCalledWith({ emoji: "🧩", name: "新名称" });

    mocks.dropdownItems[0].onClick();
    expect(onChange).toHaveBeenCalledWith({ emoji: "🚀", name: "旧名称" });

    mocks.dropdownItems.find((props: any) => props.children === "🤖").onClick();
    expect(onChange).toHaveBeenCalledWith({ emoji: "🤖", name: "旧名称" });

    nameInput.onKeyDown({ key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledWith({ key: "Enter" });
  });

  it("filters the emoji dropdown by search text", () => {
    stateMock.enabled = true;
    stateMock.value = "🤖";

    renderToStaticMarkup(
      React.createElement(ProxyGroupNameEditor, {
        value: "🔗 自动选择",
        onChange: vi.fn(),
      })
    );

    const searchInput = mocks.inputs.find((props: any) => props.placeholder === "搜索 emoji");
    expect(searchInput).toEqual(expect.objectContaining({ value: "🤖" }));
    searchInput.onChange({ target: { value: "🚀" } });
    expect(stateMock.setter).toHaveBeenCalledWith("🚀");
    expect(mocks.dropdownItems[0]).toEqual(expect.objectContaining({ title: "随机 emoji" }));
    expect(mocks.dropdownItems[0].className).toContain("justify-center");
    expect(mocks.dropdownItems.filter((props: any) => props.title !== "随机 emoji").map((props: any) => props.children)).toEqual(["🤖"]);
  });
});
