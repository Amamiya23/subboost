import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), doh: vi.fn(), fetch: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("@subboost/server-core/subscription/doh-resolver", () => ({ resolveHostnameByDoh: mocks.doh }));
import { downloadWebDavBackup, parseWebDavConfig, readLimitedText, testWebDav, uploadWebDavBackup } from "./webdav";
const config = { url: "https://dav.example.test/dav/", username: "用户", password: "app-password", path: "subboost/备份.enc.json" };

describe("WebDAV transport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.lookup.mockResolvedValue([{ address: "8.8.8.8" }]);
    mocks.fetch.mockImplementation(async () => new Response("", { status: 201 }));
  });
  it("creates directories and PUTs ciphertext with UTF-8 credentials and escaped paths", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("", { status: 405 }));
    await uploadWebDavBackup(config, "encrypted-payload");
    expect(mocks.fetch.mock.calls.map((call) => [String(call[0]), call[1].method])).toEqual([
      ["https://dav.example.test/dav/subboost/", "MKCOL"],
      ["https://dav.example.test/dav/subboost/%E5%A4%87%E4%BB%BD.enc.json", "PUT"],
    ]);
    expect(mocks.fetch.mock.calls[1][1]).toMatchObject({ redirect: "manual", body: "encrypted-payload" });
    expect(mocks.fetch.mock.calls[1][1].headers.Authorization).toBe("Basic " + Buffer.from("用户:app-password").toString("base64"));
  });
  it("tests without writing and downloads the selected file", async () => {
    await testWebDav(config);
    expect(mocks.fetch.mock.calls[0][1]).toMatchObject({ method: "PROPFIND", headers: { Depth: "0" } });
    mocks.fetch.mockResolvedValueOnce(new Response("encrypted"));
    await expect(downloadWebDavBackup(config)).resolves.toBe("encrypted");
  });
  it("rejects unsafe URLs, paths, private DNS targets, and redirects without following them", async () => {
    for (const url of ["http://dav.test", "https://user:pass@dav.test/", "https://dav.test/?token=secret"]) {
      expect(() => parseWebDavConfig({ ...config, url })).toThrow();
    }
    for (const path of ["../secret", "folder/../secret", "%2e%2e/secret", "folder//secret", "a?b", "a\\b"]) {
      expect(() => parseWebDavConfig({ ...config, path })).toThrow();
    }
    mocks.lookup.mockResolvedValueOnce([{ address: "192.168.1.1" }]);
    await expect(testWebDav(config)).rejects.toThrow("公网");
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValueOnce(new Response("", { status: 302, headers: { location: "https://evil.test" } }));
    await expect(testWebDav(config)).rejects.toThrow("重定向");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("handles auth errors and limits streamed responses without relying on Content-Length", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response("credential reflection", { status: 401 }));
    await expect(downloadWebDavBackup(config)).rejects.toThrow("认证失败");
    await expect(readLimitedText(new Response("12345"), 4)).rejects.toThrow("过大");
    await expect(readLimitedText(new Response("1", { headers: { "content-length": "100" } }), 4)).rejects.toThrow("过大");
  });
});
