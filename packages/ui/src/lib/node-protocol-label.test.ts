import { describe, expect, it } from "vitest";
import { getNodeProtocolLabel, type NodeProtocolDetails } from "./node-protocol-label";

describe("getNodeProtocolLabel", () => {
  it.each<[NodeProtocolDetails, string]>([
    [{ type: "vless", tls: true }, "VLESS TCP TLS"],
    [{ type: "vless", tls: true, "reality-opts": { "public-key": "key" } }, "VLESS TCP REALITY"],
    [{ type: "vless", network: "grpc", "reality-opts": { "public-key": "key" } }, "VLESS GRPC REALITY"],
    [{ type: "vless", network: "ws", tls: true }, "VLESS WS TLS"],
    [{ type: "vless", network: "xhttp", tls: true }, "VLESS XHTTP TLS"],
    [{ type: "vless", network: "xhttp", "xhttp-opts": { "download-settings": { "reality-opts": { "public-key": "download-key" } } } }, "VLESS XHTTP REALITY"],
    [{ type: "vmess", network: "h2", tls: true }, "VMESS H2 TLS"],
    [{ type: "vmess", network: "ws", tls: false }, "VMESS WS"],
    [{ type: "trojan" }, "TROJAN TCP TLS"],
    [{ type: "trojan", network: "grpc" }, "TROJAN GRPC TLS"],
    [{ type: "vless", network: "raw" }, "VLESS TCP"],
    [{ type: "vmess", network: "websocket", "ws-opts": { "v2ray-http-upgrade": true }, tls: true }, "VMESS HTTPUPGRADE TLS"],
    [{ type: "vless", "reality-opts": {}, tls: true }, "VLESS TCP TLS"],
    [{ type: "vless", "reality-opts": { "public-key": "" }, tls: false }, "VLESS TCP"],
    [{ type: " VMess ", network: " WS ", tls: true }, "VMESS WS TLS"],
    [{ type: "ss" }, "SS"],
    [{ type: "hysteria2" }, "HYSTERIA2"],
    [{ type: "custom" }, "CUSTOM"],
  ])("formats %j as %s", (node, expected) => {
    expect(getNodeProtocolLabel(node)).toBe(expected);
  });
});
