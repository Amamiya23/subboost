import { hasRealityConfig } from "@subboost/core/mihomo/reality";

export type NodeProtocolDetails = {
  type: string;
  network?: unknown;
  tls?: unknown;
  "ws-opts"?: unknown;
  "reality-opts"?: unknown;
  "xhttp-opts"?: unknown;
};

export type NodeProtocolParts = {
  protocol: string;
  transport?: string;
  security?: "TLS" | "REALITY";
};

export function getNodeProtocolParts(node: NodeProtocolDetails): NodeProtocolParts {
  const type = node.type.trim().toLowerCase();
  if (!["vless", "vmess", "trojan"].includes(type)) return { protocol: type.toUpperCase() };

  const rawNetwork = typeof node.network === "string" ? node.network.trim().toLowerCase() : "";
  let network = rawNetwork || "tcp";
  if (network === "raw" || network === "none") network = "tcp";
  if (network === "websocket") network = "ws";
  const wsOpts = node["ws-opts"];
  if (network === "ws" && wsOpts && typeof wsOpts === "object" &&
    "v2ray-http-upgrade" in wsOpts && wsOpts["v2ray-http-upgrade"] === true) {
    network = "httpupgrade";
  }

  const security = hasRealityConfig(node) ? "REALITY" : node.tls === true || type === "trojan" ? "TLS" : undefined;
  return { protocol: type.toUpperCase(), transport: network.toUpperCase(), security };
}

export function getNodeProtocolLabel(node: NodeProtocolDetails): string {
  const { protocol, transport, security } = getNodeProtocolParts(node);
  return [protocol, transport, security].filter(Boolean).join(" ");
}
