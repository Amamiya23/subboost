import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  jwtVerify: vi.fn(),
  signPayload: null as unknown,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => (mocks.cookieValue === undefined ? undefined : { value: mocks.cookieValue }),
  })),
}));

vi.mock("jose", () => ({
  SignJWT: class SignJWT {
    private payload: unknown;
    constructor(payload: unknown) {
      this.payload = payload;
    }
    setProtectedHeader() {
      return this;
    }
    setSubject(subject: string) {
      mocks.signPayload = { ...(this.payload as Record<string, unknown>), sub: subject };
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "signed-session-token";
    }
  },
  jwtVerify: mocks.jwtVerify,
}));

import {
  clearSessionCookieOptions,
  getCredentialVersion,
  readSession,
  sessionCookieOptions,
  signSession,
} from "./session";

describe("local session helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookieValue = undefined;
    mocks.signPayload = null;
    process.env.JWT_SECRET = "test-secret";
    process.env.APP_URL = "https://local.example";
    mocks.jwtVerify.mockResolvedValue({ payload: { sub: "admin-1", username: "ry", credentialVersion: "version-1" } });
  });

  it("signs sessions with the admin id as JWT subject", async () => {
    await expect(signSession({ adminId: "admin-1", username: "ry" }, "password-hash")).resolves.toBe("signed-session-token");
    expect(mocks.signPayload).toEqual({ sub: "admin-1", username: "ry", credentialVersion: await getCredentialVersion("password-hash") });
    expect(JSON.stringify(mocks.signPayload)).not.toContain("password-hash");
    expect(await getCredentialVersion("other-hash")).not.toBe(await getCredentialVersion("password-hash"));
  });

  it("reads valid sessions and rejects missing, malformed, or invalid tokens", async () => {
    await expect(readSession()).resolves.toBeNull();

    mocks.cookieValue = "session-token";
    await expect(readSession()).resolves.toEqual({ adminId: "admin-1", username: "ry", credentialVersion: "version-1" });

    mocks.jwtVerify.mockResolvedValueOnce({ payload: { sub: "admin-1", username: "ry" } });
    await expect(readSession()).resolves.toBeNull();

    mocks.jwtVerify.mockResolvedValueOnce({ payload: { sub: 123, username: "ry" } });
    await expect(readSession()).resolves.toBeNull();

    mocks.jwtVerify.mockResolvedValueOnce({ payload: { sub: "admin-1", username: "" } });
    await expect(readSession()).resolves.toBeNull();

    mocks.jwtVerify.mockRejectedValueOnce(new Error("bad token"));
    await expect(readSession()).resolves.toBeNull();
  });

  it("builds secure session cookie options and clear options", () => {
    expect(sessionCookieOptions()).toEqual({
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(clearSessionCookieOptions()).toEqual({
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: true,
    });

    process.env.APP_URL = "http://local.example";
    expect(sessionCookieOptions()).toEqual(expect.objectContaining({ secure: false }));
    expect(clearSessionCookieOptions()).toEqual(expect.objectContaining({ secure: false }));
  });
});
