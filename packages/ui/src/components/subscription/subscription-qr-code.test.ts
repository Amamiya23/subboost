import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captures = vi.hoisted(() => ({ qrCodes: [] as any[] }));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: (props: any) => {
    captures.qrCodes.push(props);
    return React.createElement("svg", { role: props.role }, React.createElement("title", null, props.title));
  },
}));

import { SubscriptionQrCode } from "./subscription-qr-code";

describe("SubscriptionQrCode", () => {
  beforeEach(() => { captures.qrCodes = []; });

  it("encodes the full subscription URL with its token and query parameters unchanged", () => {
    const subscriptionUrl = "https://sub.example.com/download/a%2Bb?token=secret%2Fvalue&format=clash#配置";
    const html = renderToStaticMarkup(React.createElement(SubscriptionQrCode, { subscriptionUrl }));

    expect(captures.qrCodes[0]).toMatchObject({
      value: subscriptionUrl,
      marginSize: 4,
      level: "M",
      role: "img",
    });
    expect(html).toContain("订阅链接二维码");
    expect(html).not.toContain("<img");
  });

  it("does not generate a QR code before a subscription URL exists", () => {
    expect(renderToStaticMarkup(React.createElement(SubscriptionQrCode, { subscriptionUrl: "" }))).toBe("");
    expect(captures.qrCodes).toHaveLength(0);
  });
});
