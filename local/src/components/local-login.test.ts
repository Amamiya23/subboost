import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  forms: [] as any[],
  inputs: [] as any[],
  buttons: [] as any[],
}));

const stateMock = vi.hoisted(() => ({
  enabled: false,
  callIndex: 0,
  overrides: {} as Record<number, unknown>,
  runEffects: false,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: React.EffectCallback, deps?: React.DependencyList) => {
      if (stateMock.enabled && stateMock.runEffects) {
        effect();
        return;
      }
      return actual.useEffect(effect, deps);
    },
    useState: (initial: unknown) => {
      if (!stateMock.enabled) return actual.useState(initial);
      const index = stateMock.callIndex++;
      const value = Object.prototype.hasOwnProperty.call(stateMock.overrides, index)
        ? stateMock.overrides[index]
        : initial;
      const setter = vi.fn((next: unknown) => {
        const resolved =
          typeof next === "function" ? (next as (prev: unknown) => unknown)(value) : next;
        (setter as any).lastValue = resolved;
        return resolved;
      });
      stateMock.setters[index] = setter;
      return [value, setter];
    },
  };
});

vi.mock("react/jsx-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react/jsx-runtime")>();
  const capture = (type: any, props: any) => {
    if (!stateMock.enabled) return;
    if (type === "form") mocks.forms.push(props ?? {});
    if (type === "input") mocks.inputs.push(props ?? {});
    if (type === "button") mocks.buttons.push(props ?? {});
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

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement("img", { src, alt, width, height, ...props }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.PropsWithChildren<{ href: string }>) =>
    React.createElement("a", { href, ...props }, children),
}));
vi.mock("lucide-react", () => ({
  CircleAlert: () => React.createElement("span", null, "alert-icon"),
  Eye: () => React.createElement("span", null, "eye-icon"),
  EyeOff: () => React.createElement("span", null, "eye-off-icon"),
  Loader2: () => React.createElement("span", null, "loader-icon"),
  Moon: () => React.createElement("span", null, "moon-icon"),
  ShieldCheck: () => React.createElement("span", null, "shield-check-icon"),
  Sun: () => React.createElement("span", null, "sun-icon"),
}));
vi.mock("@subboost/ui/components/coss/input", () => {
  const MockInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => {
      mocks.inputs.push(props);
      return React.createElement("input", { ...props, ref });
    },
  );
  MockInput.displayName = "MockInput";
  return { Input: MockInput };
});
vi.mock("@subboost/ui/components/coss/button", () => {
  const MockButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => {
      mocks.buttons.push(props);
      return React.createElement("button", { ...props, ref }, children);
    },
  );
  MockButton.displayName = "MockButton";
  return { Button: MockButton, buttonVariants: () => "" };
});
vi.mock("@subboost/ui/store/config-store/auth-handoff", () => ({
  hasAuthConfigHandoff: vi.fn(() => false),
}));

import { LocalLogin } from "./local-login";
import { hasAuthConfigHandoff } from "@subboost/ui/store/config-store/auth-handoff";

function response(body: unknown, ok = true) {
  return {
    ok,
    text: vi.fn(async () => (body === "" ? "" : JSON.stringify(body))),
  } as unknown as Response;
}

function installWindow() {
  Object.defineProperty(globalThis, "window", {
    value: { location: { href: "" } },
    configurable: true,
  });
  return (globalThis as any).window as { location: { href: string } };
}

function renderLogin(overrides: Record<number, unknown> = {}, runEffects = false) {
  stateMock.enabled = true;
  stateMock.callIndex = 0;
  stateMock.overrides = overrides;
  stateMock.runEffects = runEffects;
  stateMock.setters = [];
  mocks.forms = [];
  mocks.inputs = [];
  mocks.buttons = [];
  try {
    const html = renderToStaticMarkup(React.createElement(LocalLogin));
    return { html, setters: stateMock.setters };
  } finally {
    stateMock.enabled = false;
    stateMock.runEffects = false;
  }
}

async function flushPromises() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

describe("local login component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAuthConfigHandoff).mockReturnValue(false);
    delete (globalThis as any).fetch;
    delete (globalThis as any).window;
  });

  it("renders the initial loading card without requiring browser fetch", () => {
    const { html } = renderLogin();

    expect(html).toContain("SubBoost");
    expect(html).toContain("href=\"/\"");
    expect(html).toContain("src=\"/logo.png\"");
    expect(html).toContain("animate-skeleton");
  });

  it("loads auth state and redirects authenticated users", async () => {
    const win = installWindow();
    (globalThis as any).fetch = vi.fn(async () => response({ setupRequired: false, authenticated: true }));
    vi.mocked(hasAuthConfigHandoff).mockReturnValue(true);

    const { setters } = renderLogin({}, true);
    await flushPromises();

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/auth/me", { cache: "no-store" });
    expect(setters[0]).toHaveBeenCalledWith({ setupRequired: false, authenticated: true });
    expect(win.location.href).toBe("/builder");
  });

  it("shows setup mismatch errors before sending a request", async () => {
    installWindow();
    (globalThis as any).fetch = vi.fn();
    const { html, setters } = renderLogin({
      0: { setupRequired: true, authenticated: false },
      1: "admin",
      2: "secret",
      3: "different",
    });

    expect(html).toContain("创建本地管理员账号");
    expect(html).toContain("创建管理员");
    expect(html).toContain("至少 10 个字符");
    expect(mocks.inputs.find((input) => input.placeholder === "再次输入密码")).toEqual(
      expect.objectContaining({ autoComplete: "new-password" }),
    );

    await mocks.forms[0].onSubmit({ preventDefault: vi.fn() });

    expect(setters[6]).toHaveBeenCalledWith("密码至少需要 10 个字符");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("shows setup password mismatch errors before sending a request", async () => {
    installWindow();
    (globalThis as any).fetch = vi.fn();
    const { setters } = renderLogin({
      0: { setupRequired: true, authenticated: false },
      1: "admin",
      2: "long-password",
      3: "different-password",
    });

    await mocks.forms[0].onSubmit({ preventDefault: vi.fn() });

    expect(setters[6]).toHaveBeenCalledWith("两次输入的密码不一致，请重新确认");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("logs in existing local admins and toggles password visibility", async () => {
    const win = installWindow();
    (globalThis as any).fetch = vi.fn(async () => response(""));
    const { setters } = renderLogin({
      0: { setupRequired: false, authenticated: false },
      1: "admin",
      2: "secret",
      4: false,
    });

    mocks.inputs.find((input) => input.placeholder === "输入管理员账号").onChange({ target: { value: "root" } });
    mocks.inputs.find((input) => input.placeholder === "输入密码").onChange({ target: { value: "next" } });
    mocks.buttons.find((button) => button["aria-label"] === "显示密码").onClick();
    await mocks.forms[0].onSubmit({ preventDefault: vi.fn() });

    expect(setters[1]).toHaveBeenCalledWith("root");
    expect(setters[2]).toHaveBeenCalledWith("next");
    expect(setters[4]).toHaveBeenCalledWith(true);
    expect(setters[5]).toHaveBeenCalledWith(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "secret", passwordConfirm: "" }),
      }),
    );
    expect(win.location.href).toBe("/");
    expect(setters[5]).toHaveBeenLastCalledWith(false);
  });

  it("submits setup requests and reports server or load errors", async () => {
    installWindow();
    (globalThis as any).fetch = vi.fn(async () => response({ error: "用户名已存在" }, false));
    const { setters } = renderLogin({
      0: { setupRequired: true, authenticated: false },
      1: "admin",
      2: "long-secret",
      3: "long-secret",
      4: true,
    });

    expect(mocks.inputs.find((input) => input.placeholder === "输入密码").type).toBe("text");
    expect(mocks.inputs.find((input) => input.placeholder === "再次输入密码").type).toBe("text");

    await mocks.forms[0].onSubmit({ preventDefault: vi.fn() });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/setup/admin",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "long-secret", passwordConfirm: "long-secret" }),
      }),
    );
    expect(setters[6]).toHaveBeenCalledWith("用户名已存在");
    expect(setters[5]).toHaveBeenLastCalledWith(false);

    (globalThis as any).fetch = vi.fn(async () => {
      throw new Error("加载失败");
    });
    const load = renderLogin({}, true);
    await flushPromises();
    expect(load.setters[6]).toHaveBeenCalledWith("加载失败");
  });
});
